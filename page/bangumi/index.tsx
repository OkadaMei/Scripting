import {
  Button,
  Form,
  HStack,
  Image,
  Label,
  List,
  NavigationLink,
  NavigationStack,
  Picker,
  Script,
  ScrollView,
  Section,
  Spacer,
  Tab,
  TabView,
  Text,
  VStack,
  Widget,
  ZStack,
  useEffect,
  useState,
} from "scripting"
import {
  buildOAuthURL,
  clearBangumiOAuthDebugInfo,
  consumeBangumiOAuthCallback,
  ensureBangumiAuth,
  exchangeForAccessToken,
  getBangumiAppState,
  getBangumiClientCredentials,
  getBangumiClientSnapshot,
  getBangumiOAuthDebugInfo,
  listNotice,
  setBangumiAppState,
  setBangumiAuth,
  setBangumiAuthDomain,
  setBangumiClientCredentials,
  type BangumiAppState,
} from "./client"
import { loadCollectionSummaryData, loadEpisodeCommentData, loadIndexDetailData, loadMonoDetailData, loadRakuenViewData, loadReviewDetailData, loadSubjectDetailData, loadTopicDetailData, loadUserDetailData, loadUserSubjectTypeSummaryData, markEpisodeWatched, markEpisodesWatchedUntil, resetEpisodeWatched, syncSubjectProgressFromEpisodes, updateSubjectCollectionStatus } from "./store"
import { DiscoverPage, NoticePage, ProgressPage, TimelinePage } from "./pages-core"
import {
  AuthHeroCard,
  AvatarCircle,
  BangumiCard,
  BangumiEmptyState,
  BangumiInlineRow,
  BangumiPickerRow,
  BangumiSubjectSnippet,
  BangumiToggleRow,
  CompactSubjectCard,
  DiscoverCompactRow,
  FeatureSubjectCard,
  HeroCard,
  InfoSection,
  MetaBadge,
  PosterBlock,
  RakuenTopicRow,
  RankPill,
  ScorePill,
} from "./ui"
import {
  bangumiAppBackground,
  bangumiAccent,
  bangumiLink,
  bangumiLinkSoftBackground,
  bangumiMutedCard,
  bangumiNavBarBackground,
  currentUser,
  type BangumiSubject,
  type BangumiUser,
} from "./data"
import type { BangumiCollectionSummaryItem, BangumiCommentReply, BangumiRakuenCategory, BangumiRakuenMode, BangumiRakuenTopic, BangumiSearchMonoItem, BangumiSubjectCharacter, BangumiSubjectCollector, BangumiSubjectComment, BangumiSubjectEpisode, BangumiSubjectIndexItem, BangumiSubjectRelationItem, BangumiSubjectReview, BangumiSubjectTopic, BangumiSubjectTypeSummaryItem } from "./types"

type SubjectDetailNavigationTarget =
  | { kind: "subject"; subject: BangumiSubject }
  | { kind: "episode"; episode: BangumiSubjectEpisode; subject: BangumiSubject }
  | { kind: "topic"; topic: BangumiSubjectTopic; subject: BangumiSubject }
  | { kind: "review"; review: BangumiSubjectReview; subject: BangumiSubject }
  | { kind: "mono"; item: BangumiSearchMonoItem }
  | { kind: "index"; index: BangumiSubjectIndexItem }

type MonoDetailNavigationTarget =
  | { kind: "subject"; subject: BangumiSubject }
  | { kind: "mono"; item: BangumiSearchMonoItem }

const progressKinds = ["全部", "动画", "书籍", "音乐", "游戏", "三次元"] as const
type BangumiAppearanceMode = BangumiAppState["appearanceMode"]

declare function setString(string: string | null): Promise<void>

export function BangumiHomePage({ closeButton }: { closeButton: JSX.Element }) {
  const initialState = getBangumiAppState()
  const clientSnapshot = getBangumiClientSnapshot()
  const [selection, setSelection] = useState(0)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(clientSnapshot.hasAccessToken)
  const [isolationMode, setIsolationMode] = useState<boolean>(initialState.isolationMode)
  const [hasUnreadNotice, setHasUnreadNotice] = useState<boolean>(initialState.hasUnreadNotice)
  const [appearanceMode, setAppearanceMode] = useState<BangumiAppearanceMode>(initialState.appearanceMode)
  const [manualAppearanceMode, setManualAppearanceMode] = useState<"light" | "dark">(initialState.manualAppearanceMode)
  const [userAvatarLabel, setUserAvatarLabel] = useState("我")
  const [authStatusMessage, setAuthStatusMessage] = useState("")
  const [sessionRefreshTick, setSessionRefreshTick] = useState(0)

  function handleAuthenticatedChanged(value: boolean, message?: string) {
    setIsAuthenticated(value)
    setSessionRefreshTick((tick) => tick + 1)
    if (message) {
      setAuthStatusMessage(message)
    }
  }

  useEffect(() => {
    let disposed = false

    async function syncSessionFromSource(source: Record<string, any> | null | undefined, fallbackMessage?: string) {
      const callbackResult = await consumeBangumiOAuthCallback(source)
      if (disposed) return

      if (callbackResult.status !== "idle") {
        setAuthStatusMessage(callbackResult.message)
      } else if (fallbackMessage) {
        setAuthStatusMessage(fallbackMessage)
      }

      const auth = await ensureBangumiAuth()
      if (disposed) return
      const nextState = getBangumiAppState()
      setAppearanceMode(nextState.appearanceMode)
      setManualAppearanceMode(nextState.manualAppearanceMode)
      setIsAuthenticated(Boolean(auth?.accessToken))
      setSessionRefreshTick((value) => value + 1)
    }

    syncSessionFromSource(Script.queryParameters, clientSnapshot.hasAccessToken ? "已恢复本地会话" : "")

    const removeResume = Script.onResume((details: { resumeFromMinimized: boolean; queryParameters: Record<string, any> | null }) => {
      syncSessionFromSource(details.queryParameters, details.resumeFromMinimized ? "已从最小化状态恢复" : "")
    })

    return () => {
      disposed = true
      removeResume()
    }
  }, [])

  useEffect(() => {
    setBangumiAppState({ isAuthenticated, isolationMode, hasUnreadNotice, appearanceMode, manualAppearanceMode })
    Widget.reloadUserWidgets()
  }, [isAuthenticated, isolationMode, hasUnreadNotice, appearanceMode, manualAppearanceMode])

  useEffect(() => {
    if (!isAuthenticated) {
      setUserAvatarLabel("我")
      return
    }

    setUserAvatarLabel(currentUser.name.trim().slice(0, 1) || currentUser.account.trim().slice(0, 1) || "我")

    async function refreshAvatarLabel() {
      const data = await loadUserDetailData(currentUser.account, currentUser)
      const label = data.user.name.trim().slice(0, 1) || data.user.account.trim().slice(0, 1) || "我"
      setUserAvatarLabel(label)
    }

    refreshAvatarLabel()
  }, [isAuthenticated, sessionRefreshTick])

  useEffect(() => {
    if (!isAuthenticated || isolationMode) {
      setHasUnreadNotice(false)
      return
    }

    async function checkNotice() {
      try {
        const response = await listNotice(1, true)
        const container = response && typeof response === "object" ? (response as Record<string, any>) : null
        const list = Array.isArray(response)
          ? response
          : Array.isArray(container?.data)
            ? container?.data
            : Array.isArray(container?.items)
              ? container?.items
              : Array.isArray(container?.results)
                ? container?.results
                : []
        const total =
          typeof container?.total === "number"
            ? container.total
            : typeof container?.unread === "number"
              ? container.unread
              : typeof container?.count === "number"
                ? container.count
                : list.length
        setHasUnreadNotice(total > 0)
      } catch {
        setHasUnreadNotice(initialState.hasUnreadNotice)
      }
    }

    checkNotice()
  }, [isAuthenticated, isolationMode])

  return (
    <ZStack background={bangumiAppBackground} ignoresSafeArea={true}>
      <TabView
        selection={selection as never}
        tint={bangumiAccent}
        tabBarMinimizeBehavior="onScrollDown"
        toolbarBackground={{ style: bangumiNavBarBackground, bars: ["tabBar"] }}
        preferredColorScheme={appearanceMode === "system" ? undefined : appearanceMode}
      >
      <Tab title="时间线" systemImage="clock.arrow.circlepath" value={0}>
        <NavigationStack>
          <TimelinePage
            closeButton={closeButton}
            isAuthenticated={isAuthenticated}
            isolationMode={isolationMode}
            hasUnreadNotice={hasUnreadNotice}
            userAvatarLabel={userAvatarLabel}
            renderUserPage={() => <UserPage />}
            renderSubjectDetail={(subject) => <SubjectDetailPage key={subject.id} subject={subject} />}
            renderNoticePage={() => <NoticePage renderSubjectDetail={(subject) => <SubjectDetailPage key={subject.id} subject={subject} />} />}
          />
        </NavigationStack>
      </Tab>

      {isAuthenticated ? (
        <Tab title="进度" systemImage="square.grid.2x2.fill" value={1}>
          <NavigationStack>
            <ProgressPage
              closeButton={closeButton}
              isAuthenticated={isAuthenticated}
              renderSubjectDetail={(subject) => <SubjectDetailPage key={subject.id} subject={subject} />}
            />
          </NavigationStack>
        </Tab>
      ) : null}

      {!isolationMode ? (
        <Tab title="超展开" systemImage="bubble.left.and.bubble.right.fill" value={2}>
          <NavigationStack>
            <RakuenPage closeButton={closeButton} isAuthenticated={isAuthenticated} />
          </NavigationStack>
        </Tab>
      ) : null}

      <Tab title="设置" systemImage="gearshape.fill" value={3}>
        <NavigationStack>
          <SettingsPage
            closeButton={closeButton}
            isAuthenticated={isAuthenticated}
            authStatusMessage={authStatusMessage}
            sessionRefreshTick={sessionRefreshTick}
            onAuthenticatedChanged={handleAuthenticatedChanged}
          />
        </NavigationStack>
      </Tab>

      <Tab title="发现" systemImage="safari.fill" value={4}>
        <NavigationStack>
          <DiscoverPage
            key={`discover-${isAuthenticated ? "auth" : "guest"}-${sessionRefreshTick}`}
            closeButton={closeButton}
            renderSubjectDetail={(subject) => <SubjectDetailPage key={subject.id} subject={subject} />}
            renderMonoDetail={(item) => <MonoDetailPage item={item} renderSubjectDetail={(subject) => <SubjectDetailPage key={subject.id} subject={subject} />} />}
          />
        </NavigationStack>
      </Tab>
      </TabView>
    </ZStack>
  )
}

