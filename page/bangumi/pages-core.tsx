import {
  Button,
  HStack,
  Image,
  Label,
  List,
  NavigationLink,
  Picker,
  Section,
  Spacer,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { loadCollectionSummaryData, loadDiscoverViewData, loadMonoSearchViewData, loadNoticeViewData, loadProgressViewData, loadSearchViewData, loadTimelineViewData, likeTimelinePath, markNoticeRead } from "./store"
import {
  AuthHeroCard,
  AvatarCircle,
  BangumiCard,
  BangumiEmptyState,
  BangumiInlineRow,
  BangumiPickerRow,
  BangumiSubjectSnippet,
  BangumiToggleRow,
  HeroCard,
  PosterBlock,
  ProgressCard,
  ProgressListRow,
} from "./ui"
import {
  bangumiAccent,
  bangumiAccentSoftBackground,
  bangumiLink,
  bangumiLinkSoftBackground,
  bangumiMutedCard,
  calendarDays,
  discoverSections,
  subjects,
  type BangumiSubject,
  type TimelineItem,
} from "./data"
import type { BangumiCalendarDay, BangumiCollectionSummaryItem, BangumiDiscoverSection, BangumiNoticeItem, BangumiSearchMonoItem } from "./types"

const progressKinds = ["全部", "动画", "书籍", "音乐", "游戏", "三次元"] as const
const progressCollections = ["全部状态", "想看", "在看", "看过", "搁置", "抛弃"] as const
const progressViewModes = ["列表", "平铺"] as const
const progressSortModes = ["收藏时间", "最后更新", "评分", "名称"] as const
const progressSecondLineModes = ["观看进度", "条目信息", "收藏状态"] as const
const searchTypes = ["条目", "角色", "人物"] as const
const searchSubjectTypes = ["全部", "动画", "书籍", "音乐", "游戏", "三次元"] as const

type ProgressKind = (typeof progressKinds)[number]
type ProgressCollection = (typeof progressCollections)[number]
type ProgressViewMode = (typeof progressViewModes)[number]
type ProgressSortMode = (typeof progressSortModes)[number]
type ProgressSecondLineMode = (typeof progressSecondLineModes)[number]
type TimelineMode = "friends" | "all" | "me"
const timelineModeOptions: Array<{ title: string; value: TimelineMode }> = [
  { title: "好友", value: "friends" },
  { title: "全站", value: "all" },
  { title: "我的", value: "me" },
]
const discoverRowPosterWidth = 56
const discoverRowPosterHeight = 76
const discoverRowSpacing = 12
const timelineRowPosterWidth = discoverRowPosterWidth
const timelineRowPosterHeight = discoverRowPosterHeight
const timelineRowSpacing = discoverRowSpacing

export function TimelinePage({
  closeButton,
  isAuthenticated,
  isolationMode,
  hasUnreadNotice,
  userAvatarLabel,
  renderUserPage,
  renderSubjectDetail,
  renderNoticePage,
}: {
  closeButton: JSX.Element
  isAuthenticated: boolean
  isolationMode: boolean
  hasUnreadNotice: boolean
  userAvatarLabel: string
  renderUserPage: () => JSX.Element
  renderSubjectDetail: (subject: BangumiSubject) => JSX.Element
  renderNoticePage: () => JSX.Element
}) {
  const [collectionSummary, setCollectionSummary] = useState<BangumiCollectionSummaryItem[]>([])
  const [collectionStatus, setCollectionStatus] = useState(isAuthenticated ? "正在同步真实收藏摘要" : "访客模式")
  const [timelineMode, setTimelineMode] = useState<TimelineMode>(isAuthenticated ? "friends" : "all")
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [timelineStatus, setTimelineStatus] = useState(isAuthenticated ? "正在载入好友时间线" : "访客模式")
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineExhausted, setTimelineExhausted] = useState(false)
  const [timelineLastId, setTimelineLastId] = useState<number | undefined>(undefined)
  const [fetchedTimelineIds, setFetchedTimelineIds] = useState<number[]>([])
  const [timelineActionStatus, setTimelineActionStatus] = useState("")
  const [selectedTimelineSubjectId, setSelectedTimelineSubjectId] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setCollectionSummary([])
      setCollectionStatus("访客模式")
      return
    }

    let disposed = false

    async function refreshCollectionSummary() {
      const data = await loadCollectionSummaryData()
      if (disposed) return
      setCollectionSummary(data.items)
      setCollectionStatus(data.message)
    }

    refreshCollectionSummary()

    return () => {
      disposed = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated && timelineMode !== "all") {
      setTimelineMode("all")
    }
  }, [isAuthenticated, timelineMode])

  useEffect(() => {
    if (!isAuthenticated && timelineMode !== "all") {
      return
    }

    let disposed = false

    async function refreshTimeline() {
      await reloadTimeline(disposed)
    }

    refreshTimeline()

    return () => {
      disposed = true
    }
  }, [isAuthenticated, timelineMode])

  async function reloadTimeline(disposed = false) {
    setTimelineLoading(true)
    setTimelineStatus(`正在载入${timelineModeTitle(timelineMode)}时间线`)
    setSelectedTimelineSubjectId(null)
    const data = await loadTimelineViewData(timelineMode)
    if (disposed) return
    setTimelineItems(data.items)
    setTimelineStatus(data.message)
    setTimelineLastId(data.lastId)
    setTimelineExhausted(Boolean(data.exhausted))
    setFetchedTimelineIds([])
    setTimelineLoading(false)
  }

  async function loadNextTimelinePage(item: TimelineItem) {
    if (timelineLoading || timelineExhausted || typeof timelineLastId !== "number" || item.id !== timelineLastId || fetchedTimelineIds.includes(item.id)) {
      return
    }

    setFetchedTimelineIds((ids) => [...ids, item.id])
    setTimelineLoading(true)
    const data = await loadTimelineViewData(timelineMode, timelineLastId)
    setTimelineStatus(data.message)
    setTimelineExhausted(Boolean(data.exhausted) || data.items.length === 0)
    setTimelineLastId(data.lastId)
    setTimelineItems((items) => mergeTimelineItems(items, data.items))
    setTimelineLoading(false)
  }

  const selectedTimelineSubject = typeof selectedTimelineSubjectId === "number"
    ? timelineItems.flatMap((item) => item.subjects?.length ? item.subjects : item.subject ? [item.subject] : []).find((subject) => subject.id === selectedTimelineSubjectId) ?? subjects.find((subject) => subject.id === selectedTimelineSubjectId)
    : undefined

  const availableTimelineModeOptions = timelineModeOptions.filter((item) => isAuthenticated || item.value === "all")
  const visibleCollectionSummary = collectionSummary.slice(0, 3)

  function openTimelineSubjectId(subjectId: number) {
    setSelectedTimelineSubjectId(subjectId)
  }

  return (
    <List
      navigationTitle="时间线"
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        topBarLeading: [
          <HStack key="leading-controls" spacing={10}>
            {closeButton}
            {isAuthenticated ? (
              <NavigationLink destination={renderUserPage()}>
                <AvatarCircle label={userAvatarLabel || "我"} size={30} />
              </NavigationLink>
            ) : (
              <AvatarCircle label="匿" size={30} />
            )}
          </HStack>,
        ],
        topBarTrailing:
          isAuthenticated && !isolationMode
            ? [
                <NavigationLink key="bell" destination={renderNoticePage()}>
                  <Label title="通知" systemImage={hasUnreadNotice ? "bell.badge.fill" : "bell"} />
                </NavigationLink>,
              ]
            : [],
      }}
      listStyle="inset"
      navigationDestination={{
        isPresented: selectedTimelineSubjectId !== null,
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setSelectedTimelineSubjectId(null)
          }
        },
        content: selectedTimelineSubject
          ? renderSubjectDetail(selectedTimelineSubject)
          : <BangumiEmptyState title="时间线" subtitle="请选择一条条目" icon="clock.arrow.circlepath" />,
      }}
    >
      <Section>
        <HeroCard
          title={isAuthenticated ? `Hi! ${userAvatarLabel || "Bangumi"}` : "Bangumi 让你的 ACG 生活更美好"}
          subtitle={isAuthenticated ? "查看好友、全站与你自己的最新动态，支持自动分页加载。" : "未登录时可浏览公开动态；登录后可查看好友与个人动态。"}
          accessory={
            <VStack alignment="leading" spacing={4}>
              <Text font="subheadline" foregroundStyle={bangumiLink}>{timelineStatus}</Text>
              {isAuthenticated ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>{collectionStatus}</Text> : <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>当前展示公开全站动态。</Text>}
            </VStack>
          }
        />
      </Section>

      <Section>
        <Picker title="范围" value={timelineMode} onChanged={(value: string) => setTimelineMode(value as TimelineMode)} pickerStyle="segmented">
          {availableTimelineModeOptions.map((item) => (
            <Text key={item.value} tag={item.value}>{item.title}</Text>
          ))}
        </Picker>
        {!isAuthenticated ? <Text font="caption" foregroundStyle="secondaryLabel">未登录时仅开放全站公开时间线；登录后可查看好友 / 我的动态。</Text> : null}
        {timelineActionStatus ? <Text font="footnote" foregroundStyle="secondaryLabel">{timelineActionStatus}</Text> : null}
      </Section>

      {isAuthenticated ? (
        <Section title="账号入口">
          <NavigationLink destination={renderUserPage()}>
            <BangumiInlineRow title="我的时光机" value="进入" icon="house.fill" />
          </NavigationLink>
        </Section>
      ) : null}

      {visibleCollectionSummary.length ? (
        <Section title="收藏摘要">
          {visibleCollectionSummary.map((item) => (
            <BangumiInlineRow key={item.title} title={item.title} value={`${item.count}`} icon="square.stack.3d.up.fill" />
          ))}
        </Section>
      ) : null}

      <Section title={`${timelineModeTitle(timelineMode)}动态 · ${timelineItems.length}`}>
        {timelineItems.length ? (
          timelineItems.map((item, index) => (
            <TimelineCard
              key={item.id}
              item={item}
              previousUser={timelineItems[index - 1]?.user}
              openSubjectId={openTimelineSubjectId}
              onReact={async (path) => {
                setTimelineActionStatus("正在发送赞")
                try {
                  await likeTimelinePath(path)
                  setTimelineActionStatus("已发送赞。")
                } catch (error) {
                  const message = error instanceof Error ? error.message : "未知错误"
                  setTimelineActionStatus(`操作失败：${message}`)
                }
              }}
              onAppear={() => { void loadNextTimelinePage(item) }}
            />
          ))
        ) : (
          <BangumiEmptyState title={timelineLoading ? "正在同步" : "暂无动态"} subtitle={timelineStatus} icon={timelineLoading ? "arrow.triangle.2.circlepath" : "tray.fill"} />
        )}
        {timelineItems.length && timelineLoading ? <Text font="footnote" foregroundStyle="secondaryLabel">正在载入更多…</Text> : null}
        {timelineItems.length && timelineExhausted ? <Text font="footnote" foregroundStyle="secondaryLabel">已显示全部动态</Text> : null}
      </Section>
    </List>
  )
}

