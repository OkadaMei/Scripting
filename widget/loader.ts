import { Script } from "scripting"
import {
  getBangumiAppState,
  getBangumiAuth,
  getSubjectCollections,
  listNotice,
  loadCalendar,
  loadRakuenTopics,
} from "../page/bangumi/client"
import type { BangumiWidgetData, BangumiWidgetSubject, BangumiWidgetTopic } from "./types"

const SCRIPT_NAME = "Bangumi Beta"
const WIDGET_CACHE_KEY = "bangumi.widget.remoteSnapshot"
const DEFAULT_ACCENT = "#F09199"
const COLLECTION_TYPES = {
  wish: 1,
  completed: 2,
  active: 3,
  hold: 4,
  dropped: 5,
} as const

type WidgetSnapshot = Omit<BangumiWidgetData, "openURL">
type WidgetLoadResult = {
  data: BangumiWidgetData
  cacheable: boolean
}

type CollectionPayload = {
  subjects: BangumiWidgetSubject[]
  total: number
}

export async function loadBangumiWidgetData(): Promise<BangumiWidgetData> {
  const openURL = Script.createRunSingleURLScheme(SCRIPT_NAME, { source: "widget" })
  const appState = getBangumiAppState()
  const hasAuth = Boolean(getBangumiAuth()?.accessToken)

  const result = hasAuth
    ? await loadRemoteWidgetData(appState, openURL)
    : await loadGuestWidgetData(appState, openURL)

  if (result.cacheable && result.data.sourceState === "remote") {
    writeCachedSnapshot(result.data)
  }

  return result.data
}

async function loadRemoteWidgetData(appState: ReturnType<typeof getBangumiAppState>, openURL: string): Promise<WidgetLoadResult> {
  const now = new Date()
  const [activeResult, completedResult, totalResult, calendarResult, topicResult, noticeResult] = await Promise.all([
    safeLoadCollection({ type: COLLECTION_TYPES.active, limit: 5, offset: 0 }),
    safeLoadCollection({ type: COLLECTION_TYPES.completed, limit: 1, offset: 0 }),
    safeLoadCollection({ limit: 1, offset: 0 }),
    safeLoadTodayCalendarSubjects(),
    safeLoadTopics(),
    safeLoadNoticeCount(),
  ])

  const activeSubjects = activeResult.value?.subjects ?? []
  const primary = activeSubjects[0]
  const todaySubjects = calendarResult.value?.subjects ?? []
  const todayCount = calendarResult.value?.total ?? 0
  const topics = topicResult.value ?? []
  const noticeCount = noticeResult.value ?? 0
  const hasAnyRemote = Boolean(
    activeResult.ok ||
      completedResult.ok ||
      totalResult.ok ||
      calendarResult.ok ||
      topicResult.ok ||
      noticeResult.ok,
  )

  if (!hasAnyRemote) {
    const cached = readCachedSnapshot(openURL, appState)
    if (cached) {
      return { data: cached, cacheable: false }
    }
    return {
      data: buildUnavailableData(openURL, appState, "同步失败", "暂时无法连接 Bangumi", "打开 App 后下拉刷新，或检查 OAuth / 网络状态。", "error"),
      cacheable: false,
    }
  }

  const watchingCount = activeResult.value?.total ?? activeSubjects.length
  const completedCount = completedResult.value?.total ?? 0
  const totalCount = totalResult.value?.total ?? watchingCount + completedCount
  const sourceState = activeResult.ok && calendarResult.ok ? "remote" : "partial"
  const syncLabel = sourceState === "remote" ? "实时同步" : "部分同步"

  return {
    data: {
      openURL,
      todayLabel: formatTodayLabel(now),
      dateLabel: formatWidgetDate(now),
      updatedAtLabel: `更新 ${formatWidgetTime(now)}`,
      sourceState,
      sourceLabel: syncLabel,
      accountLabel: appState.isAuthenticated ? "已登录" : "已授权",
      noticeLabel: noticeCount > 0 ? `${noticeCount} 未读` : "无未读",
      themeLabel: appState.appearanceMode === "system" ? "跟随系统" : appState.appearanceMode === "dark" ? "固定深色" : "固定浅色",
      focusLabel: appState.isolationMode ? "专注" : "社区",
      progressText: watchingCount ? `${watchingCount} 个条目正在推进` : "当前没有在看的收藏",
      emptyTitle: watchingCount ? "" : "没有正在推进的条目",
      emptySubtitle: "在条目详情里标记“在看/在读/在玩”后会显示在这里。",
      watchingCount,
      completedCount,
      todayCount,
      totalCount,
      primary,
      upcoming: activeSubjects.slice(primary ? 1 : 0, primary ? 3 : 2),
      todaySubjects,
      topics,
    },
    cacheable: sourceState === "remote",
  }
}