function RakuenPage({ closeButton, isAuthenticated }: { closeButton: JSX.Element; isAuthenticated: boolean }) {
  const [category, setCategory] = useState<BangumiRakuenCategory>("group")
  const [mode, setMode] = useState<BangumiRakuenMode>("groupAll")
  const [refreshTick, setRefreshTick] = useState(0)
  const [topics, setTopics] = useState<BangumiRakuenTopic[]>([])
  const [status, setStatus] = useState("正在加载超展开...")
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null)

  useEffect(() => {
    if (category === "subject" && !mode.startsWith("subject")) {
      setMode("subjectTrending")
    }
    if (category === "group" && !mode.startsWith("group")) {
      setMode("groupAll")
    }
  }, [category, mode])

  useEffect(() => {
    if (!isAuthenticated && ["groupJoined", "groupCreated", "groupReplied"].includes(mode)) {
      setMode("groupAll")
    }
  }, [isAuthenticated, mode])

  useEffect(() => {
    let disposed = false
    setStatus("正在加载超展开...")

    async function refreshRakuen() {
      const data = await loadRakuenViewData(mode)
      if (disposed) return
      setTopics(data.topics)
      setStatus(data.message)
    }

    refreshRakuen()

    return () => {
      disposed = true
    }
  }, [mode, refreshTick])

  const selectedTopic = selectedTopicKey ? topics.find((topic) => topic.topicKey === selectedTopicKey) ?? null : null
  const selectedSubject = buildRakuenTopicSubject(selectedTopic)
  const selectedSubjectTopic = selectedTopic ? buildRakuenSubjectTopic(selectedTopic) : null
  const modeOptions = getRakuenModeOptions(category, isAuthenticated)

  return (
    <List
      navigationTitle="超展开"
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        topBarLeading: [closeButton],
        topBarTrailing: [<Button key="reload" title="刷新" systemImage="arrow.clockwise" action={() => setRefreshTick((value) => value + 1)} />],
      }}
      listStyle="inset"
      navigationDestination={{
        isPresented: Boolean(selectedTopic && selectedSubject && selectedSubjectTopic),
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setSelectedTopicKey(null)
          }
        },
        content: selectedSubject && selectedSubjectTopic ? <TopicDetailPage topic={selectedSubjectTopic} subject={selectedSubject} /> : <VStack />,
      }}
    >
      <Section>
        <HeroCard
          title="超展开"
          subtitle="汇集小组与条目讨论，方便快速查看社区里的新话题。"
          accessory={<Text font="subheadline" foregroundStyle={bangumiLink}>{topics.length ? `${describeRakuenModeTitle(mode)} ${topics.length} 帖` : "正在同步"}</Text>}
        />
      </Section>

      <Section>
        <Picker title="分类" value={category} onChanged={(value: string) => setCategory(value as BangumiRakuenCategory)} pickerStyle="segmented">
          <Text tag="group">小组</Text>
          <Text tag="subject">条目</Text>
        </Picker>
        <Picker title="模式" value={mode} onChanged={(value: string) => setMode(value as BangumiRakuenMode)} pickerStyle="segmented">
          {modeOptions.map((option) => <Text key={option.value} tag={option.value}>{option.title}</Text>)}
        </Picker>
        {!isAuthenticated && category === "group" ? <Text font="caption" foregroundStyle="secondaryLabel">登录后可查看“我参加 / 我发表 / 我回复”的小组话题。</Text> : null}
        <Text font="footnote" foregroundStyle={status.includes("失败") ? ("red" as never) : bangumiLink}>{status}</Text>
      </Section>

      <Section title="公共讨论">
        {topics.length ? (
          topics.map((topic) => (
            <VStack key={topic.topicKey} alignment="leading" spacing={0} onTapGesture={() => setSelectedTopicKey(topic.topicKey)}>
              <RakuenTopicRow title={topic.title} group={topic.group} author={topic.author} replies={topic.replies} heat={topic.heat} time={topic.time} summary={topic.summary} />
            </VStack>
          ))
        ) : (
          <BangumiEmptyState title="暂无讨论" subtitle="当前范围没有可展示的话题。" icon="text.bubble.fill" />
        )}
      </Section>
    </List>
  )
}

function getRakuenModeOptions(category: BangumiRakuenCategory, isAuthenticated: boolean): Array<{ value: BangumiRakuenMode; title: string }> {
  if (category === "subject") {
    return [
      { value: "subjectTrending", title: "热门" },
      { value: "subjectLatest", title: "最新" },
    ]
  }

  return [
    { value: "groupAll", title: "所有" },
    ...(isAuthenticated ? [
      { value: "groupJoined" as const, title: "参加" },
      { value: "groupCreated" as const, title: "发表" },
      { value: "groupReplied" as const, title: "回复" },
    ] : []),
  ]
}

function describeRakuenModeTitle(mode: BangumiRakuenMode) {
  switch (mode) {
    case "subjectTrending":
      return "热门条目讨论"
    case "subjectLatest":
      return "最新条目讨论"
    case "groupJoined":
      return "我参加的小组话题"
    case "groupCreated":
      return "我发表的小组话题"
    case "groupReplied":
      return "我回复的小组话题"
    case "groupAll":
    default:
      return "所有小组话题"
  }
}

function buildRakuenSubjectTopic(topic: BangumiRakuenTopic): BangumiSubjectTopic {
  return {
    id: topic.id,
    topicType: topic.topicType,
    topicKey: topic.topicKey,
    url: topic.url,
    title: topic.title,
    user: topic.author,
    replies: topic.replies,
    time: topic.time,
  }
}

function buildRakuenTopicSubject(topic: BangumiRakuenTopic | null): BangumiSubject | null {
  if (!topic) {
    return null
  }

  return {
    id: 0,
    title: topic.group || "超展开",
    originalTitle: "Rakuen",
    kind: "动画",
    year: "",
    summary: topic.summary,
    score: 0,
    votes: 0,
    rank: 0,
    collection: "未收藏",
    progressLabel: "公共讨论",
    tags: ["超展开"],
    meta: topic.group,
    episodes: [],
    relations: [],
    cast: [],
    discussionCount: topic.replies,
    color: "rgba(240,145,153,0.18)",
    accent: bangumiAccent,
  }
}

function OAuthActionRow({
  title,
  systemImage,
  role,
  action,
}: {
  title: string
  systemImage: string
  role?: "destructive"
  action: () => void | Promise<void>
}) {
  return (
    <Button action={action} role={role}>
      <Label title={title} systemImage={systemImage} symbolRenderingMode="hierarchical" />
    </Button>
  )
}

function SettingsRowText({ title, subtitle, destructive }: { title: string; subtitle?: string; destructive?: boolean }) {
  return (
    <VStack alignment="leading" spacing={3}>
      <Text font="body" fontWeight="medium" lineLimit={1} foregroundStyle={destructive ? "systemRed" : undefined}>{title}</Text>
      {subtitle ? <Text font="footnote" foregroundStyle="secondaryLabel" lineLimit={2}>{subtitle}</Text> : null}
    </VStack>
  )
}

function SettingsValueText({ value, destructive, multiline }: { value: string; destructive?: boolean; multiline?: boolean }) {
  return (
    <Text
      font="body"
      foregroundStyle={destructive ? "systemRed" : "secondaryLabel"}
      lineLimit={multiline ? 3 : 1}
      multilineTextAlignment={multiline ? "trailing" : undefined}
    >
      {value}
    </Text>
  )
}

function SettingsStatusText({ children }: { children: string }) {
  return (
    <HStack spacing={12} padding={{ vertical: 2 }}>
      <HStack frame={{ width: 28 }}>
        <Spacer />
      </HStack>
      <Text font="footnote" foregroundStyle="secondaryLabel" lineLimit={3}>{children}</Text>
    </HStack>
  )
}

function SettingsRowIcon({ icon, destructive }: { icon: string; destructive?: boolean }) {
  return (
    <HStack frame={{ width: 28 }}>
      <Image systemName={icon} frame={{ width: 20 }} tint={destructive ? "systemRed" : bangumiAccent} />
      <Spacer />
    </HStack>
  )
}

function SettingsInlineRow({
  title,
  value,
  icon,
  subtitle,
  destructive,
  multilineValue,
}: {
  title: string
  value: string
  icon: string
  subtitle?: string
  destructive?: boolean
  multilineValue?: boolean
}) {
  return (
    <HStack spacing={12} padding={{ vertical: 8 }}>
      <SettingsRowIcon icon={icon} destructive={destructive} />
      <SettingsRowText title={title} subtitle={subtitle} destructive={destructive} />
      <Spacer />
      <SettingsValueText value={value} destructive={destructive} multiline={multilineValue} />
    </HStack>
  )
}

function SettingsToggleRow({
  title,
  subtitle,
  value,
  onChanged,
  icon,
}: {
  title: string
  subtitle: string
  value: boolean
  onChanged: (value: boolean) => void
  icon: string
}) {
  return (
    <HStack spacing={12} padding={{ vertical: 8 }}>
      <SettingsRowIcon icon={icon} />
      <SettingsRowText title={title} subtitle={subtitle} />
      <Spacer />
      <Picker title="" value={value ? "on" : "off"} onChanged={(next: string) => onChanged(next === "on")}>
        <Text tag="off" font="body">关闭</Text>
        <Text tag="on" font="body">开启</Text>
      </Picker>
    </HStack>
  )
}

function SettingsActionRow({
  title,
  subtitle,
  systemImage,
  role,
  action,
}: {
  title: string
  subtitle?: string
  systemImage: string
  role?: "destructive"
  action: () => void | Promise<void>
}) {
  const destructive = role === "destructive"
  return (
    <Button action={action} role={role}>
      <HStack spacing={12} padding={{ vertical: 8 }}>
        <SettingsRowIcon icon={systemImage} destructive={destructive} />
        <SettingsRowText title={title} subtitle={subtitle} destructive={destructive} />
        <Spacer />
      </HStack>
    </Button>
  )
}