function mergeTimelineItems(current: TimelineItem[], next: TimelineItem[]) {
  const seen = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !seen.has(item.id))]
}

function timelineModeTitle(mode: TimelineMode) {
  return timelineModeOptions.find((item) => item.value === mode)?.title ?? "好友"
}

function TimelineCard({
  item,
  previousUser,
  openSubjectId,
  onReact,
  onAppear,
}: {
  item: TimelineItem
  previousUser?: string
  openSubjectId: (subjectId: number) => void
  onReact?: (path: string) => void
  onAppear?: () => void
}) {
  const sameUserAsPrevious = previousUser === item.user
  const subjects = item.subjects?.length ? item.subjects : item.subject ? [item.subject] : []

  return (
    <BangumiCard>
      <HStack alignment="top" spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }} onAppear={onAppear}>
        {sameUserAsPrevious ? <HStack frame={{ width: 40, height: 40 }} /> : <AvatarCircle label={timelineAvatarLabel(item.user)} size={40} imageUrl={item.avatarUrl} />}
        <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
          <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <HStack alignment="top" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
                <Text font="headline" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{sameUserAsPrevious ? "" : item.user}</Text>
                <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.action}</Text>
              </VStack>
              <Text font="caption" foregroundStyle={bangumiAccent} lineLimit={1}>{item.categoryLabel ?? "动态"}</Text>
            </HStack>
            <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.time}{item.sourceName ? ` · ${item.sourceName}` : ""}</Text>
          </VStack>
          <TimelineTypedContent item={item} subjects={subjects} openSubjectId={openSubjectId} />
          <TimelineMetaRow item={item} onReact={onReact} />
        </VStack>
      </HStack>
    </BangumiCard>
  )
}

function TimelineTypedContent({
  item,
  subjects,
  openSubjectId,
}: {
  item: TimelineItem
  subjects: BangumiSubject[]
  openSubjectId: (subjectId: number) => void
}) {
  switch (item.category) {
    case 3:
      return <TimelineSubjectContent item={item} subjects={subjects} openSubjectId={openSubjectId} />
    case 4:
      return <TimelineProgressContent item={item} subjects={subjects} openSubjectId={openSubjectId} />
    case 5:
      return <TimelineStatusContent item={item} />
    case 1:
    case 8:
      return <TimelineTargetContent item={item} />
    case 2:
    case 6:
    case 7:
      return <TimelineMixedContent item={item} subjects={subjects} openSubjectId={openSubjectId} />
    default:
      return <TimelineMixedContent item={item} subjects={subjects} openSubjectId={openSubjectId} />
  }
}

function TimelineSubjectContent({ item, subjects, openSubjectId }: { item: TimelineItem; subjects: BangumiSubject[]; openSubjectId: (subjectId: number) => void }) {
  return (
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      {item.rate ? <Text font="caption" foregroundStyle={bangumiAccent} frame={{ maxWidth: "infinity", alignment: "leading" }}>评分 {item.rate}</Text> : null}
      {item.comment ? <TimelineQuote text={item.comment} /> : <Text font="body" lineLimit={4} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.content}</Text>}
      <TimelineSubjectList subjects={subjects} fallbackTitle={item.subjectTitle} fallbackId={item.subjectId} openSubjectId={openSubjectId} />
    </VStack>
  )
}

function TimelineProgressContent({ item, subjects, openSubjectId }: { item: TimelineItem; subjects: BangumiSubject[]; openSubjectId: (subjectId: number) => void }) {
  return (
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font="body" lineLimit={3} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.content}</Text>
      <TimelineSubjectList subjects={subjects.slice(0, 1)} fallbackTitle={item.subjectTitle} fallbackId={item.subjectId} openSubjectId={openSubjectId} compact={true} />
    </VStack>
  )
}

function TimelineStatusContent({ item }: { item: TimelineItem }) {
  return (
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font="body" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.comment || item.content}</Text>
    </VStack>
  )
}