async function loadGuestWidgetData(appState: ReturnType<typeof getBangumiAppState>, openURL: string): Promise<WidgetLoadResult> {
  const cached = readCachedSnapshot(openURL, appState)
  if (cached) {
    return { data: cached, cacheable: false }
  }

  const calendarResult = await safeLoadTodayCalendarSubjects()
  const topicsResult = await safeLoadTopics()
  const now = new Date()
  const hasPublicRemote = Boolean(calendarResult.ok || topicsResult.ok)

  return {
    data: {
      openURL,
      todayLabel: formatTodayLabel(now),
      dateLabel: formatWidgetDate(now),
      updatedAtLabel: hasPublicRemote ? `更新 ${formatWidgetTime(now)}` : "等待登录",
      sourceState: hasPublicRemote ? "partial" : "empty",
      sourceLabel: hasPublicRemote ? "公开数据" : "未登录",
      accountLabel: "访客模式",
      noticeLabel: "需登录",
      themeLabel: appState.appearanceMode === "system" ? "跟随系统" : appState.appearanceMode === "dark" ? "固定深色" : "固定浅色",
      focusLabel: appState.isolationMode ? "专注" : "社区",
      progressText: hasPublicRemote ? "登录后显示你的收藏进度" : "登录后同步真实收藏进度",
      emptyTitle: hasPublicRemote ? "登录后显示个人进度" : "未连接 Bangumi 账号",
      emptySubtitle: "小组件不会再使用本地 mock。授权后会读取真实收藏、每日放送与超展开。",
      watchingCount: 0,
      completedCount: 0,
      todayCount: calendarResult.value?.total ?? 0,
      totalCount: 0,
      primary: undefined,
      upcoming: [],
      todaySubjects: calendarResult.value?.subjects ?? [],
      topics: topicsResult.value ?? [],
    },
    cacheable: false,
  }
}

function buildUnavailableData(
  openURL: string,
  appState: ReturnType<typeof getBangumiAppState>,
  sourceLabel: string,
  title: string,
  subtitle: string,
  sourceState: BangumiWidgetData["sourceState"],
): BangumiWidgetData {
  const now = new Date()
  return {
    openURL,
    todayLabel: formatTodayLabel(now),
    dateLabel: formatWidgetDate(now),
    updatedAtLabel: "未更新",
    sourceState,
    sourceLabel,
    accountLabel: appState.isAuthenticated ? "已登录" : "访客模式",
    noticeLabel: appState.isAuthenticated ? "未知" : "需登录",
    themeLabel: appState.appearanceMode === "system" ? "跟随系统" : appState.appearanceMode === "dark" ? "固定深色" : "固定浅色",
    focusLabel: appState.isolationMode ? "专注" : "社区",
    progressText: subtitle,
    emptyTitle: title,
    emptySubtitle: subtitle,
    watchingCount: 0,
    completedCount: 0,
    todayCount: 0,
    totalCount: 0,
    primary: undefined,
    upcoming: [],
    todaySubjects: [],
    topics: [],
  }
}

async function safeLoadCollection(query: Parameters<typeof getSubjectCollections>[0]): Promise<{ ok: true; value: CollectionPayload } | { ok: false; value: null }> {
  try {
    const response = await getSubjectCollections(query)
    return { ok: true, value: adaptCollectionPayload(response) }
  } catch {
    return { ok: false, value: null }
  }
}