function SettingsPage({
  closeButton,
  isAuthenticated,
  authStatusMessage,
  sessionRefreshTick,
  onAuthenticatedChanged,
}: {
  closeButton: JSX.Element
  isAuthenticated: boolean
  authStatusMessage: string
  sessionRefreshTick: number
  onAuthenticatedChanged: (value: boolean, message?: string) => void
}) {
  const [accountSummary, setAccountSummary] = useState<BangumiUser>(currentUser)
  const [accountCollectionSummary, setAccountCollectionSummary] = useState<BangumiCollectionSummaryItem[]>([])
  const [accountSummaryStatus, setAccountSummaryStatus] = useState(isAuthenticated ? "正在同步账户摘要" : "未登录")
  const displayAccountName = accountSummary.account.startsWith("@") ? accountSummary.account : `@${accountSummary.account}`
  const accountCollectionOverview = accountCollectionSummary.length
    ? accountCollectionSummary.slice(0, 3).map((item) => `${item.title} ${item.count}`).join(" · ")
    : accountSummary.collections.slice(0, 2).join(" · ")

  useEffect(() => {
    if (!isAuthenticated) {
      setAccountSummary(currentUser)
      setAccountCollectionSummary([])
      setAccountSummaryStatus("未登录")
      return
    }

    setAccountSummary(currentUser)
    setAccountCollectionSummary([])
    setAccountSummaryStatus("正在同步账户摘要")

    async function refreshAccountSummary() {
      const [userData, collectionData] = await Promise.all([
        loadUserDetailData(currentUser.account, currentUser),
        loadCollectionSummaryData(),
      ])
      setAccountSummary(userData.user)
      setAccountCollectionSummary(collectionData.items)
      setAccountSummaryStatus(`${userData.message} ${collectionData.message}`)
    }

    refreshAccountSummary()
  }, [isAuthenticated, sessionRefreshTick])

  return (
    <Form
      navigationTitle="设置"
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarLeading: [closeButton] }}
    >
      <Section title="连接">
        <NavigationLink destination={<ClientConfigPage onAuthenticatedChanged={onAuthenticatedChanged} />}> 
          <SettingsInlineRow title="授权配置" value="管理" icon="key.fill" subtitle="配置授权参数与登录状态。" />
        </NavigationLink>
        {authStatusMessage ? <SettingsStatusText>{authStatusMessage}</SettingsStatusText> : null}
      </Section>

      {isAuthenticated ? (
        <Section title="账户摘要">
          <SettingsInlineRow title="昵称" value={accountSummary.name} icon="person.crop.circle.fill" />
          <SettingsInlineRow title="用户名" value={displayAccountName} icon="at" />
          <SettingsInlineRow title="签名" value={accountSummary.motto || "暂无"} icon="quote.opening" multilineValue={true} />
          <SettingsInlineRow title="收藏概览" value={accountCollectionOverview || "暂无"} icon="square.grid.2x2.fill" subtitle={accountSummaryStatus} />
        </Section>
      ) : null}

      <Section title="登录状态">
        <SettingsInlineRow title="登录状态" value={isAuthenticated ? "已登录" : "未登录"} icon="person.crop.circle.badge.checkmark" />
      </Section>

      <Section title="关于">
        <SettingsInlineRow title="问题反馈" value="@SakuraAyane" icon="exclamationmark.bubble.fill" subtitle="Telegram" />
        <HStack>
          <Spacer />
          <Text font="footnote" foregroundStyle="tertiaryLabel">Bangumi</Text>
          <Spacer />
        </HStack>
      </Section>

      {isAuthenticated ? (
        <Section title="账户">
          <SettingsActionRow title="退出登录" subtitle="清除本机登录状态。" systemImage="rectangle.portrait.and.arrow.right" role="destructive" action={async () => {
            const confirmed = await Dialog.confirm({
              title: "退出登录",
              message: "将清除本机保存的登录凭据，并切换为未登录状态。",
              confirmLabel: "退出",
              cancelLabel: "取消",
            })
            if (!confirmed) return
            setBangumiAuth(null)
            onAuthenticatedChanged(false, "已退出登录")
          }} />
        </Section>
      ) : null}
    </Form>
  )
}