function TimelineTargetContent({ item }: { item: TimelineItem }) {
  const targets = item.targets ?? []
  return (
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font="body" lineLimit={4} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.content}</Text>
      {targets.length ? <TimelineTargetStrip targets={targets} /> : null}
    </VStack>
  )
}

function TimelineMixedContent({ item, subjects, openSubjectId }: { item: TimelineItem; subjects: BangumiSubject[]; openSubjectId: (subjectId: number) => void }) {
  return (
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Text font="body" lineLimit={4} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.content}</Text>
      <TimelineSubjectList subjects={subjects} fallbackTitle={item.subjectTitle} fallbackId={item.subjectId} openSubjectId={openSubjectId} />
      {item.targets?.length ? <TimelineTargetStrip targets={item.targets} /> : null}
    </VStack>
  )
}

function TimelineSubjectList({
  subjects: items,
  fallbackTitle,
  fallbackId,
  openSubjectId,
  compact,
}: {
  subjects: BangumiSubject[]
  fallbackTitle?: string
  fallbackId?: number
  openSubjectId: (subjectId: number) => void
  compact?: boolean
}) {
  if (items.length) {
    return (
      <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {items.slice(0, compact ? 1 : 5).map((subject) => <TimelineSubjectPreview key={subject.id} subject={subject} openSubjectId={openSubjectId} compact={compact} />)}
      </VStack>
    )
  }

  return fallbackTitle ? <TimelineSubjectFallback title={fallbackTitle} subjectId={fallbackId} openSubjectId={openSubjectId} /> : null
}

function TimelineSubjectPreview({
  subject,
  openSubjectId,
  compact,
}: {
  subject: BangumiSubject
  openSubjectId: (subjectId: number) => void
  compact?: boolean
}) {
  return (
    <HStack alignment="top" spacing={timelineRowSpacing} padding={{ vertical: 4 }} frame={{ maxWidth: "infinity", minHeight: compact ? 58 : 82, alignment: "leading" }} onTapGesture={() => openSubjectId(subject.id)}>
      <PosterBlock subject={subject} width={compact ? 40 : timelineRowPosterWidth} height={compact ? 56 : timelineRowPosterHeight} />
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
        <Text font="subheadline" fontWeight="semibold" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.kind} · {subject.progressLabel || subject.meta}</Text>
      </VStack>
    </HStack>
  )
}

function TimelineSubjectFallback({
  title,
  subjectId,
  openSubjectId,
}: {
  title: string
  subjectId?: number
  openSubjectId: (subjectId: number) => void
}) {
  const content = (
    <HStack alignment="top" spacing={timelineRowSpacing} padding={{ vertical: 6 }} frame={{ maxWidth: "infinity", minHeight: 54, alignment: "leading" }}>
      <HStack frame={{ width: timelineRowPosterWidth, alignment: "center" }}>
        <Image systemName="rectangle.stack.fill" tint={bangumiAccent} />
      </HStack>
      <Text font="subheadline" fontWeight="semibold" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{title}</Text>
      <Spacer />
      {typeof subjectId === "number" ? <Image systemName="chevron.right" tint="secondaryLabel" /> : null}
    </HStack>
  )

  if (typeof subjectId === "number") {
    return <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", alignment: "leading" }} onTapGesture={() => openSubjectId(subjectId)}>{content}</VStack>
  }

  return content
}

function TimelineTargetStrip({ targets }: { targets: NonNullable<TimelineItem["targets"]> }) {
  return (
    <HStack spacing={8} padding={{ top: 2 }}>
      {targets.slice(0, 5).map((target, index) => (
        <VStack key={`${target.kind}-${target.id ?? target.title}-${index}`} alignment="center" spacing={3} frame={{ width: 54 }}>
          <AvatarCircle label={target.title.slice(0, 1)} size={34} imageUrl={target.imageUrl} />
          <Text font="caption2" lineLimit={1} multilineTextAlignment="center">{target.title}</Text>
        </VStack>
      ))}
    </HStack>
  )
}

function TimelineQuote({ text }: { text: string }) {
  return (
    <Text
      font="body"
      multilineTextAlignment="leading"
      frame={{ maxWidth: "infinity", alignment: "leading" }}
    >
      {text}
    </Text>
  )
}

function TimelineMetaRow({ item, onReact }: { item: TimelineItem; onReact?: (path: string) => void }) {
  const reactions = item.reactions.slice(0, 3)
  const hasMeta = reactions.length > 0 || Boolean(item.batch) || Boolean(item.reactionPath)
  if (!hasMeta) {
    return null
  }

  return (
    <HStack spacing={8}>
      {reactions.map((reaction) => (
        <Text key={reaction} font="caption" foregroundStyle={bangumiLink}>{reaction}</Text>
      ))}
      {item.reactionPath ? <Text font="caption" foregroundStyle={bangumiAccent} onTapGesture={() => onReact?.(item.reactionPath as string)}>赞</Text> : null}
      <Spacer />
      {item.batch ? <Text font="caption" foregroundStyle="secondaryLabel">{item.batch}</Text> : null}
    </HStack>
  )
}

function timelineAvatarLabel(name: string) {
  return name.trim().slice(0, 1) || "用"
}