async function safeLoadTodayCalendarSubjects(): Promise<{ ok: true; value: { subjects: BangumiWidgetSubject[]; total: number } } | { ok: false; value: null }> {
  try {
    const response = await loadCalendar()
    const subjects = adaptTodayCalendarSubjects(response)
    return { ok: true, value: { subjects: subjects.slice(0, 3), total: subjects.length } }
  } catch {
    return { ok: false, value: null }
  }
}

async function safeLoadTopics(): Promise<{ ok: true; value: BangumiWidgetTopic[] } | { ok: false; value: null }> {
  try {
    const response = await loadRakuenTopics("groupAll", 6)
    const topics = adaptTopicList(response)
    return { ok: true, value: topics.slice(0, 2) }
  } catch {
    return { ok: false, value: null }
  }
}

async function safeLoadNoticeCount(): Promise<{ ok: true; value: number } | { ok: false; value: null }> {
  try {
    const response = await listNotice(1, true)
    return { ok: true, value: readCount(response) }
  } catch {
    return { ok: false, value: null }
  }
}

function adaptCollectionPayload(response: unknown): CollectionPayload {
  const container = isRecord(response) ? response : {}
  const entries = readBangumiList(response)
  const subjects = entries
    .map((entry, index) => toWidgetSubject(extractSubjectSource(entry), index, entry))
    .filter((item): item is BangumiWidgetSubject => Boolean(item))
  const total = readNumber(container.total) ?? readNumber(container.count) ?? readNumber(container.totalCount) ?? readNumber(container.total_count) ?? subjects.length
  return { subjects, total }
}

function adaptTodayCalendarSubjects(response: unknown) {
  const entries = normalizeCalendarEntries(response)
  const todayNumber = new Date().getDay() || 7
  const today = entries.find((entry) => entry.weekdayNumber === todayNumber) ?? entries[0]
  if (!today) {
    return []
  }
  return today.items
    .map((item, index) => toWidgetSubject(unwrapSubject(item), index, item))
    .filter((item): item is BangumiWidgetSubject => Boolean(item))
}

function adaptTopicList(response: unknown): BangumiWidgetTopic[] {
  return readBangumiList(response)
    .map((item, index) => {
      if (!isRecord(item)) {
        return null
      }
      const topic = firstRecord(item.topic, item.post, item.entry) ?? item
      const group = firstRecord(item.group, topic.group, item.club, topic.club, item.board, topic.board) ?? {}
      const user = firstRecord(item.user, topic.user, item.author, topic.author, item.creator, topic.creator) ?? {}
      const title = readString(topic.title) ?? readString(topic.name)
      if (!title) {
        return null
      }
      const replies = readNumber(topic.replies) ?? readNumber(topic.replyCount) ?? readNumber(topic.reply_count) ?? readNumber(item.replies) ?? 0
      return {
        id: `${readString(topic.topicKey) ?? readString(topic.url) ?? readNumber(topic.id) ?? index}`,
        title: cleanText(title),
        meta: `${readString(group.title) ?? readString(group.name) ?? "超展开"} · ${readString(user.nickname) ?? readString(user.username) ?? readString(user.name) ?? "Bangumi 用户"}`,
        heat: replies ? `${replies} 回复` : "新讨论",
      }
    })
    .filter((item): item is BangumiWidgetTopic => Boolean(item))
}

function normalizeCalendarEntries(input: unknown): { weekdayNumber: number; items: unknown[] }[] {
  if (Array.isArray(input)) {
    return input.map((entry, index) => {
      if (!isRecord(entry)) {
        return { weekdayNumber: index + 1, items: toArray(entry) }
      }
      const weekdaySource = isRecord(entry.weekday) ? entry.weekday : entry
      return {
        weekdayNumber: readNumber(weekdaySource.id) ?? readNumber(entry.weekdayID) ?? readNumber(entry.weekday_id) ?? index + 1,
        items: readCalendarItems(entry),
      }
    })
  }

  if (!isRecord(input)) {
    return []
  }

  const data = toArray(input.data ?? input.items ?? input.calendar)
  if (data.length) {
    return normalizeCalendarEntries(data)
  }

  return Object.entries(input).map(([weekdayKey, value], index) => {
    const weekdayNumber = Number(weekdayKey)
    return {
      weekdayNumber: Number.isFinite(weekdayNumber) ? weekdayNumber : index + 1,
      items: readCalendarItems(value),
    }
  })
}