function ClientConfigPage({
  onAuthenticatedChanged,
}: {
  onAuthenticatedChanged: (value: boolean, message?: string) => void
}) {
  const [snapshot, setSnapshot] = useState(getBangumiClientSnapshot())
  const [debugInfo, setDebugInfo] = useState(getBangumiOAuthDebugInfo())
  const [statusMessage, setStatusMessage] = useState("尚未开始授权")
  const [didShowAuthorizationPrompt, setDidShowAuthorizationPrompt] = useState(false)
  const credentials = getBangumiClientCredentials()
  const authorizationURL = credentials.clientId && credentials.clientSecret ? buildOAuthURL(credentials.clientId) : ""

  useEffect(() => {
    let cancelled = false

    async function syncAuthorizationURLToClipboard() {
      if (!authorizationURL) {
        return
      }
      await setString(authorizationURL)
      if (!cancelled) {
        setStatusMessage("已自动把授权链接复制到剪贴板，可直接去外部浏览器粘贴打开。")
      }
    }

    syncAuthorizationURLToClipboard()

    return () => {
      cancelled = true
    }
  }, [authorizationURL])

  useEffect(() => {
    if (!authorizationURL || didShowAuthorizationPrompt) {
      return
    }

    setDidShowAuthorizationPrompt(true)
    Dialog.prompt({
      title: "授权链接",
      message: "这里直接弹窗展示完整授权链接。请长按或全选复制，然后去外部浏览器打开。",
      defaultValue: authorizationURL,
      selectAll: true,
      confirmLabel: "关闭",
      cancelLabel: "关闭",
    }).then(() => undefined)
  }, [authorizationURL, didShowAuthorizationPrompt])

  function reloadSnapshot(message?: string) {
    setSnapshot(getBangumiClientSnapshot())
    setDebugInfo(getBangumiOAuthDebugInfo())
    if (typeof message === "string") {
      setStatusMessage(message)
    }
  }

  async function editClientId() {
    const credentials = getBangumiClientCredentials()
    const value = await Dialog.prompt({
      title: "应用 ID",
      message: "填写你在服务端申请的应用 ID。",
      defaultValue: credentials.clientId,
      placeholder: "client_id",
      confirmLabel: "保存",
    })
    if (value === null) return
    setBangumiClientCredentials({ clientId: value.trim() })
    reloadSnapshot("已更新应用 ID")
  }

  async function editClientSecret() {
    const credentials = getBangumiClientCredentials()
    const value = await Dialog.prompt({
      title: "应用密钥",
      message: "填写应用密钥；仅保存在本机。",
      defaultValue: credentials.clientSecret,
      placeholder: "client_secret",
      obscureText: true,
      confirmLabel: "保存",
    })
    if (value === null) return
    setBangumiClientCredentials({ clientSecret: value.trim() })
    reloadSnapshot("已更新应用密钥")
  }

  async function editAuthDomain() {
    const value = await Dialog.prompt({
      title: "认证域名",
      message: "默认使用官方认证域名，通常无需修改。",
      defaultValue: snapshot.config.authDomain,
      placeholder: "next.bgm.tv",
      confirmLabel: "保存",
    })
    if (value === null) return
    const nextDomain = value.trim() || "next.bgm.tv"
    setBangumiAuthDomain(nextDomain)
    reloadSnapshot(`已切换认证域名：${nextDomain}`)
  }

  async function copyCallbackURL() {
    await setString(snapshot.config.callbackURL)
    reloadSnapshot("已复制回调地址，请在应用授权配置中保持一致。")
  }

  async function testCurrentSession() {
    try {
      const response = await listNotice(1, false)
      const total = typeof response?.total === "number" ? response.total : 0
      reloadSnapshot(`当前会话有效，可访问通知服务（${total} 条）。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      reloadSnapshot(`当前会话不可用：${message}`)
      await Dialog.alert({
        title: "会话测试失败",
        message: `当前仍未登录，请检查授权配置后重新尝试。\n\n错误信息：${message}`,
      })
    }
  }

  async function copyDebugInfo() {
    const payload = JSON.stringify(getBangumiOAuthDebugInfo(), null, 2)
    await setString(payload)
    reloadSnapshot("已复制授权诊断信息。")
  }

  async function clearDebugInfo() {
    clearBangumiOAuthDebugInfo()
    reloadSnapshot("已清空授权诊断信息。")
  }

  async function finishOAuthWithCallbackURL() {
    const callbackURL = await Dialog.prompt({
      title: "粘贴完整回调 URL",
      message: "把授权完成后的完整回调地址粘贴到这里，脚本会自动解析授权码。",
      placeholder: "scripting://run_single/Bangumi?...&code=...",
      confirmLabel: "解析并授权",
    })
    if (!callbackURL) return

    const matched = callbackURL.match(/[?&]code=([^&]+)/)
    if (!matched?.[1]) {
      await Dialog.alert({ title: "未找到授权码", message: "这段回调 URL 里没有找到 code 参数。" })
      reloadSnapshot("回调 URL 解析失败：未找到授权码")
      return
    }

    try {
      const credentials = getBangumiClientCredentials()
      const auth = await exchangeForAccessToken({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        code: decodeURIComponent(matched[1]),
      })
      if (!auth?.accessToken) {
        await Dialog.alert({ title: "授权失败", message: "授权服务未返回访问凭据。" })
        reloadSnapshot("回调 URL 授权失败：未获得访问凭据")
        return
      }
      onAuthenticatedChanged(true, "已通过回调 URL 完成授权。")
      reloadSnapshot("已通过回调 URL 完成授权。")
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      await Dialog.alert({ title: "回调 URL 授权失败", message })
      reloadSnapshot(`回调 URL 授权失败：${message}`)
    }
  }

  async function finishOAuthWithCode() {
    const credentials = getBangumiClientCredentials()
    if (!credentials.clientId || !credentials.clientSecret) {
      await Dialog.alert({ title: "缺少授权配置", message: "请先填写应用 ID 和应用密钥。" })
      return
    }

    const code = await Dialog.prompt({
      title: "粘贴授权码",
      message: "在浏览器授权完成后，将回调里的授权码手动粘贴到这里。",
      placeholder: "authorization_code",
      confirmLabel: "完成授权",
    })
    if (!code) return

    try {
      const auth = await exchangeForAccessToken({
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        code: code.trim(),
      })
      if (!auth?.accessToken) {
        await Dialog.alert({ title: "授权失败", message: "授权服务未返回访问凭据。" })
        reloadSnapshot("授权失败：未获得访问凭据")
        return
      }
      onAuthenticatedChanged(true, "授权成功，已保存登录状态。")
      reloadSnapshot("授权成功，已保存登录状态。")
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      await Dialog.alert({ title: "授权失败", message })
      reloadSnapshot(`授权失败：${message}`)
    }
  }

  async function clearAuth() {
    setBangumiAuth(null)
    onAuthenticatedChanged(false, "已清除本机登录")
    reloadSnapshot("已清除本机登录")
  }

  return (
    <Form navigationTitle="授权配置" navigationBarTitleDisplayMode="inline">
      <Section title="状态总览">
        <BangumiInlineRow title="授权状态" value={snapshot.hasAccessToken ? "已登录" : "未登录"} icon="person.crop.circle.badge.questionmark" />
        <BangumiInlineRow title="应用 ID" value={snapshot.hasClientId ? "已配置" : "未配置"} icon="number.square.fill" />
        <BangumiInlineRow title="应用密钥" value={snapshot.hasClientSecret ? "已配置" : "未配置"} icon="lock.square.fill" />
        <BangumiInlineRow title="认证域名" value={snapshot.config.authDomain} icon="checkmark.shield.fill" />
        <BangumiInlineRow title="回调地址" value={snapshot.config.callbackURL} icon="arrow.triangle.2.circlepath.circle.fill" />
        <BangumiInlineRow title="访问状态" value={snapshot.hasRefreshToken ? "可自动续期" : snapshot.hasAccessToken ? "当前有效" : "未授权"} icon="key.horizontal.fill" />
      </Section>

      <Section title="配置">
        <OAuthActionRow title="编辑应用 ID" systemImage="number" action={editClientId} />
        <OAuthActionRow title="编辑应用密钥" systemImage="lock" action={editClientSecret} />
        <OAuthActionRow title="编辑认证域名" systemImage="network" action={editAuthDomain} />
        <OAuthActionRow title="复制回调地址" systemImage="doc.on.doc" action={copyCallbackURL} />
      </Section>

      <Section title="授权入口">
        <Text font="footnote" foregroundStyle="secondaryLabel">进入本页时会自动复制授权链接，并弹出可全选文本框，方便直接去外部浏览器完成授权。</Text>
        <Text font="caption" foregroundStyle={bangumiLink} lineLimit={3}>{authorizationURL || "请先配置应用 ID 和应用密钥，授权链接才会生成。"}</Text>
        <Text font="footnote" foregroundStyle="secondaryLabel">回调地址</Text>
        <Text font="caption" foregroundStyle={bangumiLink} lineLimit={3}>{snapshot.config.callbackURL}</Text>
      </Section>

      <Section title="会话操作">
        <OAuthActionRow title="粘贴回调 URL 完成授权" systemImage="arrow.triangle.branch" action={finishOAuthWithCallbackURL} />
        <OAuthActionRow title="手动输入授权码" systemImage="key.viewfinder" action={finishOAuthWithCode} />
        <OAuthActionRow title="测试当前会话" systemImage="checkmark.shield" action={testCurrentSession} />
        <OAuthActionRow title="清除本机登录" systemImage="trash" role="destructive" action={clearAuth} />
      </Section>

      <Section title="诊断信息">
        <BangumiInlineRow title="最近更新时间" value={debugInfo.updatedAt ? new Date(debugInfo.updatedAt).toLocaleString() : "暂无"} icon="clock.badge.exclamationmark" />
        <OAuthActionRow title="复制诊断信息" systemImage="doc.on.doc.fill" action={copyDebugInfo} />
        <OAuthActionRow title="清空诊断信息" systemImage="eraser" action={clearDebugInfo} />
        <Text font="footnote" foregroundStyle="secondaryLabel">遇到授权问题时，可复制诊断信息用于排查；默认不会在页面中展开敏感内容。</Text>
      </Section>

      <Section title="说明">
        <Text font="footnote" foregroundStyle="secondaryLabel">“已配置应用 ID / 密钥”仅代表参数已保存；完成授权后才会显示为已登录。</Text>
        <Text font="footnote" foregroundStyle="secondaryLabel">如需重新授权，请确认回调地址与服务端配置保持一致。</Text>
        <Text font="footnote" foregroundStyle={bangumiLink}>{statusMessage}</Text>
      </Section>
    </Form>
  )
}

function MonoDetailPage({
  item,
  renderSubjectDetail,
}: {
  item: BangumiSearchMonoItem
  renderSubjectDetail: (subject: BangumiSubject) => JSX.Element
}) {
  const [resolvedItem, setResolvedItem] = useState(item)
  const [relatedSubjects, setRelatedSubjects] = useState<BangumiSubject[]>([])
  const [relatedMonos, setRelatedMonos] = useState<BangumiSearchMonoItem[]>([])
  const [navigationTarget, setNavigationTarget] = useState<MonoDetailNavigationTarget | null>(null)
  const [monoStatus, setMonoStatus] = useState(`使用搜索结果中的${item.kind}摘要`)

  useEffect(() => {
    async function refreshMonoDetail() {
      const data = await loadMonoDetailData(item)
      setResolvedItem(data.item)
      setRelatedSubjects(data.relatedSubjects)
      setRelatedMonos(data.relatedMonos)
      setMonoStatus(data.message)
    }

    refreshMonoDetail()
  }, [item.id, item.kind])

  const monoNavigationDestination = navigationTarget?.kind === "subject"
    ? renderSubjectDetail(navigationTarget.subject)
    : navigationTarget?.kind === "mono"
      ? <MonoDetailPage key={`${navigationTarget.item.kind}-${navigationTarget.item.id}`} item={navigationTarget.item} renderSubjectDetail={renderSubjectDetail} />
      : <BangumiEmptyState title="详情" subtitle="请选择要查看的内容" icon="person.crop.circle" />

  return (
    <ScrollView
      navigationTitle={resolvedItem.name}
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="mono-menu" title="更多" systemImage="ellipsis" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
      navigationDestination={{
        isPresented: Boolean(navigationTarget),
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setNavigationTarget(null)
          }
        },
        content: monoNavigationDestination,
      }}
    >
      <VStack alignment="leading" spacing={16}>
        <BangumiCard>
          <HStack alignment="top" spacing={14}>
            <AvatarCircle label={resolvedItem.name.slice(0, 1)} size={68} imageUrl={resolvedItem.imageUrl} />
            <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity" }}>
              <Text font="title3" fontWeight="bold">{resolvedItem.name}</Text>
              {resolvedItem.originalName !== resolvedItem.name ? <Text font="subheadline" foregroundStyle="secondaryLabel">{resolvedItem.originalName}</Text> : null}
              <MetaBadge label={resolvedItem.kind} tint={bangumiAccent} />
              <Text font="subheadline" foregroundStyle="secondaryLabel">{resolvedItem.meta}</Text>
              <HStack spacing={8}>
                <MetaBadge label={`${resolvedItem.collects} 收藏`} tint={bangumiLink.light} subdued={true} />
                <MetaBadge label={`${resolvedItem.comments} 吐槽`} tint={bangumiAccent} subdued={true} />
              </HStack>
            </VStack>
          </HStack>
        </BangumiCard>

        <InfoSection title="同步状态">
          <Text font="footnote" foregroundStyle={bangumiLink}>{monoStatus}</Text>
        </InfoSection>

        <InfoSection title="简介">
          <Text font="body">{resolvedItem.summary}</Text>
        </InfoSection>

        <InfoSection title={resolvedItem.kind === "角色" ? "出演作品" : "参与作品"}>
          <VStack alignment="leading" spacing={10}>
            {relatedSubjects.length ? (
              relatedSubjects.map((subject) => (
                <VStack key={subject.id} onTapGesture={() => setNavigationTarget({ kind: "subject", subject })}>
                  <BangumiSubjectSnippet subject={subject} />
                </VStack>
              ))
            ) : (
              <BangumiEmptyState title="暂无关联条目" subtitle="当前还没有可展示的作品关联。" icon="rectangle.stack.fill.badge.person.crop" />
            )}
          </VStack>
        </InfoSection>

        <InfoSection title={resolvedItem.kind === "角色" ? "关联角色" : "关联人物"}>
          <VStack alignment="leading" spacing={10}>
            {relatedMonos.length ? (
              relatedMonos.map((mono) => (
                <VStack key={`${mono.kind}-${mono.id}`} onTapGesture={() => setNavigationTarget({ kind: "mono", item: mono })}>
                  <MonoInlineSnippet mono={mono} />
                </VStack>
              ))
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">暂无可展示关联。</Text>
            )}
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

function MonoInlineSnippet({ mono }: { mono: BangumiSearchMonoItem }) {
  return (
    <HStack
      alignment="center"
      spacing={10}
      padding={10}
      background={bangumiMutedCard}
      clipShape={{ type: "rect", cornerRadius: 10 }}
    >
      <AvatarCircle label={mono.name.slice(0, 1)} size={36} imageUrl={mono.imageUrl} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity" }}>
        <Text font="subheadline" fontWeight="medium" lineLimit={1}>{mono.name}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{mono.originalName !== mono.name ? mono.originalName : mono.role}</Text>
      </VStack>
      <Text font="caption" foregroundStyle={bangumiAccent}>{mono.kind}</Text>
    </HStack>
  )
}

function SubjectDetailPage({ subject }: { subject: BangumiSubject }) {
  const [resolvedSubject, setResolvedSubject] = useState<BangumiSubject>(subject)
  const [episodes, setEpisodes] = useState<BangumiSubjectEpisode[]>([])
  const [comments, setComments] = useState<BangumiSubjectComment[]>([])
  const [topics, setTopics] = useState<BangumiSubjectTopic[]>([])
  const [reviews, setReviews] = useState<BangumiSubjectReview[]>([])
  const [collectors, setCollectors] = useState<BangumiSubjectCollector[]>([])
  const [characters, setCharacters] = useState<BangumiSubjectCharacter[]>([])
  const [relations, setRelations] = useState<BangumiSubjectRelationItem[]>([])
  const [recommendations, setRecommendations] = useState<BangumiSubject[]>([])
  const [indexes, setIndexes] = useState<BangumiSubjectIndexItem[]>([])
  const [showSubjectIndexes, setShowSubjectIndexes] = useState(false)
  const [navigationTarget, setNavigationTarget] = useState<SubjectDetailNavigationTarget | null>(null)
  const [subjectStatus, setSubjectStatus] = useState("正在准备条目详情")
  const [collectionActionStatus, setCollectionActionStatus] = useState("选择收藏状态后会同步到账号")
  const [episodeActionStatus, setEpisodeActionStatus] = useState("可在章节行标记单话或批量更新看到这里")
  const [isUpdatingCollection, setIsUpdatingCollection] = useState(false)
  const [updatingEpisodeId, setUpdatingEpisodeId] = useState<number | null>(null)

  function openSubjectDetail(nextSubject: BangumiSubject) {
    setNavigationTarget({ kind: "subject", subject: nextSubject })
  }

  function openEpisodeDetail(episode: BangumiSubjectEpisode) {
    setNavigationTarget({ kind: "episode", episode, subject: resolvedSubject })
  }

  function openTopicDetail(topic: BangumiSubjectTopic) {
    setNavigationTarget({ kind: "topic", topic, subject: resolvedSubject })
  }

  function openReviewDetail(review: BangumiSubjectReview) {
    setNavigationTarget({ kind: "review", review, subject: resolvedSubject })
  }

  function openMonoDetail(item: BangumiSearchMonoItem) {
    setNavigationTarget({ kind: "mono", item })
  }

  function openIndexDetail(index: BangumiSubjectIndexItem) {
    setNavigationTarget({ kind: "index", index })
  }

  async function applyCollectionStatus(collection: string) {
    if (isUpdatingCollection || collection === resolvedSubject.collection) {
      return
    }

    setIsUpdatingCollection(true)
    setCollectionActionStatus(`正在更新为「${collection}」...`)
    try {
      const updated = await updateSubjectCollectionStatus(resolvedSubject, collection)
      setResolvedSubject(updated)
      setCollectionActionStatus(`已更新收藏状态：${collection}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      setCollectionActionStatus(`收藏状态更新失败：${message}`)
    } finally {
      setIsUpdatingCollection(false)
    }
  }

  async function applyEpisodeWatched(episode: BangumiSubjectEpisode) {
    if (updatingEpisodeId) return
    setUpdatingEpisodeId(episode.id)
    setEpisodeActionStatus(`正在标记「${episode.name}」为看过...`)
    try {
      const updatedEpisode = await markEpisodeWatched(resolvedSubject.id, episode)
      const nextEpisodes = episodes.map((item) => item.id === updatedEpisode.id ? updatedEpisode : item)
      setEpisodes(nextEpisodes)
      setResolvedSubject(syncSubjectProgressFromEpisodes(resolvedSubject, nextEpisodes))
      setEpisodeActionStatus(`已标记「${episode.name}」为看过`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      setEpisodeActionStatus(`章节进度更新失败：${message}`)
    } finally {
      setUpdatingEpisodeId(null)
    }
  }

  async function applyEpisodeWatchedUntil(episode: BangumiSubjectEpisode) {
    if (updatingEpisodeId) return
    setUpdatingEpisodeId(episode.id)
    setEpisodeActionStatus(`正在批量标记看到 EP ${episode.sort || episode.id}...`)
    try {
      const nextEpisodes = await markEpisodesWatchedUntil(resolvedSubject.id, episodes, episode)
      setEpisodes(nextEpisodes)
      setResolvedSubject(syncSubjectProgressFromEpisodes(resolvedSubject, nextEpisodes))
      setEpisodeActionStatus(`已标记看到 EP ${episode.sort || episode.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      setEpisodeActionStatus(`批量更新失败：${message}`)
    } finally {
      setUpdatingEpisodeId(null)
    }
  }

  async function applyEpisodeReset(episode: BangumiSubjectEpisode) {
    if (updatingEpisodeId) return
    setUpdatingEpisodeId(episode.id)
    setEpisodeActionStatus(`正在取消「${episode.name}」看过标记...`)
    try {
      const updatedEpisode = await resetEpisodeWatched(resolvedSubject.id, episode)
      const nextEpisodes = episodes.map((item) => item.id === updatedEpisode.id ? updatedEpisode : item)
      setEpisodes(nextEpisodes)
      setResolvedSubject(syncSubjectProgressFromEpisodes(resolvedSubject, nextEpisodes))
      setEpisodeActionStatus(`已取消「${episode.name}」看过标记`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误"
      setEpisodeActionStatus(`取消进度失败：${message}`)
    } finally {
      setUpdatingEpisodeId(null)
    }
  }

  useEffect(() => {
    setResolvedSubject(subject)
    setEpisodes([])
    setComments([])
    setTopics([])
    setReviews([])
    setCollectors([])
    setCharacters([])
    setRelations([])
    setRecommendations([])
    setIndexes([])
    setShowSubjectIndexes(false)
    setNavigationTarget(null)
    setSubjectStatus("正在同步条目详情与当前账号收藏状态")
    setCollectionActionStatus("正在读取当前账号收藏状态")
    setEpisodeActionStatus("正在同步章节进度")

    async function refreshSubjectDetail() {
      const data = await loadSubjectDetailData(subject)
      setResolvedSubject(data.subject)
      setEpisodes(data.episodes)
      setComments(data.comments)
      setTopics(data.topics)
      setReviews(data.reviews)
      setCollectors(data.collectors)
      setCharacters(data.characters)
      setRelations(data.relations)
      setRecommendations(data.recommendations)
      setIndexes(data.indexes)
      setSubjectStatus(data.message)
      setCollectionActionStatus(data.subject.collection === "未收藏" ? "当前账号未收藏此条目" : `已同步当前账号状态：${data.subject.collection}`)
      setEpisodeActionStatus(data.episodes.length ? "可在章节行标记单话或批量更新看到这里" : "暂无可同步章节")
    }

    refreshSubjectDetail()
  }, [subject.id])

  const subjectNavigationDestination = navigationTarget?.kind === "subject"
    ? <SubjectDetailPage key={navigationTarget.subject.id} subject={navigationTarget.subject} />
    : navigationTarget?.kind === "episode"
      ? <EpisodeDetailPage key={navigationTarget.episode.id} episode={navigationTarget.episode} subject={navigationTarget.subject} />
      : navigationTarget?.kind === "topic"
        ? <TopicDetailPage key={navigationTarget.topic.id} topic={navigationTarget.topic} subject={navigationTarget.subject} />
        : navigationTarget?.kind === "review"
          ? <ReviewDetailPage key={navigationTarget.review.id} review={navigationTarget.review} subject={navigationTarget.subject} />
          : navigationTarget?.kind === "mono"
          ? <MonoDetailPage key={`${navigationTarget.item.kind}-${navigationTarget.item.id}`} item={navigationTarget.item} renderSubjectDetail={(nextSubject) => <SubjectDetailPage key={nextSubject.id} subject={nextSubject} />} />
          : navigationTarget?.kind === "index"
            ? <IndexDetailPage key={navigationTarget.index.id} index={navigationTarget.index} openSubject={openSubjectDetail} />
            : <BangumiEmptyState title="详情" subtitle="请选择要查看的内容" icon="rectangle.stack.fill" />

  const subjectChineseTitle = resolvedSubject.chineseTitle && resolvedSubject.chineseTitle !== resolvedSubject.title ? resolvedSubject.chineseTitle : undefined
  const subjectSecondaryTitle = getSecondaryDisplayTitle(resolvedSubject.title, resolvedSubject.originalTitle)
  const subjectOriginalTitle = subjectSecondaryTitle && subjectSecondaryTitle !== subjectChineseTitle ? subjectSecondaryTitle : undefined

  return (
    <ScrollView
      navigationTitle={resolvedSubject.title}
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="subject-menu" title="更多" systemImage="ellipsis" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
      navigationDestination={{
        isPresented: Boolean(navigationTarget),
        onChanged: (isPresented: boolean) => {
          if (!isPresented) {
            setNavigationTarget(null)
          }
        },
        content: subjectNavigationDestination,
      }}
    >
      <VStack alignment="leading" spacing={16}>
        <BangumiCard>
          <HStack alignment="top" spacing={14}>
            <PosterBlock subject={resolvedSubject} width={94} height={128} />
            <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity" }}>
              <Text font="title3" fontWeight="bold" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{resolvedSubject.title}</Text>
              {subjectChineseTitle ? (
                <Text font="title3" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subjectChineseTitle}</Text>
              ) : null}
              {subjectOriginalTitle ? (
                <Text font="subheadline" foregroundStyle="secondaryLabel" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subjectOriginalTitle}</Text>
              ) : null}
              <MetaBadge label={resolvedSubject.kind} tint={resolvedSubject.accent} />
              <Text font="subheadline" foregroundStyle="secondaryLabel">{resolvedSubject.meta}</Text>
              <HStack spacing={8}>
                <ScorePill score={resolvedSubject.score} votes={resolvedSubject.votes} />
                <RankPill rank={resolvedSubject.rank} />
              </HStack>
              <Text font="footnote" foregroundStyle={bangumiLink}>{resolvedSubject.collection} · {resolvedSubject.progressLabel}</Text>
            </VStack>
          </HStack>
        </BangumiCard>

        <InfoSection title="同步状态">
          <Text font="footnote" foregroundStyle={bangumiLink}>{subjectStatus}</Text>
        </InfoSection>

        <InfoSection title="收藏状态">
          <DetailInfoRow title="当前状态" value={resolvedSubject.collection} icon="books.vertical.fill" tint={resolvedSubject.accent} />
          <DetailInfoRow title="观看进度" value={resolvedSubject.progressLabel} icon="play.circle.fill" tint={resolvedSubject.accent} />
          <CollectionActionPanel
            current={resolvedSubject.collection}
            disabled={isUpdatingCollection}
            status={collectionActionStatus}
            accent={resolvedSubject.accent}
            onSelect={applyCollectionStatus}
          />
        </InfoSection>

        {(resolvedSubject.kind === "动画" || resolvedSubject.kind === "三次元") ? (
          <InfoSection title="章节进度">
            <VStack alignment="leading" spacing={10}>
              <DetailStatusLine status={episodeActionStatus} accent={resolvedSubject.accent} />
              {episodes.slice(0, 8).map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  subject={resolvedSubject}
                  episode={episode}
                  accent={resolvedSubject.accent}
                  disabled={Boolean(updatingEpisodeId)}
                  onWatched={applyEpisodeWatched}
                  onWatchedUntil={applyEpisodeWatchedUntil}
                  onReset={applyEpisodeReset}
                  onOpen={openEpisodeDetail}
                />
              ))}
            </VStack>
          </InfoSection>
        ) : null}

        <InfoSection title="简介">
          <Text font="body">{resolvedSubject.summary}</Text>
        </InfoSection>

        {resolvedSubject.kind === "音乐" ? (
          <InfoSection title="曲目 / Disc">
            <VStack alignment="leading" spacing={10}>
              {episodes.map((episode) => (
                <BangumiInlineRow key={episode.id} title={episode.name} value={episode.type} icon="music.note.list" />
              ))}
            </VStack>
          </InfoSection>
        ) : (
          <InfoSection title="角色 / 人物">
            <VStack alignment="leading" spacing={10}>
              {characters.length ? (
                characters.map((item) => (
                  <SubjectCharacterCard key={item.id} item={item} onOpenMono={openMonoDetail} />
                ))
              ) : resolvedSubject.cast.length ? (
                <HStack spacing={10}>
                  {resolvedSubject.cast.map((role) => (
                    <VStack
                      key={role}
                      alignment="leading"
                      spacing={4}
                      frame={{ maxWidth: "infinity" }}
                      padding={{ horizontal: 10, vertical: 12 }}
                      background={bangumiMutedCard}
                      clipShape={{ type: "rect", cornerRadius: 10 }}
                    >
                      <Image systemName="person.crop.square.fill" tint={bangumiAccent} />
                      <Text font="subheadline">{role}</Text>
                    </VStack>
                  ))}
                </HStack>
              ) : (
                <Text font="footnote" foregroundStyle="secondaryLabel">暂无可展示的角色或人物。</Text>
              )}
            </VStack>
          </InfoSection>
        )}

        {resolvedSubject.kind === "书籍" && relations.length ? (
          <InfoSection title="系列 / 单行本">
            <VStack alignment="leading" spacing={10}>
              {relations.slice(0, 4).map((item) => (
                <VStack key={`book-${item.id}`} alignment="leading" spacing={0} onTapGesture={() => openSubjectDetail(item.subject)}>
                  <RelatedSubjectRow item={item} />
                </VStack>
              ))}
            </VStack>
          </InfoSection>
        ) : null}

        <InfoSection title="关联条目">
          <VStack alignment="leading" spacing={10}>
            {relations.length ? (
              relations.map((item) => (
                <VStack key={item.id} alignment="leading" spacing={0} onTapGesture={() => openSubjectDetail(item.subject)}>
                  <RelatedSubjectRow item={item} />
                </VStack>
              ))
            ) : resolvedSubject.relations.length ? (
              resolvedSubject.relations.map((relation) => (
                <BangumiInlineRow key={relation} title={relation} value="待同步" icon="rectangle.stack.fill.badge.plus" />
              ))
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">暂无可展示的关联条目。</Text>
            )}
          </VStack>
        </InfoSection>

        <InfoSection title="推荐条目">
          <VStack alignment="leading" spacing={10}>
            {recommendations.length ? (
              recommendations.map((item) => (
                <VStack key={item.id} alignment="leading" spacing={0} onTapGesture={() => openSubjectDetail(item)}>
                  <RecommendedSubjectRow subject={item} />
                </VStack>
              ))
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">暂无可展示的推荐条目。</Text>
            )}
          </VStack>
        </InfoSection>

        <InfoSection title="收录目录">
          <VStack alignment="leading" spacing={10}>
            <BangumiToggleRow
              title="收藏目录"
              subtitle={showSubjectIndexes ? "显示收录目录分区" : "已隐藏收录目录分区"}
              value={showSubjectIndexes}
              onChanged={setShowSubjectIndexes}
              icon="list.bullet.rectangle.fill"
            />
            {showSubjectIndexes ? (
              indexes.length ? (
                indexes.map((item) => <VStack key={item.id} alignment="leading" spacing={0} onTapGesture={() => openIndexDetail(item)}><SubjectIndexRow item={item} /></VStack>)
              ) : (
                <Text font="footnote" foregroundStyle="secondaryLabel">暂无可展示的收录目录。</Text>
              )
            ) : null}
          </VStack>
        </InfoSection>

        <InfoSection title="收藏用户">
          <VStack alignment="leading" spacing={10}>
            {collectors.length ? (
              collectors.map((collector) => <SubjectCollectorRow key={collector.id} collector={collector} accent={resolvedSubject.accent} />)
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">暂无可展示的收藏用户。</Text>
            )}
          </VStack>
        </InfoSection>

        <InfoSection title="长评">
          <VStack alignment="leading" spacing={10}>
            {reviews.length ? (
              reviews.map((review) => (
                <VStack key={review.id} alignment="leading" spacing={0} onTapGesture={() => openReviewDetail(review)}>
                  <SubjectReviewRow review={review} accent={resolvedSubject.accent} />
                </VStack>
              ))
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">当前条目暂无长评。</Text>
            )}
          </VStack>
        </InfoSection>

        <InfoSection title="短评">
          <VStack alignment="leading" spacing={10}>
            {comments.length ? (
              comments.map((comment) => <SubjectCommentRow key={comment.id} comment={comment} accent={resolvedSubject.accent} />)
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">当前条目暂无短评。</Text>
            )}
          </VStack>
        </InfoSection>

        <InfoSection title="讨论版">
          <VStack alignment="leading" spacing={10}>
            {topics.length ? (
              topics.map((topic) => (
                <VStack key={topic.id} alignment="leading" spacing={0} onTapGesture={() => openTopicDetail(topic)}>
                  <SubjectTopicRow topic={topic} />
                </VStack>
              ))
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">当前条目暂无讨论主题。</Text>
            )}
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

const collectionStatusOptions = ["想看", "在看", "看过", "搁置", "抛弃"]

const collectionStatusIcons: Record<string, string> = {
  想看: "bookmark.fill",
  在看: "play.circle.fill",
  看过: "checkmark.circle.fill",
  搁置: "pause.circle.fill",
  抛弃: "xmark.circle.fill",
}

const detailRowLeadingWidth = 58
const detailRowSpacing = 12
const detailActionBackground = bangumiLinkSoftBackground
const detailDisabledActionBackground = bangumiMutedCard

function getSecondaryDisplayTitle(primary: string, secondary?: string) {
  const normalizedPrimary = primary.trim()
  const normalizedSecondary = secondary?.trim()
  if (!normalizedSecondary || normalizedSecondary === normalizedPrimary) {
    return undefined
  }
  return normalizedSecondary
}

function joinDetailMeta(items: Array<string | undefined>) {
  return items.filter((item) => item && item !== "mock").join(" · ")
}

function detailTintBackground(tint: string) {
  return tint.startsWith("#") ? `${tint}22` : detailActionBackground
}

function DetailLeadingSlot({ children }: { children?: JSX.Element }) {
  if (children) {
    return (
      <HStack frame={{ width: detailRowLeadingWidth, alignment: "center" }}>
        {children}
      </HStack>
    )
  }

  return (
    <HStack frame={{ width: detailRowLeadingWidth }}>
      <Spacer />
    </HStack>
  )
}

function DetailIconSlot({ systemName, tint }: { systemName: string; tint?: string }) {
  return (
    <DetailLeadingSlot>
      <Image systemName={systemName} frame={{ width: 22 }} tint={(tint ?? bangumiAccent) as never} />
    </DetailLeadingSlot>
  )
}

function DetailTextColumn({ children, spacing }: { children: JSX.Element | JSX.Element[]; spacing?: number }) {
  return (
    <VStack alignment="leading" spacing={spacing ?? 3} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
      {children}
    </VStack>
  )
}

function DetailInfoRow({ title, value, icon, tint }: { title: string; value: string; icon: string; tint?: string }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 6 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailIconSlot systemName={icon} tint={tint} />
      <Text font="body" fontWeight="medium" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>{title}</Text>
      <Spacer />
      <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="trailing">{value}</Text>
    </HStack>
  )
}

function DetailStatusLine({ status, accent }: { status: string; accent: string }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 2 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot />
      <Text
        font="footnote"
        foregroundStyle={status.includes("失败") ? ("red" as never) : (accent as never)}
        lineLimit={3}
        multilineTextAlignment="leading"
        frame={{ maxWidth: "infinity", alignment: "leading" }}
      >
        {status}
      </Text>
    </HStack>
  )
}

function DetailActionChip({
  title,
  systemImage,
  selected,
  disabled,
  destructive,
  accent,
  onPress,
}: {
  title: string
  systemImage: string
  selected?: boolean
  disabled?: boolean
  destructive?: boolean
  accent: string
  onPress: () => void
}) {
  const foreground = destructive ? "systemRed" : selected ? accent : disabled ? "secondaryLabel" : bangumiLink
  const background = selected ? detailTintBackground(accent) : disabled ? detailDisabledActionBackground : detailActionBackground

  return (
    <HStack
      spacing={5}
      padding={{ horizontal: 8, vertical: 6 }}
      frame={{ minHeight: 32, maxWidth: "infinity", alignment: "center" }}
      background={background as never}
      clipShape={{ type: "capsule", style: "continuous" }}
      onTapGesture={() => {
        if (!disabled) {
          onPress()
        }
      }}
    >
      <Image systemName={systemImage} frame={{ width: 13 }} tint={foreground as never} />
      <Text font="caption" fontWeight={selected ? "semibold" : undefined} foregroundStyle={foreground as never} lineLimit={1}>{title}</Text>
    </HStack>
  )
}

function DetailChevronAccessory({ label }: { label: string }) {
  return (
    <HStack spacing={4} frame={{ minWidth: 48, alignment: "trailing" }}>
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="trailing">{label}</Text>
      <Image systemName="chevron.right" frame={{ width: 8 }} tint="secondaryLabel" />
    </HStack>
  )
}

function CollectionActionPanel({
  current,
  disabled,
  status,
  accent,
  onSelect,
}: {
  current: string
  disabled: boolean
  status: string
  accent: string
  onSelect: (collection: string) => void
}) {
  return (
    <VStack alignment="leading" spacing={10} padding={{ top: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <HStack alignment="top" spacing={detailRowSpacing} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <DetailLeadingSlot />
        <DetailTextColumn spacing={8}>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>快速修改收藏状态</Text>
          <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            {collectionStatusOptions.map((option) => (
              <DetailActionChip
                key={option}
                title={option}
                systemImage={collectionStatusIcons[option] ?? "circle.fill"}
                selected={option === current}
                disabled={disabled || option === current}
                accent={accent}
                onPress={() => onSelect(option)}
              />
            ))}
          </HStack>
        </DetailTextColumn>
      </HStack>
      <DetailStatusLine status={status} accent={accent} />
    </VStack>
  )
}

function EpisodeRow({
  subject,
  episode,
  accent,
  disabled,
  onWatched,
  onWatchedUntil,
  onReset,
  onOpen,
}: {
  subject: BangumiSubject
  episode: BangumiSubjectEpisode
  accent: string
  disabled: boolean
  onWatched: (episode: BangumiSubjectEpisode) => void
  onWatchedUntil: (episode: BangumiSubjectEpisode) => void
  onReset: (episode: BangumiSubjectEpisode) => void
  onOpen: (episode: BangumiSubjectEpisode) => void
}) {
  const watched = episode.collection === "看过"
  const episodeLabel = watched ? "看过" : episode.sort ? `EP ${episode.sort}` : episode.type
  const secondaryName = getSecondaryDisplayTitle(episode.name, episode.originalName)
  const episodeMeta = joinDetailMeta([secondaryName, episode.type, episode.airdate, episode.duration]) || "章节信息待同步"
  return (
    <VStack alignment="leading" spacing={8} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <HStack alignment="top" spacing={detailRowSpacing} frame={{ maxWidth: "infinity", alignment: "leading" }} onTapGesture={() => onOpen(episode)}>
        <DetailLeadingSlot>
          <Text
            font="caption"
            fontWeight="semibold"
            foregroundStyle={watched ? (accent as never) : (bangumiLink as never)}
            lineLimit={1}
            multilineTextAlignment="center"
            frame={{ width: 52, alignment: "center" }}
            padding={{ horizontal: 6, vertical: 5 }}
            background={(watched ? detailTintBackground(accent) : detailActionBackground) as never}
            clipShape={{ type: "capsule", style: "continuous" }}
          >
            {episodeLabel}
          </Text>
        </DetailLeadingSlot>
        <DetailTextColumn spacing={3}>
          <Text font="subheadline" fontWeight="medium" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{episode.name}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{episodeMeta}</Text>
        </DetailTextColumn>
        <DetailChevronAccessory label={episode.comment ? `${episode.comment} 评` : "评论"} />
      </HStack>
      <HStack alignment="top" spacing={detailRowSpacing} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <DetailLeadingSlot />
        <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <DetailActionChip title={watched ? "已看过" : "看过"} systemImage={watched ? "checkmark.circle.fill" : "circle"} selected={watched} disabled={disabled || watched} accent={accent} onPress={() => onWatched(episode)} />
          <DetailActionChip title="看到这里" systemImage="forward.end.fill" disabled={disabled} accent={accent} onPress={() => onWatchedUntil(episode)} />
          {watched ? <DetailActionChip title="取消" systemImage="arrow.uturn.backward" destructive={true} disabled={disabled} accent={accent} onPress={() => onReset(episode)} /> : null}
        </HStack>
      </HStack>
    </VStack>
  )
}

function EpisodeDetailPage({ episode, subject }: { episode: BangumiSubjectEpisode; subject: BangumiSubject }) {
  const [replies, setReplies] = useState<BangumiCommentReply[]>([])
  const [status, setStatus] = useState("正在加载每话评论...")

  useEffect(() => {
    async function refreshEpisodeComments() {
      const data = await loadEpisodeCommentData(episode)
      setReplies(data.replies)
      setStatus(data.message)
    }

    refreshEpisodeComments()
  }, [episode.id])

  return (
    <ScrollView
      navigationTitle={episode.name}
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="episode-reply" title="回复" systemImage="square.and.pencil" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
    >
      <VStack alignment="leading" spacing={16}>
        <VStack alignment="leading" spacing={8} padding={{ horizontal: 2 }}>
          <Text font="caption" foregroundStyle={bangumiLink}>EP {episode.sort}</Text>
          <Text font="title2" fontWeight="bold">{episode.name}</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel">{joinDetailMeta([subject.title, getSecondaryDisplayTitle(episode.name, episode.originalName), episode.type, episode.airdate, episode.duration])}</Text>
          <Text font="footnote" foregroundStyle={bangumiLink}>当前状态：{episode.collection} · {episode.comment || replies.length} 条每话评论</Text>
        </VStack>

        <InfoSection title="每话评论">
          <VStack alignment="leading" spacing={12}>
            <Text font="footnote" foregroundStyle={bangumiLink}>{status}</Text>
            {replies.length ? (
              replies.map((reply) => <ReplyCard key={reply.id} reply={reply} accent={subject.accent} />)
            ) : (
              <BangumiEmptyState title="暂无评论" subtitle="当前章节还没有评论。" icon="ellipsis.message.fill" />
            )}
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

function TopicDetailPage({ topic, subject }: { topic: BangumiSubjectTopic; subject: BangumiSubject }) {
  const [resolvedTopic, setResolvedTopic] = useState(topic)
  const [content, setContent] = useState("正在加载正文...")
  const [replies, setReplies] = useState<BangumiCommentReply[]>([])
  const [status, setStatus] = useState("正在加载讨论回复...")

  useEffect(() => {
    async function refreshTopicDetail() {
      const data = await loadTopicDetailData(topic, topic.topicType ?? (subject.id === 0 ? "group" : "subject"))
      setResolvedTopic(data.topic)
      setContent(data.content)
      setReplies(data.replies)
      setStatus(data.message)
    }

    refreshTopicDetail()
  }, [topic.id, topic.topicType])

  return (
    <ScrollView
      navigationTitle="讨论版"
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="topic-reply" title="回复" systemImage="square.and.pencil" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
    >
      <VStack alignment="leading" spacing={16}>
        <VStack alignment="leading" spacing={8} padding={{ horizontal: 2 }}>
          <Text font="title2" fontWeight="bold">{resolvedTopic.title}</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel">{topic.topicType === "group" ? "超展开" : subject.title}</Text>
          <Text font="footnote" foregroundStyle={bangumiLink}>{resolvedTopic.user} · {resolvedTopic.time} · {resolvedTopic.replies || replies.length} 回复</Text>
        </VStack>

        <InfoSection title="正文">
          <Text font="body">{content}</Text>
        </InfoSection>

        <InfoSection title="回复">
          <VStack alignment="leading" spacing={12}>
            <Text font="footnote" foregroundStyle={bangumiLink}>{status}</Text>
            {replies.length ? (
              replies.map((reply) => <ReplyCard key={reply.id} reply={reply} accent={subject.accent} />)
            ) : (
              <BangumiEmptyState title="暂无回复" subtitle="当前主题还没有回复。" icon="text.bubble.fill" />
            )}
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

function ReviewDetailPage({ review, subject }: { review: BangumiSubjectReview; subject: BangumiSubject }) {
  const [resolvedReview, setResolvedReview] = useState(review)
  const [status, setStatus] = useState("正在加载长评完整正文...")

  useEffect(() => {
    setResolvedReview(review)
    setStatus("正在加载长评完整正文...")

    async function refreshReviewDetail() {
      const data = await loadReviewDetailData(subject.id, review)
      setResolvedReview(data.review)
      setStatus(data.message)
    }

    refreshReviewDetail()
  }, [review.id, subject.id])

  return (
    <ScrollView
      navigationTitle="长评"
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="review-reply" title="回复" systemImage="square.and.pencil" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
    >
      <VStack alignment="leading" spacing={16}>
        <VStack alignment="leading" spacing={8} padding={{ horizontal: 2 }}>
          <Text font="title2" fontWeight="bold">{resolvedReview.title}</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel">{subject.title}</Text>
          <HStack spacing={8}>
            <AvatarCircle label={resolvedReview.user.slice(0, 1)} size={28} imageUrl={resolvedReview.avatarUrl} />
            <Text font="footnote" foregroundStyle={bangumiLink}>{resolvedReview.user} · {resolvedReview.time} · {resolvedReview.replies} 回复</Text>
          </HStack>
        </VStack>

        <InfoSection title="正文">
          <VStack alignment="leading" spacing={10}>
            <Text font="footnote" foregroundStyle={status.includes("失败") ? ("red" as never) : "secondaryLabel"}>{status}</Text>
            <Text font="body">{resolvedReview.content || resolvedReview.summary}</Text>
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

function ReplyCard({ reply, accent }: { reply: BangumiCommentReply; accent: string }) {
  return (
    <HStack alignment="top" spacing={10} padding={{ vertical: 8 }}>
      <AvatarCircle label={reply.user.slice(0, 1)} size={34} imageUrl={reply.avatarUrl} />
      <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
        <HStack spacing={8}>
          <Text font="subheadline" fontWeight="medium">{reply.user}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">#{reply.floor}</Text>
          <Spacer />
          <Text font="caption" foregroundStyle="secondaryLabel">{reply.time}</Text>
        </HStack>
        <Text font="body">{reply.content}</Text>
      </VStack>
    </HStack>
  )
}

function SubjectCollectorRow({ collector, accent }: { collector: BangumiSubjectCollector; accent: string }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot>
        <AvatarCircle label={collector.nickname.slice(0, 1)} size={34} imageUrl={collector.avatarUrl} />
      </DetailLeadingSlot>
      <DetailTextColumn spacing={5}>
        <HStack alignment="top" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="subheadline" fontWeight="medium" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>{collector.nickname}</Text>
          <MetaBadge label={collector.collection} tint={accent} subdued={true} />
          {collector.score ? <MetaBadge label={`${collector.score} 分`} tint={bangumiAccent} subdued={true} /> : null}
        </HStack>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>@{collector.username} · {collector.time}</Text>
        {collector.comment ? <Text font="footnote" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{collector.comment}</Text> : <Text font="footnote" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>暂无收藏备注</Text>}
      </DetailTextColumn>
    </HStack>
  )
}

function SubjectReviewRow({ review, accent }: { review: BangumiSubjectReview; accent: string }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot>
        <AvatarCircle label={review.user.slice(0, 1)} size={34} imageUrl={review.avatarUrl} />
      </DetailLeadingSlot>
      <DetailTextColumn spacing={5}>
        <HStack alignment="top" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="subheadline" fontWeight="medium" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>{review.title}</Text>
          <MetaBadge label={`${review.replies} 回复`} tint={accent} subdued={true} />
        </HStack>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{review.user} · {review.time}</Text>
        <Text font="body" lineLimit={3} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{review.summary}</Text>
      </DetailTextColumn>
    </HStack>
  )
}

function SubjectCommentRow({ comment, accent }: { comment: BangumiSubjectComment; accent: string }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot>
        <AvatarCircle label={comment.user.slice(0, 1)} size={34} imageUrl={comment.avatarUrl} />
      </DetailLeadingSlot>
      <DetailTextColumn spacing={5}>
        <HStack alignment="top" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="subheadline" fontWeight="medium" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>{comment.user}</Text>
          {comment.score ? <MetaBadge label={`${comment.score} 分`} tint={accent} subdued={true} /> : null}
        </HStack>
        <Text font="body" multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{comment.content}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{comment.time}</Text>
      </DetailTextColumn>
    </HStack>
  )
}

function SubjectCharacterCard({
  item,
  onOpenMono,
}: {
  item: BangumiSubjectCharacter
  onOpenMono: (item: BangumiSearchMonoItem) => void
}) {
  const actor = item.actors[0]
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot>
        <VStack alignment="leading" spacing={0} onTapGesture={() => onOpenMono(item.character)}>
          <AvatarCircle label={item.character.name.slice(0, 1)} size={48} imageUrl={item.character.imageUrl} />
        </VStack>
      </DetailLeadingSlot>
      <DetailTextColumn spacing={7}>
        <HStack alignment="top" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
            <Text font="subheadline" fontWeight="medium" lineLimit={1} foregroundStyle={bangumiLink} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }} onTapGesture={() => onOpenMono(item.character)}>{item.character.name}</Text>
            {item.character.originalName !== item.character.name ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.character.originalName}</Text> : null}
          </VStack>
          <MetaBadge label={item.role} tint={bangumiAccent} subdued={true} />
        </HStack>
        {actor ? (
          <HStack spacing={8} padding={{ horizontal: 8, vertical: 6 }} background={bangumiMutedCard} clipShape={{ type: "rect", cornerRadius: 8 }} onTapGesture={() => onOpenMono(actor)}>
            <AvatarCircle label={actor.name.slice(0, 1)} size={28} imageUrl={actor.imageUrl} />
            <VStack alignment="leading" spacing={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font="caption" foregroundStyle={bangumiLink} lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{actor.name}</Text>
              <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{actor.originalName !== actor.name ? actor.originalName : "出演人物"}</Text>
            </VStack>
            <Image systemName="chevron.right" frame={{ width: 8 }} tint="secondaryLabel" />
          </HStack>
        ) : (
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>暂无关联人物 / 声优</Text>
        )}
      </DetailTextColumn>
    </HStack>
  )
}

function RelatedSubjectRow({ item }: { item: BangumiSubjectRelationItem }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot>
        <PosterBlock subject={item.subject} width={42} height={56} />
      </DetailLeadingSlot>
      <DetailTextColumn spacing={4}>
        <Text font="subheadline" fontWeight="medium" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.subject.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.subject.originalTitle}</Text>
        <Text font="caption" foregroundStyle={bangumiLink} lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.relation} · {item.subject.kind}</Text>
      </DetailTextColumn>
      <DetailChevronAccessory label="查看" />
    </HStack>
  )
}

function RecommendedSubjectRow({ subject }: { subject: BangumiSubject }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailLeadingSlot>
        <PosterBlock subject={subject} width={42} height={56} />
      </DetailLeadingSlot>
      <DetailTextColumn spacing={4}>
        <Text font="subheadline" fontWeight="medium" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.summary}</Text>
        <Text font="caption" foregroundStyle={bangumiLink} lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.kind} · {subject.score.toFixed(1)}</Text>
      </DetailTextColumn>
      <DetailChevronAccessory label="查看" />
    </HStack>
  )
}

function SubjectIndexRow({ item }: { item: BangumiSubjectIndexItem }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailIconSlot systemName="list.bullet.rectangle.fill" />
      <DetailTextColumn spacing={4}>
        <Text font="subheadline" fontWeight="medium" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{item.description}</Text>
      </DetailTextColumn>
      <DetailChevronAccessory label={item.total ? `${item.total} 条` : "目录"} />
    </HStack>
  )
}

function SubjectTopicRow({ topic }: { topic: BangumiSubjectTopic }) {
  return (
    <HStack alignment="top" spacing={detailRowSpacing} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <DetailIconSlot systemName="text.bubble.fill" />
      <DetailTextColumn spacing={4}>
        <Text font="subheadline" fontWeight="medium" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{topic.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{topic.user} · {topic.time}</Text>
      </DetailTextColumn>
      <DetailChevronAccessory label={`${topic.replies} 回复`} />
    </HStack>
  )
}

function IndexDetailPage({ index, openSubject }: { index: BangumiSubjectIndexItem; openSubject: (subject: BangumiSubject) => void }) {
  const [resolvedIndex, setResolvedIndex] = useState(index)
  const [indexSubjects, setIndexSubjects] = useState<BangumiSubject[]>([])
  const [status, setStatus] = useState("正在加载目录详情...")

  useEffect(() => {
    let disposed = false
    setResolvedIndex(index)
    setIndexSubjects([])
    setStatus("正在加载目录详情...")

    async function refreshIndexDetail() {
      const data = await loadIndexDetailData(index)
      if (disposed) return
      setResolvedIndex(data.index)
      setIndexSubjects(data.subjects)
      setStatus(data.message)
    }

    refreshIndexDetail()

    return () => {
      disposed = true
    }
  }, [index.id])

  return (
    <ScrollView
      navigationTitle="目录"
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="index-more" title="更多" systemImage="ellipsis" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
    >
      <VStack alignment="leading" spacing={16}>
        <BangumiCard>
          <VStack alignment="leading" spacing={8}>
            <HStack spacing={10}>
              <Image systemName="list.bullet.rectangle.fill" tint={bangumiAccent} />
              <Text font="title3" fontWeight="bold" lineLimit={2}>{resolvedIndex.title}</Text>
            </HStack>
            <Text font="body">{resolvedIndex.description}</Text>
            <Text font="footnote" foregroundStyle={bangumiLink}>{resolvedIndex.total || indexSubjects.length ? `${resolvedIndex.total || indexSubjects.length} 个条目` : "目录条目待同步"}</Text>
          </VStack>
        </BangumiCard>

        <InfoSection title="同步状态">
          <Text font="footnote" foregroundStyle={bangumiLink}>{status}</Text>
        </InfoSection>

        <InfoSection title="收录条目">
          <VStack alignment="leading" spacing={10}>
            {indexSubjects.length ? (
              indexSubjects.map((subject) => (
                <VStack key={subject.id} alignment="leading" spacing={0} onTapGesture={() => openSubject(subject)}>
                  <BangumiSubjectSnippet subject={subject} />
                </VStack>
              ))
            ) : (
              <BangumiEmptyState title="暂无条目" subtitle="当前目录没有公开条目。" icon="list.bullet.rectangle.fill" />
            )}
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

function UserPage() {
  const [resolvedUser, setResolvedUser] = useState(currentUser)
  const [userStatus, setUserStatus] = useState("正在准备用户信息")
  const [userCollectionSummary, setUserCollectionSummary] = useState<BangumiSubjectTypeSummaryItem[]>([])
  const [userCollectionStatus, setUserCollectionStatus] = useState("正在同步真实收藏摘要")

  useEffect(() => {
    let disposed = false

    async function refreshUserDetail() {
      setUserStatus("正在同步真实用户详情")
      setUserCollectionStatus("正在同步真实收藏摘要")
      const [userData, collectionData] = await Promise.all([
        loadUserDetailData(currentUser.account, currentUser),
        loadUserSubjectTypeSummaryData(currentUser.account),
      ])

      if (disposed) return
      setResolvedUser(userData.user)
      setUserCollectionSummary(collectionData.items)
      setUserStatus(userData.message)
      setUserCollectionStatus(collectionData.message)
    }

    refreshUserDetail()

    return () => {
      disposed = true
    }
  }, [])

  return (
    <ScrollView
      navigationTitle={`${resolvedUser.name}的时光机`}
      navigationBarTitleDisplayMode="inline"
      toolbar={{ topBarTrailing: [<Button key="user-menu" title="更多" systemImage="ellipsis" action={() => undefined} />] }}
      padding={{ horizontal: 16, vertical: 14 }}
    >
      <VStack alignment="leading" spacing={16}>
        <BangumiCard>
          <HStack alignment="top" spacing={14}>
            <AvatarCircle label={resolvedUser.name.slice(0, 1)} size={68} />
            <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
              <Text font="title3" fontWeight="bold">{resolvedUser.name}</Text>
              <Text font="footnote" foregroundStyle="secondaryLabel">@{resolvedUser.account}</Text>
              <Text font="subheadline">{resolvedUser.motto}</Text>
            </VStack>
          </HStack>
        </BangumiCard>

        <InfoSection title="同步状态">
          <VStack alignment="leading" spacing={4}>
            <Text font="footnote" foregroundStyle={bangumiLink}>{userStatus}</Text>
            <Text font="footnote" foregroundStyle="secondaryLabel">{userCollectionStatus}</Text>
          </VStack>
        </InfoSection>

        <InfoSection title="收藏摘要">
          <VStack alignment="leading" spacing={10}>
            {userCollectionSummary.length ? (
              userCollectionSummary.map((item) => (
                <BangumiInlineRow key={item.title} title={item.title} value={`${item.count}`} icon="square.grid.2x2.fill" />
              ))
            ) : (
              <Text font="footnote" foregroundStyle="secondaryLabel">{userCollectionStatus}</Text>
            )}
          </VStack>
        </InfoSection>
      </VStack>
    </ScrollView>
  )
}