export function ProgressPage({
  closeButton,
  isAuthenticated,
  renderSubjectDetail,
}: {
  closeButton: JSX.Element
  isAuthenticated: boolean
  renderSubjectDetail: (subject: BangumiSubject) => JSX.Element
}) {
  const [kind, setKind] = useState<ProgressKind>("动画")
  const [collectionFilter, setCollectionFilter] = useState<ProgressCollection>("全部状态")
  const [searchText, setSearchText] = useState("")
  const [viewMode, setViewMode] = useState<ProgressViewMode>("列表")
  const [sortMode, setSortMode] = useState<ProgressSortMode>("收藏时间")
  const [secondLineMode, setSecondLineMode] = useState<ProgressSecondLineMode>("观看进度")
  const [syncStatus, setSyncStatus] = useState("登录后同步收藏进度")
  const [progressLoading, setProgressLoading] = useState(isAuthenticated)
  const [progressRefreshToken, setProgressRefreshToken] = useState(0)
  const [resolvedProgressSubjects, setResolvedProgressSubjects] = useState<readonly BangumiSubject[]>(subjects)
  const [collectionSummary, setCollectionSummary] = useState<BangumiCollectionSummaryItem[]>([])
  const [selectedProgressSubjectId, setSelectedProgressSubjectId] = useState<number | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setResolvedProgressSubjects(subjects)
      setCollectionSummary([])
      setSyncStatus("登录后同步收藏进度")
      setProgressLoading(false)
      setSelectedProgressSubjectId(null)
      return
    }

    let disposed = false
    setProgressLoading(true)
    setSyncStatus("正在同步收藏进度")

    async function refreshProgress() {
      const data = await loadProgressViewData()
      if (disposed) return
      setResolvedProgressSubjects(data.subjects)
      setCollectionSummary(data.collectionSummary)
      setSyncStatus(data.message)
      setProgressLoading(false)
      setSelectedProgressSubjectId(null)
    }

    refreshProgress()

    return () => {
      disposed = true
    }
  }, [isAuthenticated, progressRefreshToken])

  const filtered = resolvedProgressSubjects.filter((item) => {
    const matchesKind = kind === "全部" || item.kind === kind
    const matchesCollection = collectionFilter === "全部状态" || item.collection === collectionFilter
    const keyword = searchText.trim().toLowerCase()
    const matchesSearch =
      keyword.length === 0 ||
      item.title.toLowerCase().includes(keyword) ||
      item.originalTitle.toLowerCase().includes(keyword)
    return matchesKind && matchesCollection && matchesSearch
  })

  const sorted = [...filtered].sort((left, right) => compareProgressSubjects(left, right, sortMode))
  const selectedProgressSubject = typeof selectedProgressSubjectId === "number"
    ? sorted.find((subject) => subject.id === selectedProgressSubjectId) ?? resolvedProgressSubjects.find((subject) => subject.id === selectedProgressSubjectId)
    : undefined
  const leading = sorted.filter((_, index) => index % 2 === 0)
  const trailing = sorted.filter((_, index) => index % 2 === 1)
  const visibleCount = sorted.length
  const summaryTotal = collectionSummary.reduce((sum, item) => sum + item.count, 0) || resolvedProgressSubjects.length
  const activeFilterLabel = buildProgressScopeLabel(kind, collectionFilter, searchText)

  if (!isAuthenticated) {
    return (
      <List
        navigationTitle="进度管理"
        navigationBarTitleDisplayMode="inline"
        toolbar={{ topBarLeading: [closeButton] }}
        listStyle="inset"
      >
        <Section>
          <AuthHeroCard />
        </Section>
      </List>
    )
  }

  return (
    <List
      navigationTitle="进度管理"
      navigationBarTitleDisplayMode="inline"
      searchable={{ value: searchText, onChanged: setSearchText, prompt: "搜索收藏条目" }}
      toolbar={{
        topBarLeading: [closeButton],
        topBarTrailing: [<Button key="refresh" title={progressLoading ? "同步中" : "刷新"} systemImage="arrow.clockwise" action={() => setProgressRefreshToken((tick) => tick + 1)} />],
      }}
      listStyle="inset"
      navigationDestination={{
        isPresented: selectedProgressSubjectId !== null,
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setSelectedProgressSubjectId(null)
          }
        },
        content: selectedProgressSubject
          ? renderSubjectDetail(selectedProgressSubject)
          : <BangumiEmptyState title="进度管理" subtitle="请选择一个条目" icon="square.stack.3d.up.fill" />,
      }}
    >
      <Section>
        <ProgressOverviewCard
          totalCount={summaryTotal}
          loadedCount={resolvedProgressSubjects.length}
          visibleCount={visibleCount}
          syncStatus={syncStatus}
          loading={progressLoading}
          collectionSummary={collectionSummary}
          onRefresh={() => setProgressRefreshToken((tick) => tick + 1)}
        />
      </Section>

      <Section title="筛选与视图">
        <Picker title="分类" value={kind} onChanged={(value: string) => setKind(value as ProgressKind)}>
          {progressKinds.map((item) => (
            <Text key={item} tag={item}>{item === "全部" ? item : `${item}(${resolvedProgressSubjects.filter((subject) => subject.kind === item).length})`}</Text>
          ))}
        </Picker>
        <ProgressStatusFilter subjects={resolvedProgressSubjects} value={collectionFilter} onChange={setCollectionFilter} />
        <BangumiPickerRow title="显示模式" value={viewMode} options={[...progressViewModes]} onChanged={(value: string) => setViewMode(value as ProgressViewMode)} />
        <BangumiPickerRow title="排序方式" value={sortMode} options={[...progressSortModes]} onChanged={(value: string) => setSortMode(value as ProgressSortMode)} />
        <BangumiPickerRow title="副标题内容" value={secondLineMode} options={[...progressSecondLineModes]} onChanged={(value: string) => setSecondLineMode(value as ProgressSecondLineMode)} />
      </Section>

      <Section title={searchText.trim() ? `搜索结果 · ${visibleCount}` : `${activeFilterLabel} · ${visibleCount}`}>
        {sorted.length ? (
          viewMode === "列表" ? (
            sorted.map((subject) => (
              <VStack key={subject.id} alignment="leading" spacing={0} onTapGesture={() => setSelectedProgressSubjectId(subject.id)}>
                <ProgressListRow subject={subject} secondLineMode={secondLineMode} />
              </VStack>
            ))
          ) : (
            <HStack alignment="top" spacing={12}>
              <VStack alignment="leading" spacing={12} frame={{ maxWidth: "infinity" }}>
                {leading.map((subject) => (
                  <VStack key={subject.id} alignment="leading" spacing={0} frame={{ maxWidth: "infinity" }} onTapGesture={() => setSelectedProgressSubjectId(subject.id)}>
                    <ProgressCard subject={subject} secondLineMode={secondLineMode} />
                  </VStack>
                ))}
              </VStack>
              <VStack alignment="leading" spacing={12} frame={{ maxWidth: "infinity" }}>
                {trailing.map((subject) => (
                  <VStack key={subject.id} alignment="leading" spacing={0} frame={{ maxWidth: "infinity" }} onTapGesture={() => setSelectedProgressSubjectId(subject.id)}>
                    <ProgressCard subject={subject} secondLineMode={secondLineMode} />
                  </VStack>
                ))}
              </VStack>
            </HStack>
          )
        ) : (
          <BangumiEmptyState title={progressLoading ? "正在同步" : "没有条目"} subtitle={searchText.trim() ? "当前搜索没有结果" : "当前筛选结果为空，可调整分类或刷新后再查看"} icon={progressLoading ? "arrow.triangle.2.circlepath" : "tray.fill"} />
        )}
      </Section>
    </List>
  )
}

function ProgressOverviewCard({
  totalCount,
  loadedCount,
  visibleCount,
  syncStatus,
  loading,
  collectionSummary,
  onRefresh,
}: {
  totalCount: number
  loadedCount: number
  visibleCount: number
  syncStatus: string
  loading: boolean
  collectionSummary: BangumiCollectionSummaryItem[]
  onRefresh: () => void
}) {
  return (
    <BangumiCard>
      <VStack alignment="leading" spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <ProgressHeaderRow
          icon="square.stack.3d.up.fill"
          title="收藏进度"
          subtitle={syncStatus}
          accessory={<Button title={loading ? "同步中" : "同步"} systemImage="arrow.clockwise" action={onRefresh} />}
        />

        <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
          <ProgressMetricCell icon="square.stack.3d.up.fill" label="总收藏" value={`${totalCount}`} />
          <ProgressMetricCell icon="tray.full.fill" label="已载入" value={`${loadedCount}`} />
          <ProgressMetricCell icon="line.3.horizontal.decrease.circle.fill" label="当前" value={`${visibleCount}`} accent={true} />
        </HStack>

        {collectionSummary.length ? <ProgressSummaryStrip items={collectionSummary} /> : null}
      </VStack>
    </BangumiCard>
  )
}

function ProgressHeaderRow({
  icon,
  title,
  subtitle,
  value,
  accessory,
}: {
  icon: string
  title: string
  subtitle?: string
  value?: string
  accessory?: JSX.Element
}) {
  return (
    <HStack alignment="top" spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <Image systemName={icon} frame={{ width: 20 }} tint={bangumiAccent} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
        <Text font="headline" lineLimit={1}>{title}</Text>
        {subtitle ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>{subtitle}</Text> : null}
      </VStack>
      {value ? <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{value}</Text> : null}
      {accessory ?? null}
    </HStack>
  )
}

function ProgressMetricCell({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: boolean }) {
  return (
    <VStack
      alignment="leading"
      spacing={5}
      frame={{ maxWidth: "infinity", minHeight: 62, alignment: "leading" }}
      padding={{ horizontal: 10, vertical: 9 }}
      background={accent ? bangumiLinkSoftBackground : bangumiMutedCard}
      clipShape={{ type: "rect", cornerRadius: 10 }}
    >
      <HStack spacing={5}>
        <Image systemName={icon} frame={{ width: 14 }} tint={accent ? bangumiLink : bangumiAccent} />
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{label}</Text>
      </HStack>
      <Text font="headline" foregroundStyle={accent ? (bangumiLink as never) : undefined} lineLimit={1}>{value}</Text>
    </VStack>
  )
}