function readCalendarItems(input: unknown) {
  if (Array.isArray(input)) {
    return input
  }
  if (!isRecord(input)) {
    return []
  }
  return toArray(input.items ?? input.subjects ?? input.data ?? input.list)
}

function toWidgetSubject(sourceInput: unknown, index: number, collectionInput?: unknown): BangumiWidgetSubject | null {
  const source = isRecord(sourceInput) ? sourceInput : {}
  if (!isRecord(source)) {
    return null
  }

  const id = readNumber(source.id) ?? readNumber(source.subject_id) ?? index + 1
  const title = readString(source.name_cn) ?? readString(source.nameCn) ?? readString(source.title) ?? readString(source.name)
  if (!title) {
    return null
  }

  const kind = describeSubjectKind(readNumber(source.type) ?? readNumber(source.subjectType) ?? readNumber(source.subject_type))
  const collectionSource = isRecord(collectionInput) ? collectionInput : {}
  const collection = mapCollectionLabel(readNumber(collectionSource.type) ?? readNumber(collectionSource.ctype) ?? readNumber(collectionSource.collection?.type))
  const epStatus = readNumber(collectionSource.epStatus) ?? readNumber(collectionSource.ep_status) ?? readNumber(source.epStatus) ?? readNumber(source.ep_status)
  const volStatus = readNumber(collectionSource.volStatus) ?? readNumber(collectionSource.vol_status) ?? readNumber(source.volStatus) ?? readNumber(source.vol_status)
  const totalEpisodes = readNumber(source.eps) ?? readNumber(source.totalEpisodes) ?? readNumber(source.total_episodes) ?? readNumber(source.volumes)
  const score = readScore(source)
  const progress = buildProgressLabel(kind, epStatus, volStatus, totalEpisodes) ?? buildCalendarProgress(source, kind) ?? collection

  return {
    id,
    title: cleanText(title),
    subtitle: summarizeText(readString(source.summary) ?? readString(source.desc) ?? readString(source.description) ?? readString(source.name) ?? ""),
    kind,
    collection,
    progress,
    score: score ? score.toFixed(1) : "--",
    accent: accentForKind(kind),
    imageUrl: readImageUrl(source),
  }
}

function extractSubjectSource(entry: unknown) {
  if (!isRecord(entry)) {
    return entry
  }
  return firstRecord(entry.subject, entry.item, entry.target, entry.entry) ?? entry
}

function unwrapSubject(entry: unknown) {
  if (!isRecord(entry)) {
    return entry
  }
  return firstRecord(entry.subject, entry.item, entry.target) ?? entry
}

function readBangumiList(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input
  }
  if (!isRecord(input)) {
    return []
  }
  for (const value of [input.data, input.items, input.list, input.results, input.subjects, input.topics, input.groups]) {
    const items = toArray(value)
    if (items.length) {
      return items
    }
  }
  return []
}

function readCount(response: unknown) {
  if (!isRecord(response)) {
    return Array.isArray(response) ? response.length : 0
  }
  return readNumber(response.unread) ?? readNumber(response.unreadCount) ?? readNumber(response.unread_count) ?? readNumber(response.total) ?? readNumber(response.count) ?? readBangumiList(response).length
}

function buildProgressLabel(kind: string, epStatus?: number, volStatus?: number, total?: number) {
  if (kind === "书籍" && typeof volStatus === "number" && volStatus > 0) {
    return total ? `读到 Vol. ${volStatus} / ${total}` : `读到 Vol. ${volStatus}`
  }
  if (typeof epStatus === "number" && epStatus > 0) {
    if (kind === "音乐") {
      return total ? `听到 ${epStatus} / ${total}` : `听到 ${epStatus}`
    }
    if (kind === "游戏") {
      return total ? `玩到 ${epStatus} / ${total}` : `进度 ${epStatus}`
    }
    return total ? `看到 EP ${epStatus} / ${total}` : `看到 EP ${epStatus}`
  }
  return undefined
}