function ProgressSummaryStrip({ items }: { items: BangumiCollectionSummaryItem[] }) {
  const firstRow = items.slice(0, 3)
  const secondRow = items.slice(3, 5)
  return (
    <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
      <ProgressSummaryRow items={firstRow} />
      {secondRow.length ? <ProgressSummaryRow items={secondRow} /> : null}
    </VStack>
  )
}

function ProgressSummaryRow({ items }: { items: BangumiCollectionSummaryItem[] }) {
  return (
    <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
      {items.map((item) => (
        <HStack
          key={item.title}
          spacing={4}
          frame={{ maxWidth: "infinity", minHeight: 30, alignment: "center" }}
          padding={{ horizontal: 8, vertical: 5 }}
          background={bangumiAccentSoftBackground}
          clipShape={{ type: "rect", cornerRadius: 8 }}
        >
          <Text font="caption" foregroundStyle={bangumiLink} lineLimit={1}>{item.title}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{item.count}</Text>
        </HStack>
      ))}
    </HStack>
  )
}

function ProgressStatusFilter({
  subjects,
  value,
  onChange,
}: {
  subjects: readonly BangumiSubject[]
  value: ProgressCollection
  onChange: (value: ProgressCollection) => void
}) {
  const firstRow = progressCollections.slice(0, 3)
  const secondRow = progressCollections.slice(3)
  return (
    <BangumiCard>
      <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <ProgressHeaderRow icon="line.3.horizontal.decrease.circle.fill" title="收藏状态" value={value} />
        <ProgressStatusChipRow subjects={subjects} values={firstRow} value={value} onChange={onChange} />
        <ProgressStatusChipRow subjects={subjects} values={secondRow} value={value} onChange={onChange} />
      </VStack>
    </BangumiCard>
  )
}

function ProgressStatusChipRow({
  subjects,
  values,
  value,
  onChange,
}: {
  subjects: readonly BangumiSubject[]
  values: readonly ProgressCollection[]
  value: ProgressCollection
  onChange: (value: ProgressCollection) => void
}) {
  return (
    <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
      {values.map((item) => (
        <ProgressStatusChip key={item} label={item} count={countProgressCollection(subjects, item)} selected={item === value} onSelect={() => onChange(item)} />
      ))}
    </HStack>
  )
}

function ProgressStatusChip({ label, count, selected, onSelect }: { label: ProgressCollection; count: number; selected: boolean; onSelect: () => void }) {
  return (
    <VStack
      alignment="center"
      spacing={2}
      frame={{ maxWidth: "infinity", minHeight: 40 }}
      padding={{ vertical: 6 }}
      background={selected ? (bangumiAccent as never) : bangumiMutedCard}
      clipShape={{ type: "rect", cornerRadius: 10 }}
      onTapGesture={onSelect}
    >
      <Text font="caption" foregroundStyle={selected ? "white" : undefined} lineLimit={1}>{label}</Text>
      <Text font="caption2" foregroundStyle={selected ? "white" : "secondaryLabel"} lineLimit={1}>{count}</Text>
    </VStack>
  )
}

function countProgressCollection(subjects: readonly BangumiSubject[], collection: ProgressCollection) {
  if (collection === "全部状态") {
    return subjects.length
  }
  return subjects.filter((subject) => subject.collection === collection).length
}

function buildProgressScopeLabel(kind: ProgressKind, collection: ProgressCollection, searchText: string) {
  const parts = [kind === "全部" ? undefined : kind, collection === "全部状态" ? undefined : collection, searchText.trim() ? "搜索" : undefined].filter(Boolean)
  return parts.length ? parts.join(" · ") : "全部收藏"
}

function compareProgressSubjects(left: BangumiSubject, right: BangumiSubject, sortMode: string) {
  switch (sortMode) {
    case "评分":
      return right.score - left.score || right.votes - left.votes || left.title.localeCompare(right.title)
    case "名称":
      return left.title.localeCompare(right.title)
    case "最后更新":
      return extractUpdatedTimestamp(right.meta) - extractUpdatedTimestamp(left.meta) || left.title.localeCompare(right.title)
    case "收藏时间":
    default:
      return collectionPriority(left.collection) - collectionPriority(right.collection) || extractUpdatedTimestamp(right.meta) - extractUpdatedTimestamp(left.meta) || left.title.localeCompare(right.title)
  }
}

function collectionPriority(collection: string) {
  switch (collection) {
    case "在看":
      return 0
    case "想看":
      return 1
    case "看过":
      return 2
    case "搁置":
      return 3
    case "抛弃":
      return 4
    default:
      return 5
  }
}

function extractUpdatedTimestamp(meta: string) {
  const matched = meta.match(/更新于\s*(\d{4}-\d{2}-\d{2})/)
  if (!matched?.[1]) {
    return 0
  }
  const timestamp = Date.parse(`${matched[1]}T00:00:00`)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function NoticePage({
  renderSubjectDetail,
}: {
  renderSubjectDetail: (subject: BangumiSubject) => JSX.Element
}) {
  const [notices, setNotices] = useState<BangumiNoticeItem[]>([])
  const [noticeStatus, setNoticeStatus] = useState("正在载入提醒")
  const [unreadCount, setUnreadCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedNoticeSubjectId, setSelectedNoticeSubjectId] = useState<number | null>(null)

  async function refreshNotice() {
    const data = await loadNoticeViewData()
    setNotices(data.items)
    setUnreadCount(data.unread)
    setTotalCount(data.total)
    setNoticeStatus(data.message)
  }

  async function markAllRead() {
    const ids = notices.filter((notice) => notice.unread).map((notice) => notice.id)
    if (!ids.length) {
      setNoticeStatus("当前没有未读提醒。")
      return
    }
    setNoticeStatus("正在标记全部已读")
    await markNoticeRead(ids)
    await refreshNotice()
  }

  async function markOneRead(id: number) {
    setNoticeStatus("正在标记已读")
    await markNoticeRead([id])
    await refreshNotice()
  }

  useEffect(() => {
    refreshNotice()
  }, [])

  const selectedNoticeSubject = typeof selectedNoticeSubjectId === "number"
    ? notices.flatMap((notice) => notice.subject ? [notice.subject] : []).find((subject) => subject.id === selectedNoticeSubjectId)
    : undefined

  return (
    <List
      navigationTitle={unreadCount ? `电波提醒 (${unreadCount})` : "电波提醒"}
      navigationBarTitleDisplayMode="inline"
      listStyle="inset"
      refreshable={refreshNotice}
      toolbar={{ topBarTrailing: [<Button key="read-all" title="全部已读" systemImage="checkmark.circle" action={markAllRead} />] }}
      navigationDestination={{
        isPresented: selectedNoticeSubjectId !== null,
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setSelectedNoticeSubjectId(null)
          }
        },
        content: selectedNoticeSubject
          ? renderSubjectDetail(selectedNoticeSubject)
          : <BangumiEmptyState title="通知" subtitle="请选择一个条目" icon="bell.fill" />,
      }}
    >
      <Section>
        <HeroCard
          title="电波提醒"
          subtitle="提醒会按时间同步，支持查看未读数量并快速标记已读。"
          accessory={<Text font="subheadline" foregroundStyle={bangumiLink}>{noticeStatus}</Text>}
        />
      </Section>

      <Section title="统计">
        <BangumiInlineRow title="未读" value={`${unreadCount}`} icon="bell.badge.fill" />
        <BangumiInlineRow title="总数" value={`${totalCount || notices.length}`} icon="tray.full.fill" />
      </Section>

      <Section title="提醒列表">
        {notices.length ? (
          notices.map((notice) => <NoticeCard key={notice.id} notice={notice} openSubjectId={setSelectedNoticeSubjectId} markRead={markOneRead} />)
        ) : (
          <BangumiEmptyState title="暂无提醒" subtitle="当前没有可展示的通知。" icon="bell.slash.fill" />
        )}
      </Section>
    </List>
  )
}

export function DiscoverPage({
  closeButton,
  renderSubjectDetail,
  renderMonoDetail,
}: {
  closeButton: JSX.Element
  renderSubjectDetail: (subject: BangumiSubject) => JSX.Element
  renderMonoDetail: (item: BangumiSearchMonoItem) => JSX.Element
}) {
  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState(true)
  const [searchType, setSearchType] = useState<(typeof searchTypes)[number]>("条目")
  const [subjectType, setSubjectType] = useState<(typeof searchSubjectTypes)[number]>("全部")
  const [searchStatus, setSearchStatus] = useState("输入关键字搜索")
  const [resolvedSearchSubjects, setResolvedSearchSubjects] = useState<BangumiSubject[]>([])
  const [resolvedMonoSearchItems, setResolvedMonoSearchItems] = useState<BangumiSearchMonoItem[]>([])
  const [discoverStatus, setDiscoverStatus] = useState("正在整理今日内容")
  const [resolvedCalendarDays, setResolvedCalendarDays] = useState<BangumiCalendarDay[]>(calendarDays)
  const [selectedCalendarIndex, setSelectedCalendarIndex] = useState(0)
  const [resolvedDiscoverSections, setResolvedDiscoverSections] = useState<BangumiDiscoverSection[]>(discoverSections)
  const [selectedDiscoverSubjectId, setSelectedDiscoverSubjectId] = useState<number | null>(null)
  const [selectedDiscoverSectionTitle, setSelectedDiscoverSectionTitle] = useState<string | null>(null)
  const [selectedSearchSubjectId, setSelectedSearchSubjectId] = useState<number | null>(null)
  const [selectedMonoTarget, setSelectedMonoTarget] = useState<BangumiSearchMonoItem | null>(null)

  useEffect(() => {
    async function refreshDiscover() {
      const data = await loadDiscoverViewData()
      setResolvedCalendarDays(data.calendarDays)
      setSelectedCalendarIndex(resolveTodayCalendarIndex(data.calendarDays))
      setResolvedDiscoverSections(data.discoverSections)
      setDiscoverStatus(data.message)
    }

    refreshDiscover()
  }, [])

  const searching = query.trim().length > 0

  function findDiscoverSubjectById(id: number | null) {
    if (typeof id !== "number") {
      return undefined
    }
    const calendarSubject = resolvedCalendarDays.flatMap((day) => day.subjects).find((subject) => subject.id === id)
    if (calendarSubject) {
      return calendarSubject
    }
    return resolvedDiscoverSections.flatMap((section) => section.items).find((subject) => subject.id === id)
  }

  function findSearchSubjectById(id: number | null) {
    return typeof id === "number" ? resolvedSearchSubjects.find((subject) => subject.id === id) : undefined
  }

  function findDiscoverSectionByTitle(title: string | null) {
    return title ? resolvedDiscoverSections.find((section) => section.title === title) : undefined
  }

  function openDiscoverSubjectId(subjectId: number) {
    setSelectedSearchSubjectId(null)
    setSelectedMonoTarget(null)
    setSelectedDiscoverSectionTitle(null)
    setSelectedDiscoverSubjectId(subjectId)
  }

  function openDiscoverSectionTitle(title: string) {
    setSelectedSearchSubjectId(null)
    setSelectedMonoTarget(null)
    setSelectedDiscoverSubjectId(null)
    setSelectedDiscoverSectionTitle(title)
  }

  function openSearchSubjectId(subjectId: number) {
    setSelectedDiscoverSubjectId(null)
    setSelectedDiscoverSectionTitle(null)
    setSelectedMonoTarget(null)
    setSelectedSearchSubjectId(subjectId)
  }

  function openMonoTarget(item: BangumiSearchMonoItem) {
    setSelectedDiscoverSubjectId(null)
    setSelectedDiscoverSectionTitle(null)
    setSelectedSearchSubjectId(null)
    setSelectedMonoTarget(item)
  }

  const selectedSearchSubject = findSearchSubjectById(selectedSearchSubjectId)
  const selectedDiscoverSubject = findDiscoverSubjectById(selectedDiscoverSubjectId)
  const selectedDiscoverSection = findDiscoverSectionByTitle(selectedDiscoverSectionTitle)
  const selectedCalendarDay = resolvedCalendarDays[selectedCalendarIndex]
  const calendarSubjectCount = resolvedCalendarDays.reduce((total, day) => total + day.subjects.length, 0)
  const discoverNavigationDestination = selectedSearchSubject
    ? renderSubjectDetail(selectedSearchSubject)
    : selectedMonoTarget
      ? renderMonoDetail(selectedMonoTarget)
      : selectedDiscoverSubject
        ? renderSubjectDetail(selectedDiscoverSubject)
        : selectedDiscoverSection
          ? <DiscoverSectionPage section={selectedDiscoverSection} openSubjectId={openDiscoverSubjectId} />
          : <BangumiEmptyState title="发现" subtitle="请选择一个条目" icon="safari.fill" />

  useEffect(() => {
    if (!searching) {
      setResolvedSearchSubjects([])
      setResolvedMonoSearchItems([])
      setSelectedSearchSubjectId(null)
      setSelectedMonoTarget(null)
      setSearchStatus("输入关键字搜索")
      return
    }

    if (searchType !== "条目") {
      setResolvedSearchSubjects([])
      setSelectedSearchSubjectId(null)

      if (!remote) {
        setResolvedMonoSearchItems([])
        setSelectedMonoTarget(null)
        setSearchStatus(`${searchType}搜索暂不可用，请稍后重试。`)
        return
      }

      let disposed = false
      setSearchStatus(`正在搜索${searchType}`)

      async function refreshMonoSearch() {
        const data = await loadMonoSearchViewData(query, searchType as "角色" | "人物")
        if (disposed) return
        setResolvedMonoSearchItems(data.items)
        setSelectedMonoTarget(null)
        setSearchStatus(data.message)
      }

      refreshMonoSearch()

      return () => {
        disposed = true
      }
    }

    setResolvedMonoSearchItems([])
    setSelectedMonoTarget(null)

    if (!remote) {
      const keyword = query.trim().toLowerCase()
      const localResults = subjects.filter((subject) => {
        const matchesType = subjectType === "全部" || subject.kind === subjectType
        const matchesKeyword =
          subject.title.toLowerCase().includes(keyword) ||
          subject.originalTitle.toLowerCase().includes(keyword) ||
          subject.tags.some((tag) => tag.toLowerCase().includes(keyword))
        return matchesType && matchesKeyword
      })
      setResolvedSearchSubjects(localResults)
      setSelectedSearchSubjectId(null)
      setSearchStatus(`已找到 ${localResults.length} 个本地结果，可继续在线搜索。`)
      return
    }

    let disposed = false
    setSearchStatus("正在搜索条目")

    async function refreshSearch() {
      const data = await loadSearchViewData(query, subjectType)
      if (disposed) return
      setResolvedSearchSubjects(data.subjects)
      setSelectedSearchSubjectId(null)
      setSearchStatus(data.message)
    }

    refreshSearch()

    return () => {
      disposed = true
    }
  }, [query, remote, searchType, subjectType, searching])

  return (
    <List
      navigationTitle="发现"
      navigationBarTitleDisplayMode="inline"
      searchable={{ value: query, onChanged: (value: string) => { setQuery(value); setRemote(true) }, prompt: "搜索条目，角色，人物" }}
      toolbar={{ topBarLeading: [closeButton] }}
      listStyle="inset"
      navigationDestination={{
        isPresented: selectedSearchSubjectId !== null || selectedMonoTarget !== null || selectedDiscoverSubjectId !== null || selectedDiscoverSectionTitle !== null,
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setSelectedSearchSubjectId(null)
            setSelectedMonoTarget(null)
            setSelectedDiscoverSubjectId(null)
            setSelectedDiscoverSectionTitle(null)
          }
        },
        content: discoverNavigationDestination,
      }}
    >
      {searching ? (
        <>
          <Section>
            <HeroCard
              title="搜索"
              subtitle="可在条目、角色与人物之间切换，快速查找你想看的内容。"
              accessory={<Button title={remote ? "本地索引" : "远程搜索"} systemImage={remote ? "internaldrive" : "globe"} action={() => setRemote(!remote)} />}
            />
          </Section>
          <Section title="搜索类型">
            <Picker title="搜索类型" value={searchType} onChanged={(value: string) => { setSearchType(value as (typeof searchTypes)[number]); setRemote(true) }}>
              {searchTypes.map((item) => (
                <Text key={item} tag={item}>{item}</Text>
              ))}
            </Picker>
            {searchType === "条目" ? (
              <Picker title="条目类型" value={subjectType} onChanged={(value: string) => { setSubjectType(value as (typeof searchSubjectTypes)[number]); setRemote(true) }}>
                {searchSubjectTypes.map((item) => (
                  <Text key={item} tag={item}>{item}</Text>
                ))}
              </Picker>
            ) : null}
            <BangumiInlineRow title="数据源" value={remote ? "远程" : "本地"} icon={remote ? "globe" : "internaldrive"} />
          </Section>
          <Section title={searchType === "条目" ? `${remote ? "远程" : "本地"}条目结果 · ${resolvedSearchSubjects.length}` : `${remote ? "远程" : "本地"}${searchType}结果 · ${resolvedMonoSearchItems.length}`}>
            {searchType === "条目" ? (
              resolvedSearchSubjects.length ? (
                resolvedSearchSubjects.map((subject) => (
                  <VStack key={subject.id} alignment="leading" spacing={0} onTapGesture={() => openSearchSubjectId(subject.id)}>
                    <ProgressListRow subject={subject} secondLineMode="条目信息" />
                  </VStack>
                ))
              ) : (
                <BangumiEmptyState title="没有结果" subtitle={searchStatus} icon="magnifyingglass" />
              )
            ) : (
              resolvedMonoSearchItems.length ? (
                resolvedMonoSearchItems.map((item) => (
                  <VStack key={`${item.kind}-${item.id}`} alignment="leading" spacing={0} onTapGesture={() => openMonoTarget(item)}>
                    <MonoSearchResultRow item={item} />
                  </VStack>
                ))
              ) : (
                <BangumiEmptyState title={remote ? "没有结果" : "等待远程搜索"} subtitle={searchStatus} icon={searchType === "角色" ? "person.crop.square" : "person.text.rectangle"} />
              )
            )}
            {(searchType === "条目" && resolvedSearchSubjects.length) || (searchType !== "条目" && resolvedMonoSearchItems.length) ? <Text font="footnote" foregroundStyle={bangumiLink}>{searchStatus}</Text> : null}
          </Section>
        </>
      ) : (
        <>
          <Section>
            <HeroCard
              title="发现"
              subtitle="按放送日浏览本周新番，并按类型查看当前热门条目。"
              accessory={
                <HStack spacing={8}>
                  <DiscoverMetricPill label={`${calendarSubjectCount} 部放送`} />
                  <DiscoverMetricPill label={`${resolvedDiscoverSections.length} 个分类`} subdued={true} />
                </HStack>
              }
            />
          </Section>

          <Section title="每日放送">
            <BangumiCard>
              <VStack alignment="leading" spacing={12}>
                <CalendarDayPicker days={resolvedCalendarDays} selectedIndex={selectedCalendarIndex} onSelect={setSelectedCalendarIndex} />
                {selectedCalendarDay ? (
                  <VStack alignment="leading" spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
                    <DiscoverSectionHeaderRow
                      title={selectedCalendarDay.label}
                      subtitle={`${selectedCalendarDay.subjects.length} 部放送中条目`}
                      trailing={<Text font="caption" foregroundStyle={bangumiLink}>{selectedCalendarDay.weekday}</Text>}
                    />
                    {selectedCalendarDay.subjects.map((subject) => (
                      <DiscoverTapRow key={subject.id} subject={subject} onOpen={openDiscoverSubjectId}>
                        <DiscoverAlignedRow subject={subject} />
                      </DiscoverTapRow>
                    ))}
                  </VStack>
                ) : (
                  <BangumiEmptyState title="暂无每日放送" subtitle="当前日期暂无可展示条目。" icon="calendar.badge.exclamationmark" />
                )}
              </VStack>
            </BangumiCard>
          </Section>

          <Section title="热门条目">
            {resolvedDiscoverSections.length ? (
              resolvedDiscoverSections.map((section) => (
                <DiscoverSectionPreview
                  key={section.title}
                  section={section}
                  openSubjectId={openDiscoverSubjectId}
                  openSectionTitle={openDiscoverSectionTitle}
                />
              ))
            ) : (
              <BangumiEmptyState title="暂无热门条目" subtitle="当前分区暂无可展示内容。" icon="chart.line.uptrend.xyaxis" />
            )}
          </Section>
        </>
      )}
    </List>
  )
}