function buildCalendarProgress(source: Record<string, any>, kind: string) {
  const airdate = readString(source.airDate) ?? readString(source.air_date) ?? readString(source.airdate) ?? readString(source.date)
  const total = readNumber(source.eps) ?? readNumber(source.totalEpisodes) ?? readNumber(source.total_episodes)
  if (airdate && total) {
    return `${airdate} · 全 ${total} 话`
  }
  if (airdate) {
    return `${airdate} 放送`
  }
  if (total) {
    return kind === "书籍" ? `全 ${total} 卷` : `全 ${total} 话`
  }
  return undefined
}

function mapCollectionLabel(type?: number) {
  switch (type) {
    case 1:
      return "想看"
    case 2:
      return "看过"
    case 3:
      return "在看"
    case 4:
      return "搁置"
    case 5:
      return "抛弃"
    default:
      return "未收藏"
  }
}

function describeSubjectKind(type?: number) {
  switch (type) {
    case 1:
      return "书籍"
    case 2:
      return "动画"
    case 3:
      return "音乐"
    case 4:
      return "游戏"
    case 6:
      return "三次元"
    default:
      return "条目"
  }
}

function accentForKind(kind: string) {
  switch (kind) {
    case "动画":
      return "#79A7BA"
    case "书籍":
      return "#B4749A"
    case "音乐":
      return "#8E7CC3"
    case "游戏":
      return "#6BAF92"
    case "三次元":
      return "#D49A63"
    default:
      return DEFAULT_ACCENT
  }
}

function readScore(source: Record<string, any>) {
  const direct = readNumber(source.score) ?? readNumber(source.rating)
  if (direct) {
    return direct
  }
  if (isRecord(source.rating)) {
    return readNumber(source.rating.score) ?? readNumber(source.rating.average)
  }
  return undefined
}

function readImageUrl(source: Record<string, any>) {
  const direct = readString(source.image) ?? readString(source.cover) ?? readString(source.avatar) ?? readString(source.icon)
  if (direct) {
    return normalizeImageURL(direct)
  }
  const images = firstRecord(source.images, source.imageUrl, source.coverImages) ?? {}
  const nested = readString(images.common) ?? readString(images.grid) ?? readString(images.large) ?? readString(images.medium) ?? readString(images.small)
  return nested ? normalizeImageURL(nested) : undefined
}

function normalizeImageURL(value: string) {
  if (value.startsWith("//")) {
    return `https:${value}`
  }
  if (value.startsWith("http://")) {
    return value.replace(/^http:\/\//, "https://")
  }
  return value
}

function summarizeText(text: string) {
  const cleaned = cleanText(text)
  return cleaned.length > 54 ? `${cleaned.slice(0, 54)}…` : cleaned
}

function cleanText(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

function readCachedSnapshot(openURL: string, appState: ReturnType<typeof getBangumiAppState>): BangumiWidgetData | null {
  const snapshot = readJson<WidgetSnapshot | null>(WIDGET_CACHE_KEY, null)
  if (!snapshot) {
    return null
  }
  return {
    ...snapshot,
    openURL,
    sourceState: "partial",
    sourceLabel: "上次同步",
    accountLabel: appState.isAuthenticated ? snapshot.accountLabel : "缓存",
  }
}

function writeCachedSnapshot(data: BangumiWidgetData) {
  const { openURL: _openURL, ...snapshot } = data
  Storage.set(WIDGET_CACHE_KEY, JSON.stringify(snapshot))
}

function readJson<T>(key: string, fallback: T) {
  const raw = Storage.get(key)
  if (typeof raw !== "string" || !raw.length) {
    return fallback
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function firstRecord(...values: unknown[]) {
  return values.find(isRecord) as Record<string, any> | undefined
}

function toArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }
  if (isRecord(value)) {
    return readBangumiList(value)
  }
  return []
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length ? value.trim() : undefined
}

function formatTodayLabel(date: Date) {
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]
  return `${formatWidgetDate(date)} · ${weekday}`
}

function formatWidgetDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatWidgetTime(date: Date) {
  const hour = `${date.getHours()}`.padStart(2, "0")
  const minute = `${date.getMinutes()}`.padStart(2, "0")
  return `${hour}:${minute}`
}