function resolveTodayCalendarIndex(days: BangumiCalendarDay[]) {
  const todayIndex = days.findIndex((day) => day.label === "今天")
  return todayIndex >= 0 ? todayIndex : 0
}

function CalendarDayPicker({
  days,
  selectedIndex,
  onSelect,
}: {
  days: BangumiCalendarDay[]
  selectedIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
      {days.slice(0, 7).map((day, index) => {
        const targetIndex = index
        const selected = targetIndex === selectedIndex
        const shortLabel = shortCalendarLabel(day.label, day.weekday)
        return (
          <VStack
            key={`${day.weekday}-${day.label}`}
            alignment="center"
            spacing={3}
            frame={{ maxWidth: "infinity", minHeight: 52 }}
            padding={{ vertical: 7 }}
            background={selected ? (bangumiAccent as never) : bangumiMutedCard}
            clipShape={{ type: "rect", cornerRadius: 10 }}
            onTapGesture={() => onSelect(targetIndex)}
          >
            <Text font="subheadline" fontWeight="semibold" foregroundStyle={selected ? "white" : undefined}>{shortLabel}</Text>
            <Text font="caption2" foregroundStyle={selected ? "white" : "secondaryLabel"}>{day.weekday}</Text>
          </VStack>
        )
      })}
    </HStack>
  )
}

function DiscoverMetricPill({ label, subdued }: { label: string; subdued?: boolean }) {
  return (
    <Text
      font="caption"
      foregroundStyle={subdued ? "secondaryLabel" : (bangumiLink as never)}
      padding={{ horizontal: 9, vertical: 5 }}
      background={subdued ? bangumiMutedCard : bangumiLinkSoftBackground}
      clipShape={{ type: "capsule", style: "continuous" }}
    >
      {label}
    </Text>
  )
}

function shortCalendarLabel(label: string, weekday: string) {
  if (label === "今天") return "今"
  if (label === "明天") return "明"
  if (label.startsWith("周")) return label.slice(1, 2)
  return weekday.slice(0, 1)
}

function DiscoverTapRow({
  subject,
  onOpen,
  children,
}: {
  subject: BangumiSubject
  onOpen: (subjectId: number) => void
  children: JSX.Element
}) {
  const subjectId = subject.id
  return (
    <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", alignment: "leading" }} onTapGesture={() => onOpen(subjectId)}>
      {children}
    </VStack>
  )
}

function DiscoverSectionPage({
  section,
  openSubjectId,
}: {
  section: BangumiDiscoverSection
  openSubjectId: (subjectId: number) => void
}) {
  return (
    <List navigationTitle={section.title} navigationBarTitleDisplayMode="inline" listStyle="inset">
      <Section>
        <HeroCard
          title={`${section.title}热门条目`}
          subtitle="来自发现页真实热门接口的分类列表。点击条目进入详情。"
          accessory={<Text font="subheadline" foregroundStyle={bangumiLink}>{section.items.length} 项</Text>}
        />
      </Section>
      <Section title="条目">
        {section.items.map((subject) => (
          <DiscoverTapRow key={subject.id} subject={subject} onOpen={openSubjectId}>
            <DiscoverAlignedRow subject={subject} showsScore={true} />
          </DiscoverTapRow>
        ))}
      </Section>
    </List>
  )
}

function DiscoverSectionPreview({
  section,
  openSubjectId,
  openSectionTitle,
}: {
  section: BangumiDiscoverSection
  openSubjectId: (subjectId: number) => void
  openSectionTitle: (title: string) => void
}) {
  const visibleSubjects = section.items.slice(0, 5)

  return (
    <VStack padding={{ vertical: 4 }}>
      <BangumiCard>
        <VStack alignment="leading" spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <DiscoverSectionHeaderRow
            title={section.title}
            subtitle={`${section.items.length} 个热门条目`}
            trailing={<DiscoverMoreLink title={section.title} onOpen={openSectionTitle} />}
          />
          {visibleSubjects.length ? (
            <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity" }}>
              {visibleSubjects.map((subject) => (
                <DiscoverTapRow key={subject.id} subject={subject} onOpen={openSubjectId}>
                  <DiscoverAlignedRow subject={subject} />
                </DiscoverTapRow>
              ))}
            </VStack>
          ) : null}
        </VStack>
      </BangumiCard>
    </VStack>
  )
}

function DiscoverSectionHeaderRow({ title, subtitle, trailing }: { title: string; subtitle: string; trailing?: JSX.Element }) {
  return (
    <HStack alignment="top" spacing={discoverRowSpacing} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DiscoverRowLeadingSlot />
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
        <Text font="headline" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subtitle}</Text>
      </VStack>
      <Spacer />
      {trailing ?? null}
    </HStack>
  )
}

function DiscoverMoreLink({ title, onOpen }: { title: string; onOpen: (title: string) => void }) {
  const targetTitle = title
  return (
    <HStack
      spacing={3}
      padding={{ horizontal: 8, vertical: 5 }}
      frame={{ minWidth: 58, minHeight: 30, alignment: "trailing" }}
      background={bangumiLinkSoftBackground}
      clipShape={{ type: "capsule", style: "continuous" }}
      onTapGesture={() => onOpen(targetTitle)}
    >
      <Text font="footnote" foregroundStyle={bangumiLink} lineLimit={1}>更多</Text>
      <Image systemName="chevron.right" frame={{ width: 9 }} tint={bangumiLink} />
    </HStack>
  )
}

function DiscoverRowLeadingSlot() {
  return (
    <HStack frame={{ width: discoverRowPosterWidth, alignment: "topLeading" }}>
      <Spacer />
    </HStack>
  )
}

function DiscoverAlignedRow({ subject, showsScore }: { subject: BangumiSubject; showsScore?: boolean }) {
  return (
    <HStack alignment="top" spacing={discoverRowSpacing} padding={{ vertical: 6 }} frame={{ maxWidth: "infinity", minHeight: 72, alignment: "leading" }}>
      <PosterBlock subject={subject} width={discoverRowPosterWidth} height={discoverRowPosterHeight} />
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
        <Text font="subheadline" fontWeight="semibold" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{discoverSubjectMeta(subject)}</Text>
        <Text font="caption" foregroundStyle={bangumiLink} lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.collection}</Text>
      </VStack>
      <Spacer />
      {showsScore ? (
        <Text font="caption" foregroundStyle="secondaryLabel" multilineTextAlignment="trailing" frame={{ width: 36 }}>{subject.score.toFixed(1)}</Text>
      ) : null}
    </HStack>
  )
}

function discoverSubjectMeta(subject: BangumiSubject) {
  const meta = subject.meta.trim()
  if (meta && meta !== subject.progressLabel) {
    return meta
  }
  return `${subject.kind} · ${subject.progressLabel}`
}

function MonoSearchResultRow({ item }: { item: BangumiSearchMonoItem }) {
  return (
    <BangumiCard>
      <HStack alignment="top" spacing={12}>
        <AvatarCircle label={item.name.slice(0, 1)} size={42} imageUrl={item.imageUrl} />
        <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
          <HStack>
            <Text font="headline" lineLimit={1}>{item.name}</Text>
            <Spacer />
            <Text font="caption" foregroundStyle={bangumiAccent}>{item.kind}</Text>
          </HStack>
          {item.originalName !== item.name ? <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{item.originalName}</Text> : null}
          <Text font="caption" foregroundStyle={bangumiLink}>{item.meta}</Text>
          <Text font="body" lineLimit={3}>{item.summary}</Text>
        </VStack>
      </HStack>
    </BangumiCard>
  )
}

function NoticeCard({
  notice,
  openSubjectId,
  markRead,
}: {
  notice: BangumiNoticeItem
  openSubjectId: (subjectId: number) => void
  markRead: (noticeId: number) => void
}) {
  return (
    <BangumiCard>
      <VStack alignment="leading" spacing={10}>
        <HStack alignment="top" spacing={12}>
          <AvatarCircle label={notice.user.slice(0, 1)} size={40} />
          <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity" }}>
            <HStack>
              <Text font="headline" lineLimit={1}>{notice.title}</Text>
              <Spacer />
              {notice.unread ? <Text font="caption" foregroundStyle={bangumiAccent}>未读</Text> : null}
            </HStack>
            <Text font="subheadline" foregroundStyle="secondaryLabel">{notice.user} · {notice.time}</Text>
            <Text font="body" lineLimit={3}>{notice.detail}</Text>
          </VStack>
        </HStack>
        {notice.subject ? (
          <VStack alignment="leading" spacing={0} onTapGesture={() => notice.subject ? openSubjectId(notice.subject.id) : undefined}>
            <BangumiSubjectSnippet subject={notice.subject} />
          </VStack>
        ) : null}
        {notice.unread ? (
          <Button action={() => markRead(notice.id)}>
            <Label title="标记已读" systemImage="checkmark.circle" symbolRenderingMode="hierarchical" />
          </Button>
        ) : null}
      </VStack>
    </BangumiCard>
  )
}

