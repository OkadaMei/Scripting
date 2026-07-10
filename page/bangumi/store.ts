import {
  currentUser,
  discoverSections as mockDiscoverSections,
  calendarDays as mockCalendarDays,
  subjects,
  type BangumiSubject,
  type BangumiUser,
  type TimelineItem,
  type TimelineTarget,
} from "./data"
import {
  clearNotice,
  getSubjectCollections,
  getSubjectCollection,
  getTimeline,
  getTimelineReplies,
  getUserFriends,
  getUserTimeline,
  likeBangumiPath,
  listNotice,
  loadCalendar,
  loadCurrentUser,
  loadEpisodeComments,
  loadIndexDetail,
  loadMonoDetails,
  loadRakuenTopics,
  loadSubject,
  loadSubjectDetails,
  loadSubjectReviewDetail,
  loadTopicDetail,
  loadTrendingSubjects,
  loadUser,
  postTimeline,
  postTimelineReply,
  searchCharacters,
  searchPersons,
  searchSubjects,
  updateEpisodeCollection,
  updateEpisodeCollections,
  updateSubjectCollection,
} from "./client"
import type {
  BangumiCalendarDay,
  BangumiCollectionSummaryData,
  BangumiCollectionSummaryItem,
  BangumiSubjectTypeSummaryData,
  BangumiSubjectTypeSummaryItem,
  BangumiCommentReply,
  BangumiDiscoverData,
  BangumiDiscoverSection,
  BangumiIndexDetailData,
  BangumiMonoDetailData,
  BangumiMonoSearchData,
  BangumiNoticeData,
  BangumiProgressData,
  BangumiRakuenData,
  BangumiRakuenMode,
  BangumiRakuenTopic,
  BangumiRakuenTopicType,
  BangumiSearchData,
  BangumiSearchMonoItem,
  BangumiSubjectCollector,
  BangumiSubjectComment,
  BangumiSubjectCharacter,
  BangumiSubjectDetailData,
  BangumiSubjectIndexItem,
  BangumiSubjectRelationItem,
  BangumiSubjectReview,
  BangumiSubjectEpisode,
  BangumiSubjectTopic,
  BangumiEpisodeCommentData,
  BangumiTimelineData,
  BangumiTimelineDetailData,
  BangumiTopicDetailData,
  BangumiUserDetailData,
} from "./types"

const weekdayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
const trendingTypes = [
  { key: "2", title: "动画" },
  { key: "1", title: "书籍" },
  { key: "3", title: "音乐" },
  { key: "4", title: "游戏" },
  { key: "6", title: "三次元" },
]

const collectionSummaryTypes: Array<{ title: BangumiCollectionSummaryItem["title"]; type: number }> = [
  { title: "想看", type: 1 },
  { title: "看过", type: 2 },
  { title: "在看", type: 3 },
  { title: "搁置", type: 4 },
  { title: "抛弃", type: 5 },
]

const subjectTypeSummaryTypes: Array<{ title: BangumiSubjectTypeSummaryItem["title"]; type: number; keys: string[] }> = [
  { title: "动画", type: 2, keys: ["anime", "animation", "animations", "subjectAnime", "subjectsAnime", "subject_anime", "subjects_anime", "type2", "type_2", "subject2", "subjects2", "cat2", "2"] },
  { title: "书籍", type: 1, keys: ["book", "books", "manga", "novel", "subjectBook", "subjectsBook", "subject_book", "subjects_book", "type1", "type_1", "subject1", "subjects1", "cat1", "1"] },
  { title: "音乐", type: 3, keys: ["music", "musics", "subjectMusic", "subjectsMusic", "subject_music", "subjects_music", "type3", "type_3", "subject3", "subjects3", "cat3", "3"] },
  { title: "游戏", type: 4, keys: ["game", "games", "subjectGame", "subjectsGame", "subject_game", "subjects_game", "type4", "type_4", "subject4", "subjects4", "cat4", "4"] },
  { title: "三次元", type: 6, keys: ["real", "realWorld", "real_world", "drama", "liveAction", "live_action", "subjectReal", "subjectsReal", "subject_real", "subjects_real", "type6", "type_6", "subject6", "subjects6", "cat6", "6"] },
]

function withFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback)
}

export async function loadDiscoverViewData(): Promise<BangumiDiscoverData> {
  const [calendarResponse, trendingResponses] = await Promise.all([
    withFallback(loadCalendar(), null),
    Promise.all(trendingTypes.map((item) => withFallback(loadTrendingSubjects(item.key), null))),
  ])

  const calendar = adaptCalendarResponse(calendarResponse)
  const sections = trendingResponses
    .map((response, index) => adaptTrendingSection(response, trendingTypes[index].title))
    .filter((section) => section.items.length > 0)

  if (calendar.length > 0 || sections.length > 0) {
    return {
      calendarDays: calendar.length > 0 ? calendar : mockCalendarDays,
      discoverSections: sections.length > 0 ? sections : mockDiscoverSections,
      source: "remote",
      message: `已更新发现内容：每日放送 ${calendar.length || 0} 天，热门分区 ${sections.length || 0} 组。`,
    }
  }

  return {
    calendarDays: mockCalendarDays,
    discoverSections: mockDiscoverSections,
    source: "mock",
    message: "暂时无法更新发现内容，已显示本地推荐。",
  }
}

export async function loadTimelineViewData(mode: "friends" | "all" | "me" = "friends", until?: number): Promise<BangumiTimelineData> {
  try {
    const username = mode === "me" || mode === "friends" ? await resolveCurrentTimelineUsername() : undefined
    if (mode === "friends" && !until) {
      const friendCount = await loadCurrentFriendCount(username ?? "")
      if (friendCount === 0) {
        return {
          items: [],
          source: "remote",
          message: "当前账号暂无好友动态。",
          exhausted: true,
        }
      }
    }

    const response = mode === "me"
      ? await getUserTimeline(username ?? await resolveCurrentTimelineUsername(), { limit: 20, until })
      : await getTimeline({ mode, limit: 20, until })
    const items = readBangumiList(response)
      .map((item, index) => adaptTimelineItem(item, index))
      .filter(Boolean) as TimelineItem[]
    const lastId = items.at(-1)?.id

    if (items.length > 0) {
      return {
        items,
        source: "remote",
        message: `${until ? "继续载入" : "已载入"}${describeTimelineMode(mode)}动态 ${items.length} 条。`,
        lastId,
        exhausted: false,
      }
    }

    return {
      items: [],
      source: "remote",
      message: until ? `${describeTimelineMode(mode)}动态已全部显示。` : `${describeTimelineMode(mode)}动态暂无内容。`,
      lastId: until,
      exhausted: true,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      items: [],
      source: "remote",
      message: `${describeTimelineMode(mode)}动态暂时无法同步：${message}`,
      lastId: until,
      exhausted: true,
    }
  }
}

export async function loadTimelineDetailData(item: TimelineItem): Promise<BangumiTimelineDetailData> {
  try {
    const response = await getTimelineReplies(item.id)
    const replies = readBangumiList(response)
      .map((entry, index) => adaptCommentReply(entry, index))
      .filter(Boolean) as BangumiCommentReply[]
    return {
      item,
      replies,
      source: "remote",
      message: replies.length ? `已载入 ${replies.length} 条回复。` : "当前暂无回复。",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      item,
      replies: [],
      source: "mock",
      message: `回复暂时无法同步：${message}`,
    }
  }
}

export async function markNoticeRead(ids: number[]) {
  if (!ids.length) {
    return
  }
  await clearNotice(ids)
}

export async function sendTimelineStatus(content: string) {
  await postTimeline({ content })
}

export async function sendTimelineReply(timelineId: number, content: string, replyTo?: number) {
  await postTimelineReply(timelineId, { content, replyTo })
}

export async function likeTimelinePath(path: string, value = 1) {
  await likeBangumiPath(path, value)
}

async function loadCurrentFriendCount(username: string) {
  const response = await getUserFriends(username, 1)
  const container = isRecord(response) ? response : {}
  return readNumber(container.total) ?? readNumber(container.count) ?? readNumber(container.totalCount) ?? readNumber(container.total_count) ?? readBangumiList(response).length
}

async function resolveCurrentTimelineUsername() {
  const response = await loadCurrentUser()
  const source = isRecord(response) && isRecord(response.data) ? response.data : response
  if (!isRecord(source)) {
    throw new Error("当前用户响应格式不可识别")
  }

  const username = readString(source.username) ?? readString(source.account) ?? readString(source.name)
  if (!username) {
    throw new Error("当前用户响应缺少 username")
  }
  return username
}

function describeTimelineMode(mode: "friends" | "all" | "me") {
  switch (mode) {
    case "all":
      return "全站"
    case "me":
      return "我的"
    case "friends":
    default:
      return "好友"
  }
}

export async function loadCollectionSummaryData(): Promise<BangumiCollectionSummaryData> {
  try {
    const summary = await Promise.all(collectionSummaryTypes.map(async (item) => {
      const response = await getSubjectCollections({ type: item.type, limit: 1, offset: 0 })
      const container = isRecord(response) ? response : {}
      const total = readNumber(container.total) ?? readNumber(container.count) ?? toArray(container.data).length
      return { title: item.title, count: total }
    }))
    const items = summary.filter((item) => item.count > 0)
    const total = summary.reduce((sum, item) => sum + item.count, 0)

    return {
      items,
      total,
      source: "remote",
      message: total > 0 ? `已同步收藏统计，共 ${total} 项。` : "当前暂无收藏。",
    }
  } catch {
    const summary = buildCollectionSummaryFromSubjects(subjects)
    const total = summary.reduce((sum, item) => sum + item.count, 0)
    return {
      items: summary,
      total,
      source: "mock",
      message: "暂时无法同步收藏统计。",
    }
  }
}

export async function loadUserSubjectTypeSummaryData(username: string): Promise<BangumiSubjectTypeSummaryData> {
  const userCandidates = [
    () => loadCurrentUser(),
    () => loadUser(username),
  ]

  for (const candidate of userCandidates) {
    try {
      const response = await candidate()
      const items = buildSubjectTypeSummaryFromUser(response)
      if (items.length) {
        const total = sumSubjectTypeSummary(items)
        return {
          items,
          total,
          source: "remote",
          message: total > 0 ? `已同步收藏分类，共 ${total} 项。` : "当前暂无收藏。",
        }
      }
    } catch {
      // Try the next user endpoint before falling back to collection queries.
    }
  }

  try {
    const { items, total } = await loadSubjectTypeSummaryFromCollectionPages()

    return {
      items,
      total,
      source: "remote",
      message: total > 0 ? `已按收藏条目统计分类，共 ${total} 项。` : "当前暂无可统计收藏。",
    }
  } catch {
    const items = buildSubjectTypeSummaryFromCollectionLabels(currentUser.collections)
    const total = sumSubjectTypeSummary(items)
    return {
      items,
      total,
      source: "mock",
      message: "暂时无法同步收藏分类。",
    }
  }
}

export async function loadProgressViewData(): Promise<BangumiProgressData> {
  const collectionSummary = await loadCollectionSummaryData()

  try {
    const response = await getSubjectCollections({ limit: 24, offset: 0 })
    const container = isRecord(response) ? response : {}
    const data = toArray(container.data)
    const items = data
      .map((item, index) => adaptCollectionSubject(item, index))
      .filter(Boolean) as BangumiSubject[]

    if (items.length > 0) {
      const total = readNumber(container.total) ?? items.length
      return {
        subjects: items,
        collectionSummary: collectionSummary.items,
        source: "remote",
        message: `收藏列表已载入 ${items.length} / ${total} 项；${collectionSummary.message}`,
      }
    }
  } catch {
    // fall through to mock
  }

  return {
    subjects,
    collectionSummary: collectionSummary.items.length ? collectionSummary.items : buildCollectionSummaryFromSubjects(subjects),
    source: collectionSummary.source,
    message: collectionSummary.source === "remote" ? `收藏列表暂无可展示条目；${collectionSummary.message}` : "暂时无法同步收藏列表。",
  }
}

export async function loadRakuenViewData(mode: BangumiRakuenMode = "groupAll"): Promise<BangumiRakuenData> {
  const topicResponse = await withFallback(loadRakuenTopics(mode, 30), null)
  const expectedType = getRakuenTopicTypeForMode(mode)
  const topics = readRakuenTopicList(topicResponse, expectedType).slice(0, 30)

  return {
    topics,
    source: topics.length ? "remote" : "mock",
    message: buildRakuenViewMessage(mode, topics.length),
  }
}

export async function loadSearchViewData(keyword: string, subjectType = "全部"): Promise<BangumiSearchData> {
  const normalized = keyword.trim()
  if (!normalized) {
    return {
      subjects: [],
      total: 0,
      source: "mock",
      message: "输入关键字搜索",
    }
  }

  try {
    const response = await searchSubjects({
      keyword: normalized,
      type: mapSearchSubjectType(subjectType),
      limit: 20,
      offset: 0,
    })
    const container = isRecord(response) ? response : {}
    const items = readBangumiList(response)
      .map((item, index) => adaptSubject(item, index))
      .filter(Boolean) as BangumiSubject[]
    const total = readNumber(container.total) ?? items.length

    return {
      subjects: items,
      total,
      source: "remote",
      message: items.length ? `已找到 ${items.length} / ${total} 个条目。` : "当前关键词没有结果。",
    }
  } catch (error) {
    const keywordLower = normalized.toLowerCase()
    const fallback = subjects.filter((subject) => {
      const matchesType = subjectType === "全部" || subject.kind === subjectType
      const matchesKeyword =
        subject.title.toLowerCase().includes(keywordLower) ||
        subject.originalTitle.toLowerCase().includes(keywordLower) ||
        subject.tags.some((tag) => tag.toLowerCase().includes(keywordLower))
      return matchesType && matchesKeyword
    })
    const message = error instanceof Error ? error.message : "未知错误"

    return {
      subjects: fallback,
      total: fallback.length,
      source: "mock",
      message: `搜索暂时不可用，已显示本地结果：${message}`,
    }
  }
}

export async function loadMonoSearchViewData(keyword: string, kind: "角色" | "人物"): Promise<BangumiMonoSearchData> {
  const normalized = keyword.trim()
  if (!normalized) {
    return {
      items: [],
      total: 0,
      source: "mock",
      message: "输入关键字搜索",
    }
  }

  try {
    const response = kind === "角色"
      ? await searchCharacters({ keyword: normalized, limit: 20, offset: 0 })
      : await searchPersons({ keyword: normalized, limit: 20, offset: 0 })
    const container = isRecord(response) ? response : {}
    const items = readBangumiList(response)
      .map((item, index) => adaptMonoSearchItem(item, index, kind))
      .filter(Boolean) as BangumiSearchMonoItem[]
    const total = readNumber(container.total) ?? items.length

    return {
      items,
      total,
      source: "remote",
      message: items.length ? `已找到 ${items.length} / ${total} 个${kind}。` : "当前关键词没有结果。",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      items: [],
      total: 0,
      source: "mock",
      message: `${kind}搜索暂时不可用：${message}`,
    }
  }
}

export async function loadEpisodeCommentData(episode: BangumiSubjectEpisode): Promise<BangumiEpisodeCommentData> {
  try {
    const response = await loadEpisodeComments(episode.id)
    const replies = readBangumiList(response)
      .map((item, index) => adaptCommentReply(item, index))
      .filter(Boolean) as BangumiCommentReply[]
    return {
      replies,
      source: "remote",
      message: replies.length ? `已载入 ${replies.length} 条评论。` : "当前章节暂无评论。",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      replies: [],
      source: "mock",
      message: `评论暂时无法同步：${message}`,
    }
  }
}

export async function loadTopicDetailData(topic: BangumiSubjectTopic, type: "subject" | "group" = topic.topicType ?? "subject"): Promise<BangumiTopicDetailData> {
  try {
    const responses = await loadTopicDetail(topic.id, type, topic.url)
    const htmlDetail = responses.find((item) => typeof item === "string" && isCompatibleTopicHtml(item, topic, type))
    if (typeof htmlDetail === "string") {
      const parsed = parseRakuenTopicDetailHtml(htmlDetail, topic)
      return {
        topic: parsed.topic,
        content: parsed.content,
        replies: parsed.replies,
        source: "remote",
        message: parsed.replies.length ? `已载入正文与 ${parsed.replies.length} 条回复。` : "已载入正文，当前暂无回复。",
      }
    }

    const detailResponse = responses.find((item) => isRecord(item))
    const repliesResponse = responses.find((item) => readBangumiList(item).length > 0)
    const detail = isRecord(detailResponse) ? detailResponse : {}
    const content = cleanBangumiText(readString(detail.content) ?? readString(detail.body) ?? readString(detail.text) ?? readString(detail.summary)) ?? "暂无正文"
    const replies = readBangumiList(repliesResponse)
      .map((item, index) => adaptCommentReply(item, index))
      .filter(Boolean) as BangumiCommentReply[]
    return {
      topic: {
        ...topic,
        title: isCompatibleTopicTitle(readString(detail.title) ?? readString(detail.name), topic.title) ? cleanBangumiText(readString(detail.title) ?? readString(detail.name)) ?? topic.title : topic.title,
        replies: replies.length || topic.replies,
      },
      content,
      replies,
      source: "remote",
      message: replies.length ? `已载入讨论正文与 ${replies.length} 条回复。` : "当前主题暂无回复。",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      topic,
      content: "暂无正文",
      replies: [],
      source: "mock",
      message: `讨论暂时无法同步：${message}`,
    }
  }
}

export async function loadReviewDetailData(subjectId: number, review: BangumiSubjectReview) {
  try {
    const response = await loadSubjectReviewDetail(subjectId, review.id)
    const detailSource = isRecord(response) && isRecord(response.data) ? response.data : response
    const resolvedReview = adaptSubjectReview(detailSource, 0) ?? review
    const content = resolvedReview.content.length >= review.content.length ? resolvedReview.content : review.content
    return {
      review: {
        ...review,
        ...resolvedReview,
        content,
        summary: summarizeBangumiText(content),
        replies: resolvedReview.replies || review.replies,
      },
      source: "remote" as const,
      message: content.length > review.content.length ? "已载入完整长评。" : "已载入长评详情。",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      review,
      source: "mock" as const,
      message: `长评暂时无法同步：${message}`,
    }
  }
}

export async function updateSubjectCollectionStatus(subject: BangumiSubject, collection: string) {
  const type = mapCollectionType(collection)
  if (!type) {
    throw new Error(`暂不支持的收藏状态：${collection}`)
  }

  await updateSubjectCollection(subject.id, { type })
  return {
    ...subject,
    collection,
  }
}

export async function markEpisodeWatched(subjectId: number, episode: BangumiSubjectEpisode) {
  await updateEpisodeCollection(subjectId, episode.id, { type: 2 })
  return {
    ...episode,
    collection: "看过" as const,
  }
}

export async function markEpisodesWatchedUntil(subjectId: number, episodes: BangumiSubjectEpisode[], episode: BangumiSubjectEpisode) {
  const targetSort = episode.sort || episode.id
  const targets = episodes.filter((item) => (item.sort || item.id) <= targetSort)
  const targetIds = targets.map((item) => item.id)
  await updateEpisodeCollections(subjectId, targetIds, { type: 2 })
  const targetIdSet = new Set(targetIds)
  return episodes.map((item) => targetIdSet.has(item.id) ? { ...item, collection: "看过" as const } : item)
}

export async function resetEpisodeWatched(subjectId: number, episode: BangumiSubjectEpisode) {
  await updateEpisodeCollection(subjectId, episode.id, { type: 0 })
  return {
    ...episode,
    collection: "未看" as const,
  }
}

export function syncSubjectProgressFromEpisodes(subject: BangumiSubject, episodes: BangumiSubjectEpisode[]) {
  const watched = episodes.filter((episode) => episode.collection === "看过").length
  const total = episodes.length || subject.episodes.length
  if (!watched) {
    return {
      ...subject,
      progressLabel: total ? `未开始 / ${total}` : subject.progressLabel,
    }
  }

  const finished = total > 0 && watched >= total
  return {
    ...subject,
    collection: subject.collection === "想看" ? (finished ? "看过" : "在看") : subject.collection,
    progressLabel: subject.kind === "书籍"
      ? `读到 ${watched} / ${total}`
      : subject.kind === "音乐"
        ? `听到 ${watched} / ${total}`
        : finished
          ? `已看完 ${watched} / ${total}`
          : `看到 EP ${watched} / ${total}`,
  }
}

export async function loadNoticeViewData(): Promise<BangumiNoticeData> {
  try {
    const response = await listNotice(20, false)
    const container = isRecord(response) ? response : {}
    const data = readBangumiList(response)
    const items = data
      .map((item, index) => adaptNoticeItem(item, index))
      .filter(Boolean) as BangumiNoticeData["items"]
    const unread = readNumber(container.unread) ?? readNumber(container.unreadCount) ?? readNumber(container.unread_count) ?? items.filter((item) => item.unread).length
    const total = readNumber(container.total) ?? readNumber(container.count) ?? items.length

    return {
      items,
      total,
      unread,
      source: "remote",
      message: items.length > 0 ? `已载入 ${items.length} 条提醒。` : "当前暂无提醒。",
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      items: [],
      total: 0,
      unread: 0,
      source: "mock",
      message: `提醒暂时无法同步：${message}`,
    }
  }
}

export async function loadMonoDetailData(item: BangumiSearchMonoItem): Promise<BangumiMonoDetailData> {
  try {
    const [detailResponse, primaryResponse, relationResponse] = await loadMonoDetails(item.kind, item.id)
    const detail = adaptMonoSearchItem(detailResponse, 0, item.kind) ?? item
    const relatedSubjects = readBangumiList(primaryResponse)
      .map((entry, index) => {
        if (!isRecord(entry)) return null
        const subjectSource = isRecord(entry.subject) ? entry.subject : entry
        return adaptSubject(subjectSource, index)
      })
      .filter(Boolean) as BangumiSubject[]
    const relatedMonos = readBangumiList(relationResponse)
      .map((entry, index) => {
        if (!isRecord(entry)) return null
        const monoSource = item.kind === "角色"
          ? (isRecord(entry.character) ? entry.character : entry)
          : (isRecord(entry.person) ? entry.person : entry)
        return adaptMonoSearchItem(monoSource, index, item.kind)
      })
      .filter(Boolean) as BangumiSearchMonoItem[]

    return {
      item: {
        ...item,
        ...detail,
        meta: detail.meta || item.meta,
        summary: detail.summary !== "暂无简介" ? detail.summary : item.summary,
      },
      relatedSubjects,
      relatedMonos,
      source: "remote",
      message: `已同步${item.kind}详情与关联内容。`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误"
    return {
      item,
      relatedSubjects: [],
      relatedMonos: [],
      source: "mock",
      message: `${item.kind}详情暂时无法同步：${message}`,
    }
  }
}

export async function loadIndexDetailData(index: BangumiSubjectIndexItem): Promise<BangumiIndexDetailData> {
  try {
    const response = await loadIndexDetail(index.id)
    const responseRecord = isRecord(response) ? response as Record<string, any> : null
    const responseData = responseRecord && isRecord(responseRecord.data) ? responseRecord.data as Record<string, any> : null
    const indexSource = responseRecord && isRecord(responseRecord.index)
      ? responseRecord.index
      : responseRecord && isRecord(responseRecord.idx)
        ? responseRecord.idx
        : responseData && (isRecord(responseData.index) || isRecord(responseData.idx))
          ? (isRecord(responseData.index) ? responseData.index : responseData.idx)
          : response
    const resolvedIndex = adaptSubjectIndex(indexSource, index.id) ?? index
    const subjectItems = readIndexSubjectList(response)
      .map((item, itemIndex) => {
        const subjectSource = extractSubjectSource(item)
        return adaptSubject(subjectSource, itemIndex)
      })
      .filter(Boolean)
      .slice(0, 30) as BangumiSubject[]

    return {
      index: {
        ...index,
        ...resolvedIndex,
        total: resolvedIndex.total || index.total || subjectItems.length,
      },
      subjects: subjectItems,
      source: "remote",
      message: subjectItems.length ? `已同步目录详情，载入 ${subjectItems.length} 个条目。` : "当前目录暂无条目。",
    }
  } catch (error) {
    return {
      index,
      subjects: [],
      source: "mock",
      message: error instanceof Error ? `目录详情暂时无法同步：${error.message}` : "目录详情暂时无法同步。",
    }
  }
}

export async function loadSubjectDetailData(subject: BangumiSubject): Promise<BangumiSubjectDetailData> {
  try {
    const [subjectResponse, detailResponses, collectionResponse] = await Promise.all([
      loadSubject(subject.id),
      loadSubjectDetails(subject.id),
      withFallback(getSubjectCollection(subject.id), null),
    ])

    const detailList = Array.isArray(detailResponses) ? detailResponses : []
    const remoteSubject = adaptSubject(subjectResponse, 0)
    if (remoteSubject) {
      const detailData = mergeSubjectDetails(remoteSubject, detailList, subject, collectionResponse)
      return {
        subject: detailData.subject,
        episodes: detailData.episodes,
        comments: detailData.comments,
        topics: detailData.topics,
        reviews: detailData.reviews,
        collectors: detailData.collectors,
        characters: detailData.characters,
        relations: detailData.relations,
        recommendations: detailData.recommendations,
        indexes: detailData.indexes,
        source: "remote",
        message: buildSubjectDetailMessage(detailData.episodes.length, detailData.comments.length, detailData.topics.length, detailData.characters.length, detailData.relations.length, detailData.recommendations.length, detailData.indexes.length, detailData.reviews.length, detailData.collectors.length),
      }
    }
  } catch {
    // fall through to mock
  }

  return {
    subject,
    episodes: adaptFallbackEpisodes(subject),
    comments: [],
    topics: [],
    reviews: [],
    collectors: [],
    characters: [],
    relations: [],
    recommendations: [],
    indexes: [],
    source: "mock",
    message: "暂时无法同步条目详情，已显示本地缓存。",
  }
}

export async function loadUserDetailData(username: string, fallbackUser: BangumiUser): Promise<BangumiUserDetailData> {
  try {
    const response = await loadCurrentUser()
    const user = adaptUser(response, fallbackUser)
    return {
      user,
      source: "remote",
      message: "已同步当前账号信息。",
    }
  } catch (currentUserError) {
    try {
      const response = await loadUser(username)
      const user = adaptUser(response, fallbackUser)
      return {
        user,
        source: "remote",
        message: "已同步用户信息。",
      }
    } catch {
      return {
        user: fallbackUser,
        source: "mock",
        message: currentUserError instanceof Error ? `用户信息暂时无法同步：${currentUserError.message}` : "用户信息暂时无法同步，已显示本地缓存。",
      }
    }
  }
}

function adaptTimelineItem(input: unknown, index: number): TimelineItem | null {
  if (!isRecord(input)) {
    return null
  }

  const userSource = firstRecord(input.user, input.member, input.creator, input.author) ?? {}
  const memo = isRecord(input.memo) ? input.memo : {}
  const source = isRecord(input.source) ? input.source : {}
  const payload = readTimelinePayload(memo, source)
  const category = readNumber(input.cat) ?? readNumber(input.category)
  const type = readNumber(input.type)
  const categoryLabel = describeTimelineCategory(category)
  const timelineSubjects = readTimelineSubjects(input, memo, source, category, index)
  const subject = timelineSubjects[0]
  const reactions = adaptTimelineReactions(input.reactions)
  const comment = readTimelineComment(input, payload, memo)
  const collectId = readTimelineCollectId(input, payload)
  const replyable = category === 5 && type === 1

  return {
    id: readNumber(input.id) ?? index + 1,
    user: readString(userSource.nickname) ?? readString(userSource.username) ?? readString(userSource.name) ?? readString(input.nickname) ?? "Bangumi 用户",
    action: buildTimelineAction(input, payload, category, categoryLabel, subject),
    content: buildTimelineContent(input, memo, payload, subject, categoryLabel),
    time: formatBangumiTime(readString(input.createdAt) ?? readString(input.created_at), readNumber(input.createdAt) ?? readNumber(input.created_at)),
    replies: readTimelineReplies(input),
    reactions,
    category,
    type,
    categoryLabel,
    sourceName: readTimelineSourceName(input, source, payload, subject),
    sourceUrl: readString(source.url) ?? readString(source.link) ?? readString(input.url) ?? readString(input.link),
    batch: describeTimelineBatch(input.batch ?? payload.batch ?? timelineSubjects),
    avatarUrl: readBangumiImageUrl(userSource),
    subjectId: subject?.id,
    subjectTitle: subject?.title,
    subject,
    subjects: timelineSubjects,
    targets: readTimelineTargets(input, memo, source, category),
    comment,
    rate: readNumber(payload.rate) ?? readNumber(input.rate) ?? readNumber(payload.score) ?? readNumber(input.score),
    collectId,
    replyable,
    reactionPath: buildTimelineReactionPath(category, replyable, collectId, readNumber(input.id) ?? index + 1, comment),
  }
}

function readTimelinePayload(memo: Record<string, any>, source: Record<string, any>) {
  return firstRecord(memo.subject, memo.progress, memo.status, memo.wiki, memo.daily, memo.mono, memo.blog, memo.index, memo.doujin, source) ?? {}
}

function readTimelineSubjectSource(input: Record<string, any>, memo: Record<string, any>, source: Record<string, any>, category?: number) {
  const progress = isRecord(memo.progress) ? memo.progress : {}
  const subjectMemo = isRecord(memo.subject) ? memo.subject : {}
  const wiki = isRecord(memo.wiki) ? memo.wiki : {}
  const candidates = [
    input.subject,
    input.relatedSubject,
    input.related_subject,
    input.targetSubject,
    input.target_subject,
    subjectMemo.subject,
    subjectMemo.item,
    subjectMemo.target,
    subjectMemo,
    progress.subject,
    progress.item,
    progress.target,
    isRecord(progress.batch) ? progress.batch.subject : undefined,
    isRecord(progress.single) ? progress.single.subject : undefined,
    wiki.subject,
    wiki.item,
    source.subject,
    source.item,
    source.target,
    category === 3 || category === 4 || category === 2 ? source : undefined,
  ]

  return candidates.find((candidate) => isRecord(candidate) && looksLikeTimelineSubject(candidate, category)) as Record<string, any> | undefined
}

function readTimelineSubjects(input: Record<string, any>, memo: Record<string, any>, source: Record<string, any>, category: number | undefined, index: number): BangumiSubject[] {
  const candidates: unknown[] = []
  const subjectMemo = isRecord(memo.subject) ? memo.subject : {}
  const progress = isRecord(memo.progress) ? memo.progress : {}
  const wiki = isRecord(memo.wiki) ? memo.wiki : {}

  candidates.push(
    ...toArray(input.subjects),
    ...toArray(input.subject),
    ...toArray(subjectMemo.subjects),
    ...toArray(subjectMemo.subject),
    ...toArray(subjectMemo.items),
    ...toArray(subjectMemo.data),
    ...toArray(wiki.subjects),
    ...toArray(wiki.subject),
    ...toArray(progress.subjects),
  )

  for (const nested of [progress.batch, progress.single, source]) {
    if (isRecord(nested)) {
      candidates.push(
        ...toArray(nested.subjects),
        ...toArray(nested.subject),
        ...toArray(nested.items),
        ...toArray(nested.data),
        nested.subject,
        nested.item,
        nested.target,
      )
    }
  }

  const primary = readTimelineSubjectSource(input, memo, source, category)
  if (primary) {
    candidates.unshift(primary)
  }

  const seen = new Set<number>()
  return candidates
    .map((candidate, candidateIndex) => unwrapTimelineSubjectCandidate(candidate))
    .filter((candidate): candidate is Record<string, any> => isRecord(candidate) && looksLikeTimelineSubject(candidate, category))
    .map((candidate, candidateIndex) => adaptSubject(candidate, index + candidateIndex))
    .filter((subject): subject is BangumiSubject => {
      if (!subject || seen.has(subject.id)) {
        return false
      }
      seen.add(subject.id)
      return true
    })
}

function unwrapTimelineSubjectCandidate(candidate: unknown) {
  if (!isRecord(candidate)) {
    return candidate
  }
  return firstRecord(candidate.subject, candidate.item, candidate.target, candidate.subjectInfo, candidate.subject_info) ?? candidate
}

function readTimelineTargets(input: Record<string, any>, memo: Record<string, any>, source: Record<string, any>, category?: number): TimelineTarget[] {
  const containers = [
    input.targets,
    input.users,
    input.groups,
    input.characters,
    input.persons,
    input.items,
    isRecord(memo.daily) ? memo.daily : undefined,
    isRecord(memo.mono) ? memo.mono : undefined,
    isRecord(memo.index) ? memo.index : undefined,
    source,
  ]
  const entries = containers.flatMap((container) => readTimelineTargetEntries(container, category))
  const seen = new Set<string>()
  return entries.filter((entry) => {
    const key = `${entry.kind ?? "target"}:${entry.id ?? entry.title}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  }).slice(0, 8)
}

function readTimelineTargetEntries(container: unknown, category?: number): TimelineTarget[] {
  const values = Array.isArray(container)
    ? container
    : isRecord(container)
      ? [
          ...toArray(container.users),
          ...toArray(container.friends),
          ...toArray(container.groups),
          ...toArray(container.characters),
          ...toArray(container.persons),
          ...toArray(container.items),
          ...toArray(container.data),
          container.user,
          container.friend,
          container.group,
          container.character,
          container.person,
        ]
      : []

  return values.map((value) => adaptTimelineTarget(value, category)).filter(Boolean) as TimelineTarget[]
}

function adaptTimelineTarget(input: unknown, category?: number): TimelineTarget | null {
  if (!isRecord(input)) {
    return null
  }

  const id = readNumber(input.id) ?? readNumber(input.uid)
  const title = readString(input.nickname) ?? readString(input.nameCn) ?? readString(input.name_cn) ?? readString(input.name) ?? readString(input.title)
  if (!title) {
    return null
  }

  return {
    id,
    title,
    subtitle: readString(input.username) ?? readString(input.description) ?? readString(input.summary) ?? describeTimelineTargetKind(category),
    imageUrl: readBangumiImageUrl(input),
    kind: readString(input.type) ?? readString(input.category) ?? describeTimelineTargetKind(category),
    url: readString(input.url) ?? readString(input.link),
  }
}

function describeTimelineTargetKind(category?: number) {
  switch (category) {
    case 1:
      return "日常"
    case 8:
      return "人物"
    case 7:
      return "目录"
    default:
      return "相关"
  }
}

function looksLikeTimelineSubject(input: Record<string, any>, category?: number) {
  const hasIdentity = typeof readNumber(input.id) === "number"
  const hasName = Boolean(readString(input.name) ?? readString(input.title) ?? readString(input.nameCn) ?? readString(input.name_cn))
  const hasSubjectShape = Boolean(readNumber(input.type) ?? input.images ?? input.image ?? readString(input.airDate) ?? readString(input.air_date))
  if (!hasIdentity || !hasName) {
    return false
  }
  if (category === 3 || category === 4 || category === 2) {
    return true
  }
  return hasSubjectShape
}

function buildTimelineAction(input: Record<string, any>, payload: Record<string, any>, category?: number, categoryLabel?: string, subject?: BangumiSubject) {
  const direct = cleanBangumiText(readString(input.action) ?? readString(input.typeName) ?? readString(input.type_name) ?? readString(input.title))
  if (direct) {
    return direct
  }

  const collectionType = readNumber(payload.ctype) ?? readNumber(payload.collectionType) ?? readNumber(payload.collection_type) ?? readNumber(payload.type) ?? readNumber(input.type)
  const collection = typeof collectionType === "number" ? mapCollectionLabel(collectionType) : undefined
  const subjectTitle = subject?.title ? `《${subject.title}》` : "条目"

  switch (category) {
    case 1:
      return "记录了日常"
    case 2:
      return subject ? `编辑了${subjectTitle}的维基` : "编辑了维基"
    case 3:
      return collection && collection !== "未收藏" ? `将${subjectTitle}标记为${collection}` : `更新了${subjectTitle}`
    case 4:
      return `更新了${subjectTitle}的进度`
    case 5:
      return "发表了吐槽"
    case 6:
      return "发表了日志"
    case 7:
      return "更新了目录"
    case 8:
      return "更新了人物"
    case 9:
      return "更新了同人作品"
    default:
      return categoryLabel ? `更新了${categoryLabel}` : "更新了动态"
  }
}

function buildTimelineContent(input: Record<string, any>, memo: Record<string, any>, payload: Record<string, any>, subject?: BangumiSubject, categoryLabel?: string) {
  const status = isRecord(memo.status) ? memo.status : {}
  const daily = isRecord(memo.daily) ? memo.daily : {}
  const direct =
    readCleanText(input.content) ??
    readCleanText(input.comment) ??
    readCleanText(input.summary) ??
    readCleanText(input.text) ??
    readCleanText(status.content) ??
    readCleanText(status.message) ??
    readCleanText(daily.content) ??
    readCleanText(daily.message) ??
    readCleanText(payload.content) ??
    readCleanText(payload.comment) ??
    readCleanText(payload.summary) ??
    readCleanText(payload.text) ??
    readCleanText(payload.message)
  if (direct) {
    return direct
  }

  const score = readNumber(payload.rate) ?? readNumber(payload.score) ?? readNumber(input.rate) ?? readNumber(input.score)
  const scoreText = score ? `评分 ${score}` : undefined
  const progressText = buildTimelineProgressText(payload, subject)
  const sourceName = readTimelineSourceName(input, isRecord(input.source) ? input.source : {}, payload, subject)
  const batchText = describeTimelineBatch(input.batch ?? payload.batch)
  const pieces = [scoreText, progressText, batchText, sourceName && !subject ? sourceName : undefined].filter(Boolean) as string[]

  return pieces.join(" · ") || subject?.summary || `${categoryLabel ?? "时间线"}动态暂无更多内容`
}

function buildTimelineProgressText(payload: Record<string, any>, subject?: BangumiSubject) {
  const episode = firstRecord(payload.episode, payload.ep)
  const episodeName = episode ? readString(episode.nameCn) ?? readString(episode.name_cn) ?? readString(episode.name) ?? readString(episode.title) : undefined
  if (episodeName) {
    return `看到 ${episodeName}`
  }

  const epStatus = readNumber(payload.epStatus) ?? readNumber(payload.ep_status) ?? readNumber(payload.eps) ?? readNumber(payload.episodeStatus) ?? readNumber(payload.episode_status)
  const volStatus = readNumber(payload.volStatus) ?? readNumber(payload.vol_status)
  if (subject && (typeof epStatus === "number" || typeof volStatus === "number")) {
    return buildProgressLabel(subject.kind, epStatus, volStatus, undefined)
  }

  return undefined
}

function readTimelineSourceName(input: Record<string, any>, source: Record<string, any>, payload: Record<string, any>, subject?: BangumiSubject) {
  const value =
    readString(input.sourceName) ??
    readString(input.source_name) ??
    readString(source.title) ??
    readString(source.nameCn) ??
    readString(source.name_cn) ??
    readString(source.name) ??
    readString(payload.sourceName) ??
    readString(payload.source_name)
  if (!value || value === subject?.title || value === subject?.originalTitle) {
    return undefined
  }
  return value
}

function readTimelineComment(input: Record<string, any>, payload: Record<string, any>, memo: Record<string, any>) {
  const status = isRecord(memo.status) ? memo.status : {}
  return readCleanText(payload.comment) ?? readCleanText(input.comment) ?? readCleanText(status.tsukkomi) ?? readCleanText(status.content)
}

function readTimelineCollectId(input: Record<string, any>, payload: Record<string, any>) {
  return readNumber(payload.collectID) ?? readNumber(payload.collectId) ?? readNumber(payload.collect_id) ?? readNumber(input.collectID) ?? readNumber(input.collectId) ?? readNumber(input.collect_id)
}

function buildTimelineReactionPath(category: number | undefined, replyable: boolean, collectId: number | undefined, timelineId: number, comment?: string) {
  if (replyable || category === 5) {
    return `p1/timeline/${timelineId}`
  }
  if (category === 3 && typeof collectId === "number" && comment) {
    return `p1/collections/subjects/${collectId}`
  }
  return undefined
}

function readTimelineReplies(input: Record<string, any>) {
  const direct = readNumber(input.repliesCount) ?? readNumber(input.replies_count) ?? readNumber(input.replyCount) ?? readNumber(input.reply_count) ?? readNumber(input.replies)
  if (typeof direct === "number") {
    return direct
  }
  if (Array.isArray(input.replies)) {
    return input.replies.length
  }
  if (isRecord(input.replies)) {
    return readNumber(input.replies.total) ?? readNumber(input.replies.count) ?? toArray(input.replies.data ?? input.replies.items).length
  }
  return 0
}

function adaptTimelineReactions(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((reaction) => adaptTimelineReaction(reaction)).filter(Boolean) as string[]
  }
  if (isRecord(input)) {
    return Object.entries(input).map(([emoji, value]) => {
      const count = readNumber(value) ?? (Array.isArray(value) ? value.length : isRecord(value) ? readNumber(value.count) ?? readNumber(value.total) ?? toArray(value.users).length : undefined)
      return count ? `${emoji} ${count}` : emoji
    })
  }
  return []
}

function adaptTimelineReaction(input: unknown) {
  if (typeof input === "string") {
    return input
  }
  if (!isRecord(input)) {
    return undefined
  }
  const emoji = readString(input.emoji) ?? readString(input.value) ?? readString(input.reaction) ?? readString(input.type) ?? "赞"
  const count = readNumber(input.count) ?? readNumber(input.total) ?? readNumber(input.valueCount) ?? readNumber(input.value_count) ?? toArray(input.users).length
  return count ? `${emoji} ${count}` : emoji
}

function describeTimelineBatch(value: unknown) {
  const direct = readString(value)
  if (direct) {
    return direct
  }
  const items = toArray(value)
  if (items.length > 1) {
    return `批量 ${items.length} 项`
  }
  if (isRecord(value)) {
    const total = readNumber(value.total) ?? readNumber(value.count) ?? toArray(value.items ?? value.data).length
    return total > 1 ? `批量 ${total} 项` : undefined
  }
  return undefined
}

function describeTimelineCategory(cat?: number) {
  switch (cat) {
    case 1:
      return "日常"
    case 2:
      return "维基"
    case 3:
      return "条目"
    case 4:
      return "进度"
    case 5:
      return "吐槽"
    case 6:
      return "日志"
    case 7:
      return "目录"
    case 8:
      return "人物"
    case 9:
      return "同人"
    default:
      return "动态"
  }
}

function formatBangumiTime(value?: string, timestamp?: number) {
  if (value) {
    return value.slice(0, 16).replace("T", " ")
  }

  if (typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0) {
    const resolved = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000
    const date = new Date(resolved)
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    const hour = `${date.getHours()}`.padStart(2, "0")
    const minute = `${date.getMinutes()}`.padStart(2, "0")
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  return "刚刚"
}

function adaptCalendarResponse(input: unknown): BangumiCalendarDay[] {
  const entries = normalizeCalendarEntries(input)
  if (!entries.length) {
    return []
  }

  return entries
    .map((entry, index) => {
      const subjectItems = entry.items
        .map((item, itemIndex) => adaptSubject(unwrapCalendarSubject(item), itemIndex))
        .filter(Boolean) as BangumiSubject[]

      if (!subjectItems.length) {
        return null
      }

      const weekdayNumber = entry.weekdayNumber ?? index + 1
      return {
        label: describeCalendarDay(weekdayNumber, index, entry.label),
        weekday: entry.weekday || weekdayLabels[(Math.max(1, weekdayNumber) - 1) % weekdayLabels.length],
        subjects: subjectItems.slice(0, 6),
      }
    })
    .filter(Boolean) as BangumiCalendarDay[]
}

function normalizeCalendarEntries(input: unknown): { weekdayNumber?: number; weekday?: string; label?: string; items: unknown[] }[] {
  if (Array.isArray(input)) {
    return input.map((entry, index) => {
      if (!isRecord(entry)) {
        return { weekdayNumber: index + 1, items: toArray(entry) }
      }

      const weekdaySource = isRecord(entry.weekday) ? entry.weekday : entry
      const weekdayNumber = readNumber(weekdaySource.id) ?? readNumber(entry.weekdayID) ?? readNumber(entry.weekday_id) ?? index + 1
      const weekday = readString(weekdaySource.en) ?? readString(weekdaySource.ja) ?? readString(entry.weekday) ?? weekdayLabels[(Math.max(1, weekdayNumber) - 1) % weekdayLabels.length]
      const label = readString(weekdaySource.cn) ?? readString(weekdaySource.zh) ?? readString(entry.label)
      return {
        weekdayNumber,
        weekday: weekday.toUpperCase().slice(0, 3),
        label,
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
    const normalizedWeekdayNumber = Number.isFinite(weekdayNumber) ? weekdayNumber : index + 1
    return {
      weekdayNumber: normalizedWeekdayNumber,
      weekday: weekdayLabels[(Math.max(1, normalizedWeekdayNumber) - 1) % weekdayLabels.length],
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

function unwrapCalendarSubject(input: unknown) {
  if (!isRecord(input)) {
    return input
  }
  return isRecord(input.subject) ? input.subject : input
}

function describeCalendarDay(weekdayNumber: number, index: number, fallback?: string) {
  const today = new Date().getDay() || 7
  if (weekdayNumber === today) {
    return "今天"
  }
  if (weekdayNumber === (today % 7) + 1) {
    return "明天"
  }
  return fallback ?? `周${["一", "二", "三", "四", "五", "六", "日"][(Math.max(1, weekdayNumber) - 1) % 7]}`
}

function adaptTrendingSection(input: unknown, title: string): BangumiDiscoverSection {
  const items = readBangumiList(input)
    .map((item, index) => adaptSubject(isRecord(item) && isRecord(item.subject) ? item.subject : item, index))
    .filter(Boolean)
    .slice(0, 5) as BangumiSubject[]

  return { title, items }
}

function mergeSubjectDetails(subject: BangumiSubject, details: unknown[], fallback: BangumiSubject, collectionResponse?: unknown) {
  const [charactersResponse, relationsResponse, recsResponse, indexesResponse, episodesResponse, commentsResponse, topicsResponse, reviewsResponse, collectorsResponse] = details

  const characterItems = readBangumiList(charactersResponse)
    .map((item, index) => adaptSubjectCharacter(item, index))
    .filter(Boolean)
    .slice(0, 8) as BangumiSubjectCharacter[]
  const cast = characterItems.map((item) => item.character.name).slice(0, 4)

  const relationItems = readBangumiList(relationsResponse)
    .map((item, index) => adaptSubjectRelation(item, index))
    .filter(Boolean)
    .slice(0, 8) as BangumiSubjectRelationItem[]
  const relations = relationItems.map((item) => `${item.relation}：${item.subject.title}`)

  const recommendations = readBangumiList(recsResponse)
    .map((item, index) => adaptRecommendationSubject(item, index))
    .filter(Boolean)
    .slice(0, 8) as BangumiSubject[]

  const indexes = readBangumiList(indexesResponse)
    .map((item, index) => adaptSubjectIndex(item, index))
    .filter(Boolean)
    .slice(0, 12) as BangumiSubjectIndexItem[]

  const recCount = recommendations.length
  const indexCount = indexes.length
  const episodes = readBangumiList(episodesResponse)
    .map((item, index) => adaptEpisode(item, index))
    .filter(Boolean) as BangumiSubjectEpisode[]
  const comments = readBangumiList(commentsResponse)
    .map((item, index) => adaptSubjectComment(item, index))
    .filter(Boolean) as BangumiSubjectComment[]
  const topics = readBangumiList(topicsResponse)
    .map((item, index) => adaptSubjectTopic(item, index))
    .filter(Boolean) as BangumiSubjectTopic[]
  const reviews = readBangumiList(reviewsResponse)
    .map((item, index) => adaptSubjectReview(item, index))
    .filter(Boolean)
    .slice(0, 6) as BangumiSubjectReview[]
  const collectors = readBangumiList(collectorsResponse)
    .map((item, index) => adaptSubjectCollector(item, index))
    .filter(Boolean)
    .slice(0, 8) as BangumiSubjectCollector[]

  const collectionDetail = adaptSubjectCollectionDetail(collectionResponse, subject.kind)

  return {
    subject: {
      ...subject,
      cast: cast.length ? cast : fallback.cast,
      relations: relations.length ? relations : fallback.relations,
      discussionCount: topics.length ? topics.length : recCount > 0 ? Math.max(fallback.discussionCount, recCount) : fallback.discussionCount,
      tags: fallback.tags,
      episodes: episodes.length ? episodes.map((episode) => episode.name).slice(0, 12) : fallback.episodes,
      collection: collectionDetail.collection ?? subject.collection,
      progressLabel: collectionDetail.progressLabel ?? deriveSubjectProgressLabel(subject, episodes, fallback.progressLabel),
      meta: indexCount > 0 ? `${subject.meta} / 目录 ${indexCount}` : subject.meta,
    },
    episodes: episodes.length ? episodes : adaptFallbackEpisodes(fallback),
    comments,
    topics,
    reviews,
    collectors,
    characters: characterItems,
    relations: relationItems,
    recommendations,
    indexes,
  }
}

function adaptSubjectCharacter(input: unknown, index: number): BangumiSubjectCharacter | null {
  if (!isRecord(input)) {
    return null
  }

  const characterSource = isRecord(input.character) ? input.character : input
  const character = adaptMonoSearchItem(characterSource, index, "角色")
  if (!character) {
    return null
  }

  const actors = readBangumiList(input.actors ?? input.persons ?? input.casts ?? input.cv)
    .map((item, actorIndex) => {
      const actorSource = isRecord(item) && isRecord(item.person) ? item.person : item
      return adaptMonoSearchItem(actorSource, actorIndex, "人物")
    })
    .filter(Boolean)
    .slice(0, 3) as BangumiSearchMonoItem[]

  const role = readString(input.typeName) ?? readString(input.type_name) ?? readString(input.roleName) ?? readString(input.role_name) ?? character.role
  return {
    id: `${character.id}-${role}`,
    character: {
      ...character,
      role,
      meta: [role, character.collects ? `${character.collects} 收藏` : undefined].filter(Boolean).join(" · ") || character.meta,
    },
    actors,
    role,
  }
}

function adaptSubjectRelation(input: unknown, index: number): BangumiSubjectRelationItem | null {
  if (!isRecord(input)) {
    return null
  }

  const subjectSource = isRecord(input.subject)
    ? input.subject
    : isRecord(input.target)
      ? input.target
      : isRecord(input.relatedSubject)
        ? input.relatedSubject
        : input
  const subject = adaptSubject(subjectSource, index)
  if (!subject) {
    return null
  }

  const relation = readString(input.relation) ?? readString(input.typeName) ?? readString(input.type_name) ?? readString(input.label) ?? "关联"
  return {
    id: `${relation}-${subject.id}`,
    relation,
    subject,
  }
}

function adaptRecommendationSubject(input: unknown, index: number): BangumiSubject | null {
  if (!isRecord(input)) {
    return null
  }
  const subjectSource = isRecord(input.subject)
    ? input.subject
    : isRecord(input.target)
      ? input.target
      : isRecord(input.recommendation)
        ? input.recommendation
        : input
  return adaptSubject(subjectSource, index)
}

function adaptSubjectIndex(input: unknown, index: number): BangumiSubjectIndexItem | null {
  if (!isRecord(input)) {
    return null
  }

  const source = isRecord(input.index)
    ? input.index
    : isRecord(input.idx)
      ? input.idx
      : isRecord(input.collect)
        ? input.collect
        : isRecord(input.entry)
          ? input.entry
          : input

  const id = readNumber(source.id) ?? readNumber(input.id) ?? readNumber(input.index_id) ?? readNumber(input.idx_id) ?? index + 1
  const title = readString(source.title) ?? readString(source.name) ?? readString(input.title) ?? readString(input.name) ?? `目录 #${id}`
  const description = readString(source.description) ?? readString(source.desc) ?? readString(source.summary) ?? readString(source.comment) ?? readString(input.description) ?? readString(input.desc) ?? readString(input.summary) ?? readString(input.comment) ?? "暂无简介"
  const total = readNumber(source.total) ?? readNumber(source.count) ?? readNumber(source.subjectsCount) ?? readNumber(source.subjects_count) ?? readNumber(source.total_count) ?? readNumber(source.subject_count) ?? readNumber(input.total) ?? readNumber(input.count) ?? readNumber(input.subjectsCount) ?? readNumber(input.subjects_count) ?? readNumber(input.total_count) ?? readNumber(input.subject_count) ?? readIndexSubjectList(input).length
  return {
    id,
    title,
    description,
    total,
  }
}

function adaptSubjectCollectionDetail(input: unknown, kind: BangumiSubject["kind"]) {
  if (!isRecord(input)) {
    return {}
  }

  const subjectSource = isRecord(input.subject) ? input.subject : {}
  const ctype = readNumber(input.type) ?? readNumber(input.ctype) ?? readNumber(input.collection?.type)
  const epStatus = readNumber(input.epStatus) ?? readNumber(input.ep_status) ?? readNumber(input.ep_status?.type)
  const volStatus = readNumber(input.volStatus) ?? readNumber(input.vol_status)
  const collection = typeof ctype === "number" ? mapCollectionLabel(ctype) : undefined
  return {
    collection,
    progressLabel: buildProgressLabel(kind, epStatus, volStatus, undefined) ?? buildProgressLabel(kind, readNumber(subjectSource.epStatus), readNumber(subjectSource.volStatus), undefined),
  }
}

function deriveSubjectProgressLabel(subject: BangumiSubject, episodes: BangumiSubjectEpisode[], fallback: string) {
  if (!episodes.length) {
    return subject.progressLabel || fallback
  }
  const watched = episodes.filter((episode) => episode.collection === "看过").length
  if (!watched) {
    return subject.collection === "未收藏" ? "未收藏" : subject.progressLabel || fallback
  }
  return syncSubjectProgressFromEpisodes(subject, episodes).progressLabel
}

function adaptCommentReply(input: unknown, index: number): BangumiCommentReply | null {
  if (!isRecord(input)) {
    return null
  }

  const userSource = isRecord(input.user) ? input.user : isRecord(input.creator) ? input.creator : isRecord(input.author) ? input.author : {}
  return {
    id: readNumber(input.id) ?? index + 1,
    user: readString(userSource.nickname) ?? readString(userSource.username) ?? readString(userSource.name) ?? readString(input.username) ?? "Bangumi 用户",
    avatarUrl: readBangumiImageUrl(userSource),
    content: readString(input.content) ?? readString(input.comment) ?? readString(input.body) ?? readString(input.text) ?? "暂无内容",
    time: formatBangumiTime(readString(input.createdAt) ?? readString(input.created_at) ?? readString(input.updatedAt) ?? readString(input.updated_at), readNumber(input.createdAt) ?? readNumber(input.created_at) ?? readNumber(input.updatedAt) ?? readNumber(input.updated_at)),
    floor: readNumber(input.floor) ?? readNumber(input.position) ?? index + 1,
  }
}

function adaptEpisode(input: unknown, index: number): BangumiSubjectEpisode | null {
  if (!isRecord(input)) {
    return null
  }

  const id = readNumber(input.id) ?? index + 1
  const sort = readNumber(input.sort) ?? readNumber(input.ep) ?? index + 1
  const originalName = readString(input.name) ?? readString(input.title)
  const translatedName = readString(input.nameCn) ?? readString(input.name_cn)
  const name = originalName ?? translatedName ?? `EP ${sort}`
  const type = describeEpisodeType(readNumber(input.type))

  return {
    id,
    name,
    originalName: translatedName && translatedName !== name ? translatedName : undefined,
    sort,
    type,
    airdate: readString(input.airdate) ?? readString(input.airDate) ?? readString(input.date) ?? "未定",
    duration: readString(input.duration) ?? readString(input.desc) ?? "",
    comment: readNumber(input.comment) ?? readNumber(input.comments) ?? 0,
    collection: mapEpisodeCollectionLabel(readNumber(input.collection?.type) ?? readNumber(input.collectionType) ?? readNumber(input.collection_type) ?? readNumber(input.status)),
  }
}

function adaptSubjectReview(input: unknown, index: number): BangumiSubjectReview | null {
  if (!isRecord(input)) {
    return null
  }

  const reviewSource = firstRecord(input.review, input.blog, input.entry, input.topic, input.post) ?? input
  const userSource = firstRecord(
    input.user,
    input.creator,
    input.author,
    input.member,
    reviewSource.user,
    reviewSource.creator,
    reviewSource.author,
    reviewSource.member,
  ) ?? {}
  const id =
    readNumber(reviewSource.id) ??
    readNumber(input.id) ??
    readNumber(reviewSource.topicId) ??
    readNumber(reviewSource.topic_id) ??
    readNumber(input.topicId) ??
    readNumber(input.topic_id) ??
    index + 1
  const title =
    cleanBangumiText(readString(reviewSource.title) ?? readString(reviewSource.name) ?? readString(input.title) ?? readString(input.name)) ??
    `长评 #${id}`
  const content =
    readReviewText(reviewSource) ??
    readReviewText(input) ??
    "暂无长评内容"
  const summary = summarizeBangumiText(
    readCleanText(reviewSource.summary) ??
      readCleanText(reviewSource.excerpt) ??
      readCleanText(reviewSource.desc) ??
      readCleanText(input.summary) ??
      readCleanText(input.excerpt) ??
      content,
  )

  return {
    id,
    title,
    user: readString(userSource.nickname) ?? readString(userSource.username) ?? readString(userSource.name) ?? readString(input.username) ?? "Bangumi 用户",
    avatarUrl: readBangumiImageUrl(userSource),
    summary,
    content,
    replies: readNumber(reviewSource.replies) ?? readNumber(reviewSource.replyCount) ?? readNumber(reviewSource.reply_count) ?? readNumber(reviewSource.comments) ?? readNumber(input.replies) ?? readNumber(input.replyCount) ?? readNumber(input.reply_count) ?? readNumber(input.comments) ?? 0,
    time: formatBangumiTime(readString(reviewSource.updatedAt) ?? readString(reviewSource.updated_at) ?? readString(reviewSource.createdAt) ?? readString(reviewSource.created_at) ?? readString(input.updatedAt) ?? readString(input.updated_at) ?? readString(input.createdAt) ?? readString(input.created_at), readNumber(reviewSource.updatedAt) ?? readNumber(reviewSource.updated_at) ?? readNumber(reviewSource.createdAt) ?? readNumber(reviewSource.created_at) ?? readNumber(input.updatedAt) ?? readNumber(input.updated_at) ?? readNumber(input.createdAt) ?? readNumber(input.created_at)),
  }
}

function adaptSubjectCollector(input: unknown, index: number): BangumiSubjectCollector | null {
  if (!isRecord(input)) {
    return null
  }

  const userSource = isRecord(input.user) ? input.user : isRecord(input.creator) ? input.creator : isRecord(input.member) ? input.member : input
  const username = readString(userSource.username) ?? readString(userSource.name) ?? readString(input.username) ?? `user-${index + 1}`
  const nickname = readString(userSource.nickname) ?? readString(userSource.displayName) ?? readString(userSource.display_name) ?? username
  const ctype = readNumber(input.type) ?? readNumber(input.ctype) ?? readNumber(input.collection?.type)
  return {
    id: `${readNumber(userSource.id) ?? username}-${index}`,
    username,
    nickname,
    avatarUrl: readBangumiImageUrl(userSource),
    collection: mapCollectionLabel(ctype),
    comment: readString(input.comment) ?? readString(input.content) ?? readString(input.text) ?? "",
    score: readNumber(input.rate) ?? readNumber(input.score) ?? 0,
    time: formatBangumiTime(readString(input.updatedAt) ?? readString(input.updated_at) ?? readString(input.createdAt) ?? readString(input.created_at), readNumber(input.updatedAt) ?? readNumber(input.updated_at) ?? readNumber(input.createdAt) ?? readNumber(input.created_at)),
  }
}

function adaptSubjectComment(input: unknown, index: number): BangumiSubjectComment | null {
  if (!isRecord(input)) {
    return null
  }

  const userSource = isRecord(input.user) ? input.user : isRecord(input.creator) ? input.creator : {}
  const content =
    readString(input.comment) ??
    readString(input.content) ??
    readString(input.text) ??
    readString(input.summary) ??
    "暂无短评内容"

  return {
    id: readNumber(input.id) ?? index + 1,
    user: readString(userSource.nickname) ?? readString(userSource.username) ?? readString(userSource.name) ?? readString(input.username) ?? "Bangumi 用户",
    avatarUrl: readBangumiImageUrl(userSource),
    content,
    score: readNumber(input.rate) ?? readNumber(input.score) ?? 0,
    time: formatBangumiTime(readString(input.updatedAt) ?? readString(input.updated_at) ?? readString(input.createdAt) ?? readString(input.created_at), readNumber(input.updatedAt) ?? readNumber(input.updated_at) ?? readNumber(input.createdAt) ?? readNumber(input.created_at)),
  }
}

function adaptRakuenTopic(input: unknown, index: number, fallbackType?: BangumiRakuenTopicType): BangumiRakuenTopic | null {
  if (!isRecord(input)) {
    return null
  }

  const topicSource = firstRecord(input.topic, input.post, input.entry) ?? input
  const groupSource = firstRecord(input.group, input.club, input.board, topicSource.group, topicSource.club, topicSource.board) ?? {}
  const userSource = firstRecord(input.user, input.creator, input.author, input.member, topicSource.user, topicSource.creator, topicSource.author, topicSource.member) ?? {}
  const subjectSource = firstRecord(input.subject, topicSource.subject) ?? {}
  const link = readString(topicSource.link) ?? readString(topicSource.url) ?? readString(topicSource.path) ?? readString(input.link) ?? readString(input.url) ?? ""
  const explicitId = readNumber(topicSource.id) ?? readNumber(topicSource.topicId) ?? readNumber(topicSource.topic_id) ?? readNumber(input.id)
  const explicitType = readRakuenTopicType(fallbackType, topicSource, input)
  const identity = readRakuenTopicIdentity(link) ?? readRakuenTopicIdentity(readString(topicSource.topicId) ?? readString(topicSource.topic_id))
  const id = identity?.id ?? explicitId
  const inferredType = identity?.type ?? explicitType
  if (!id || !inferredType) {
    return null
  }

  const topicKey = `${inferredType}/${id}`
  const replies =
    readNumber(topicSource.replies) ??
    readNumber(topicSource.replyCount) ??
    readNumber(topicSource.reply_count) ??
    readNumber(topicSource.comments) ??
    readNumber(topicSource.posts) ??
    readNumber(input.replies) ??
    0
  const time = formatBangumiTime(readString(topicSource.updatedAt) ?? readString(topicSource.updated_at) ?? readString(topicSource.createdAt) ?? readString(topicSource.created_at) ?? readString(input.updatedAt) ?? readString(input.updated_at), readNumber(topicSource.updatedAt) ?? readNumber(topicSource.updated_at) ?? readNumber(topicSource.createdAt) ?? readNumber(topicSource.created_at) ?? readNumber(input.updatedAt) ?? readNumber(input.updated_at))
  const summary =
    cleanBangumiText(readString(topicSource.summary) ?? readString(topicSource.content) ?? readString(topicSource.body) ?? readString(topicSource.text) ?? readString(input.summary)) ??
    "暂无正文预览"

  return {
    id,
    topicType: inferredType,
    topicKey,
    url: identity?.url ?? buildRakuenTopicUrl(id, inferredType),
    title: cleanBangumiText(readString(topicSource.title) ?? readString(topicSource.name) ?? readString(input.title) ?? readString(input.name)) ?? `话题 #${id}`,
    group: readString(groupSource.title) ?? readString(groupSource.nameCn) ?? readString(groupSource.name_cn) ?? readString(groupSource.name) ?? readString(subjectSource.nameCn) ?? readString(subjectSource.name_cn) ?? readString(subjectSource.name) ?? readString(subjectSource.title) ?? readString(topicSource.groupName) ?? readString(topicSource.group_name) ?? (inferredType === "subject" ? "条目讨论" : "超展开"),
    author: readString(userSource.nickname) ?? readString(userSource.username) ?? readString(userSource.name) ?? readString(topicSource.username) ?? "Bangumi 用户",
    replies,
    heat: replies >= 50 ? "热议中" : replies >= 10 ? "今日热门" : "新讨论",
    time,
    summary,
  }
}

function readRakuenTopicType(fallbackType: BangumiRakuenTopicType | undefined, ...values: unknown[]): BangumiRakuenTopicType | undefined {
  if (fallbackType) {
    return fallbackType
  }
  for (const value of values) {
    if (!isRecord(value)) {
      continue
    }
    const raw = [value.type, value.category, value.kind, value.topicType, value.topic_type, value.discussionType, value.discussion_type]
      .map((item) => readString(item)?.toLowerCase())
      .find(Boolean)
    if (raw?.includes("subject") || raw?.includes("条目")) {
      return "subject"
    }
    if (raw?.includes("group") || raw?.includes("小组")) {
      return "group"
    }
    if (isRecord(value.subject)) {
      return "subject"
    }
    if (isRecord(value.group) || isRecord(value.club) || isRecord(value.board)) {
      return "group"
    }
  }
  return undefined
}

function adaptSubjectTopic(input: unknown, index: number): BangumiSubjectTopic | null {
  if (!isRecord(input)) {
    return null
  }

  const userSource = isRecord(input.user) ? input.user : isRecord(input.creator) ? input.creator : {}
  return {
    id: readNumber(input.id) ?? index + 1,
    title: readString(input.title) ?? readString(input.name) ?? `讨论 #${index + 1}`,
    user: readString(userSource.nickname) ?? readString(userSource.username) ?? readString(userSource.name) ?? readString(input.username) ?? "Bangumi 用户",
    replies: readNumber(input.replies) ?? readNumber(input.replyCount) ?? readNumber(input.reply_count) ?? 0,
    time: formatBangumiTime(readString(input.updatedAt) ?? readString(input.updated_at) ?? readString(input.createdAt) ?? readString(input.created_at), readNumber(input.updatedAt) ?? readNumber(input.updated_at) ?? readNumber(input.createdAt) ?? readNumber(input.created_at)),
  }
}

function adaptFallbackEpisodes(subject: BangumiSubject): BangumiSubjectEpisode[] {
  return subject.episodes.map((episode, index) => ({
    id: index + 1,
    name: episode,
    originalName: undefined,
    sort: index + 1,
    type: subject.kind === "音乐" ? "曲目" : subject.kind === "书籍" ? "单行本" : "本篇",
    airdate: "mock",
    duration: "",
    comment: 0,
    collection: "未看",
  }))
}

function mapEpisodeCollectionLabel(type?: number): BangumiSubjectEpisode["collection"] {
  switch (type) {
    case 2:
      return "看过"
    case 3:
      return "抛弃"
    default:
      return "未看"
  }
}

function describeEpisodeType(type?: number) {
  switch (type) {
    case 1:
      return "本篇"
    case 2:
      return "特别篇"
    case 3:
      return "OP"
    case 4:
      return "ED"
    case 5:
      return "预告/广告"
    case 6:
      return "MAD"
    default:
      return "章节"
  }
}

function buildSubjectDetailMessage(episodes: number, comments: number, topics: number, characters = 0, related = 0, recommendations = 0, indexes = 0, reviews = 0, collectors = 0) {
  const parts = [
    episodes ? `章节 ${episodes}` : undefined,
    comments ? `短评 ${comments}` : undefined,
    topics ? `讨论 ${topics}` : undefined,
    reviews ? `长评 ${reviews}` : undefined,
    collectors ? `收藏用户 ${collectors}` : undefined,
    characters ? `角色 ${characters}` : undefined,
    related ? `关联 ${related}` : undefined,
    recommendations ? `推荐 ${recommendations}` : undefined,
    indexes ? `目录 ${indexes}` : undefined,
  ].filter(Boolean)
  return parts.length
    ? `已优先使用条目详情、章节、短评与讨论真实响应：${parts.join(" / ")}。`
    : "已接通条目详情接口，章节、短评或讨论暂无可展示数据。"
}

function buildCollectionSummaryFromSubjects(items: readonly BangumiSubject[]): BangumiCollectionSummaryItem[] {
  return collectionSummaryTypes
    .map((item) => ({
      title: item.title,
      count: items.filter((subject) => subject.collection === item.title).length,
    }))
    .filter((item) => item.count > 0)
}

function buildSubjectTypeSummaryFromUser(input: unknown): BangumiSubjectTypeSummaryItem[] {
  if (!isRecord(input)) {
    return []
  }

  const candidates: unknown[] = [
    input.stats,
    input.stat,
    input.subjectStats,
    input.subject_stats,
    input.subjectTypeStats,
    input.subject_type_stats,
    input.collectionStats,
    input.collection_stats,
    input.collectionsCount,
    input.collections_count,
    input.subjectTypeSummary,
    input.subject_type_summary,
    input.subjectTypes,
    input.subject_types,
  ]

  for (const source of candidates) {
    const items = readSubjectTypeSummaryFromSource(source)
    if (items.length) {
      return items
    }
  }

  return []
}

async function loadSubjectTypeSummaryFromCollectionPages(): Promise<{ items: BangumiSubjectTypeSummaryItem[]; total: number }> {
  const pageSize = 50
  const maxPages = 20
  const counts = new Map<BangumiSubjectTypeSummaryItem["title"], number>()
  const seenSubjectKeys = new Set<string>()
  let offset = 0
  let expectedTotal: number | undefined
  let previousSignature = ""

  for (let page = 0; page < maxPages; page += 1) {
    const response = await getSubjectCollections({ limit: pageSize, offset })
    const container = isRecord(response) ? response : {}
    const entries = readBangumiList(response)

    if (!entries.length) {
      break
    }

    const signature = entries.map((entry, index) => readCollectionEntrySignature(entry, index)).join("|")
    if (page > 0 && signature === previousSignature) {
      break
    }
    previousSignature = signature

    if (typeof expectedTotal !== "number") {
      expectedTotal = readNumber(container.total) ?? readNumber(container.count) ?? readNumber(container.totalCount) ?? readNumber(container.total_count)
    }

    for (const entry of entries) {
      const subjectKey = readCollectionSubjectKey(entry)
      if (subjectKey && seenSubjectKeys.has(subjectKey)) {
        continue
      }
      if (subjectKey) {
        seenSubjectKeys.add(subjectKey)
      }

      const title = readCollectionSubjectTypeTitle(entry)
      if (title) {
        counts.set(title, (counts.get(title) ?? 0) + 1)
      }
    }

    offset += entries.length
    if (entries.length < pageSize) {
      break
    }
    if (typeof expectedTotal === "number" && offset >= expectedTotal) {
      break
    }
  }

  const items = buildSubjectTypeSummaryFromCounts(counts)
  return { items, total: sumSubjectTypeSummary(items) }
}

function readSubjectTypeSummaryFromSource(source: unknown): BangumiSubjectTypeSummaryItem[] {
  const entryItems = readSubjectTypeSummaryFromEntries(toArray(source))
  if (entryItems.length) {
    return entryItems
  }

  if (!isRecord(source)) {
    return []
  }

  const directItems = readSubjectTypeSummaryFromRecord(source)
  if (directItems.length) {
    return directItems
  }

  const nestedKeys = ["subjects", "subjectTypes", "subject_types", "collections", "collects", "items", "data", "list", "summary", "stats"]
  for (const key of nestedKeys) {
    const nestedItems = readSubjectTypeSummaryFromSource(source[key])
    if (nestedItems.length) {
      return nestedItems
    }
  }

  return []
}

function readSubjectTypeSummaryFromRecord(source: Record<string, any>): BangumiSubjectTypeSummaryItem[] {
  return subjectTypeSummaryTypes
    .map((item) => ({ title: item.title, count: readSubjectTypeCount(source, item.keys) ?? 0 }))
    .filter((item) => item.count > 0)
}

function readSubjectTypeSummaryFromEntries(entries: unknown[]): BangumiSubjectTypeSummaryItem[] {
  const counts = new Map<BangumiSubjectTypeSummaryItem["title"], number>()

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue
    }

    const type = readNumber(entry.type) ?? readNumber(entry.subjectType) ?? readNumber(entry.subject_type) ?? readNumber(entry.cat) ?? readNumber(entry.id)
    const label = readString(entry.title) ?? readString(entry.name) ?? readString(entry.label) ?? readString(entry.typeName) ?? readString(entry.type_name)
    const matched = mapSubjectTypeSummaryTitle(type) ?? matchSubjectTypeSummaryLabel(label)
    const count = readNumber(entry.count) ?? readNumber(entry.total) ?? readNumber(entry.totalCount) ?? readNumber(entry.total_count) ?? readNumber(entry.value)

    if (matched && count && count > 0) {
      counts.set(matched, (counts.get(matched) ?? 0) + count)
    }
  }

  return buildSubjectTypeSummaryFromCounts(counts)
}

function readCollectionSubjectTypeTitle(entry: unknown): BangumiSubjectTypeSummaryItem["title"] | undefined {
  if (!isRecord(entry)) {
    return undefined
  }

  const subject = readCollectionSubjectSource(entry)
  const type =
    readNumber(subject?.type) ??
    readNumber(subject?.subjectType) ??
    readNumber(subject?.subject_type) ??
    readNumber(entry.subjectType) ??
    readNumber(entry.subject_type) ??
    readNumber(entry.subjectCat) ??
    readNumber(entry.subject_cat)
  const label =
    readString(subject?.typeName) ??
    readString(subject?.type_name) ??
    readString(subject?.category) ??
    readString(subject?.cat) ??
    readString(entry.subjectTypeName) ??
    readString(entry.subject_type_name) ??
    readString(entry.subjectCategory) ??
    readString(entry.subject_category)

  return mapSubjectTypeSummaryTitle(type) ?? matchSubjectTypeSummaryLabel(label)
}

function readCollectionSubjectSource(entry: Record<string, any>): Record<string, any> | undefined {
  const nestedKeys = ["subject", "subjectInfo", "subject_info", "item", "entry"]
  for (const key of nestedKeys) {
    if (isRecord(entry[key])) {
      return entry[key]
    }
  }

  return looksLikeSubjectRecord(entry) ? entry : undefined
}

function looksLikeSubjectRecord(source: Record<string, any>) {
  return Boolean(
    readString(source.name) ||
    readString(source.nameCn) ||
    readString(source.name_cn) ||
    readString(source.title) ||
    isRecord(source.images) ||
    isRecord(source.rating) ||
    readNumber(source.eps) ||
    readNumber(source.volumes) ||
    readNumber(source.tracks),
  )
}

function readCollectionSubjectKey(entry: unknown) {
  if (!isRecord(entry)) {
    return undefined
  }

  const subject = readCollectionSubjectSource(entry)
  const id = readNumber(subject?.id) ?? readNumber(entry.subjectId) ?? readNumber(entry.subject_id)
  if (typeof id === "number") {
    return `subject:${id}`
  }

  const title = readString(subject?.name) ?? readString(subject?.nameCn) ?? readString(subject?.name_cn) ?? readString(subject?.title)
  return title ? `subject:${title}` : undefined
}

function readCollectionEntrySignature(entry: unknown, index: number) {
  const key = readCollectionSubjectKey(entry)
  if (key) {
    return key
  }

  if (!isRecord(entry)) {
    return `row:${index}`
  }

  const subject = readCollectionSubjectSource(entry)
  const title = readString(subject?.name) ?? readString(subject?.nameCn) ?? readString(subject?.name_cn) ?? readString(subject?.title)
  const type = readNumber(subject?.type) ?? readNumber(entry.subjectType) ?? readNumber(entry.subject_type)
  const updatedAt = readString(entry.updatedAt) ?? readString(entry.updated_at)
  const signatureParts = [title, type, updatedAt].filter((value) => value !== undefined && `${value}`.length > 0)
  return signatureParts.length ? signatureParts.join(":") : `row:${index}`
}

function mapSubjectTypeSummaryTitle(type?: number): BangumiSubjectTypeSummaryItem["title"] | undefined {
  return subjectTypeSummaryTypes.find((item) => item.type === type)?.title
}

function matchSubjectTypeSummaryLabel(label?: string): BangumiSubjectTypeSummaryItem["title"] | undefined {
  const normalized = label?.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }

  const exactTitle = subjectTypeSummaryTypes.find((item) => normalized === item.title.toLowerCase())
  if (exactTitle) {
    return exactTitle.title
  }

  const includedTitle = subjectTypeSummaryTypes.find((item) => normalized.includes(item.title))
  if (includedTitle) {
    return includedTitle.title
  }

  return subjectTypeSummaryTypes.find((item) => item.keys.some((key) => {
    const normalizedKey = key.toLowerCase()
    return normalized === normalizedKey || (normalizedKey.length > 2 && normalized.includes(normalizedKey))
  }))?.title
}

function buildSubjectTypeSummaryFromCounts(counts: Map<BangumiSubjectTypeSummaryItem["title"], number>): BangumiSubjectTypeSummaryItem[] {
  return subjectTypeSummaryTypes
    .map((item) => ({ title: item.title, count: counts.get(item.title) ?? 0 }))
    .filter((item) => item.count > 0)
}

function readSubjectTypeCount(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    const direct = readNumber(value)
    if (typeof direct === "number") {
      return direct
    }

    if (isRecord(value)) {
      const nested = readNumber(value.count) ?? readNumber(value.total) ?? readNumber(value.totalCount) ?? readNumber(value.total_count) ?? readNumber(value.value)
      if (typeof nested === "number") {
        return nested
      }
    }
  }

  return undefined
}

function buildSubjectTypeSummaryFromCollectionLabels(labels: readonly string[]): BangumiSubjectTypeSummaryItem[] {
  const counts = new Map<BangumiSubjectTypeSummaryItem["title"], number>()

  for (const label of labels) {
    const [title, countValue] = label.split(" ")
    const matched = subjectTypeSummaryTypes.find((item) => item.title === title)
    const count = readNumber(countValue)
    if (matched && count && count > 0) {
      counts.set(matched.title, count)
    }
  }

  return subjectTypeSummaryTypes
    .map((item) => ({ title: item.title, count: counts.get(item.title) ?? 0 }))
    .filter((item) => item.count > 0)
}

function sumSubjectTypeSummary(items: readonly BangumiSubjectTypeSummaryItem[]) {
  return items.reduce((sum, item) => sum + item.count, 0)
}

function adaptCollectionSubject(input: unknown, index: number): BangumiSubject | null {
  if (!isRecord(input)) {
    return null
  }

  const subjectSource = isRecord(input.subject) ? input.subject : input
  const adapted = adaptSubject(subjectSource, index)
  if (!adapted) {
    return null
  }

  const type = readNumber(input.type) ?? readNumber(subjectSource.type)
  const epStatus = readNumber(input.epStatus) ?? readNumber(input.ep_status)
  const volStatus = readNumber(input.volStatus) ?? readNumber(input.vol_status)
  const updatedAt = readString(input.updatedAt) ?? readString(input.updated_at)
  const kind = mapSubjectKind(type) ?? adapted.kind

  return {
    ...adapted,
    kind,
    collection: mapCollectionLabel(readNumber(input.type) ?? readNumber(input.ctype)),
    progressLabel: buildProgressLabel(kind, epStatus, volStatus, adapted.progressLabel),
    meta: updatedAt ? `${adapted.meta} / 更新于 ${updatedAt.slice(0, 10)}` : adapted.meta,
  }
}

function mapCollectionType(label: string) {
  switch (label) {
    case "想看":
      return 1
    case "看过":
      return 2
    case "在看":
      return 3
    case "搁置":
      return 4
    case "抛弃":
      return 5
    default:
      return 0
  }
}

function mapCollectionLabel(ctype?: number) {
  switch (ctype) {
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

function buildProgressLabel(
  kind: BangumiSubject["kind"],
  epStatus?: number,
  volStatus?: number,
  fallback?: string,
) {
  if (kind === "书籍" && typeof volStatus === "number") {
    return `读到 Vol. ${Math.max(0, volStatus)}`
  }
  if (typeof epStatus === "number") {
    if (kind === "音乐") {
      return `听到 Track ${Math.max(0, epStatus)}`
    }
    if (kind === "游戏") {
      return `进度 ${Math.max(0, epStatus)}`
    }
    return `看到 EP ${Math.max(0, epStatus)}`
  }
  return fallback ?? "进度待同步"
}

function adaptNoticeItem(input: unknown, index: number) {
  if (!isRecord(input)) {
    return null
  }

  const sourceUser = isRecord(input.user) ? input.user : isRecord(input.sender) ? input.sender : {}
  const subjectSource =
    isRecord(input.subject) ? input.subject : isRecord(input.relatedSubject) ? input.relatedSubject : isRecord(input.target) ? input.target : undefined
  const subject = subjectSource ? adaptSubject(subjectSource, index) ?? undefined : undefined
  const title =
    readString(input.title) ??
    readString(input.label) ??
    readString(input.typeDescription) ??
    readString(input.type_description) ??
    readString(input.name) ??
    describeNoticeType(readNumber(input.type)) ??
    "Bangumi 提醒"
  const detail =
    readString(input.content) ??
    readString(input.comment) ??
    readString(input.message) ??
    readString(input.summary) ??
    readString(input.body) ??
    buildNoticeDetail(input) ??
    subject?.title ??
    "暂无更多内容"
  const unreadFlag = input.unread ?? input.isUnread ?? input.is_unread
  const unread = typeof unreadFlag === "boolean" ? unreadFlag : readNumber(unreadFlag) === 1

  return {
    id: readNumber(input.id) ?? index + 1,
    title,
    detail,
    time: formatBangumiTime(
      readString(input.createdAt) ??
        readString(input.created_at) ??
        readString(input.updatedAt) ??
        readString(input.updated_at),
      readNumber(input.createdAt) ?? readNumber(input.created_at) ?? readNumber(input.updatedAt) ?? readNumber(input.updated_at),
    ),
    unread,
    user: readString(sourceUser.nickname) ?? readString(sourceUser.username) ?? readString(sourceUser.name) ?? readString(input.nickname) ?? "Bangumi 用户",
    subject,
  }
}

function adaptMonoSearchItem(input: unknown, index: number, kind: "角色" | "人物"): BangumiSearchMonoItem | null {
  if (!isRecord(input)) {
    return null
  }

  const id = readNumber(input.id) ?? index + 1
  const name = readString(input.nameCN) ?? readString(input.nameCn) ?? readString(input.name_cn) ?? readString(input.name) ?? `${kind} #${id}`
  const originalName = readString(input.name) ?? name
  const summary = readString(input.summary) ?? readString(input.info) ?? "暂无简介"
  const role = kind === "角色" ? describeCharacterRole(readNumber(input.role)) : describePersonCareer(input)
  const collects = readNumber(input.collects) ?? readNumber(input.collect) ?? 0
  const comments = readNumber(input.comment) ?? readNumber(input.comments) ?? 0
  const imageUrl = readBangumiImageUrl(input)

  return {
    id,
    name,
    originalName,
    summary,
    meta: [role, collects ? `${collects} 收藏` : undefined, comments ? `${comments} 吐槽` : undefined].filter(Boolean).join(" · ") || kind,
    role,
    collects,
    comments,
    kind,
    imageUrl,
  }
}

function describeCharacterRole(role?: number) {
  switch (role) {
    case 1:
      return "主角"
    case 2:
      return "配角"
    case 3:
      return "客串"
    default:
      return "角色"
  }
}

function describePersonCareer(input: Record<string, any>) {
  const career = toArray(input.career).map((item) => readString(item)).filter(Boolean) as string[]
  if (career.length) {
    return career.map(mapCareerLabel).join(" / ")
  }
  switch (readNumber(input.type)) {
    case 2:
      return "公司"
    case 3:
      return "组合"
    default:
      return "人物"
  }
}

function mapCareerLabel(value: string) {
  switch (value) {
    case "producer":
      return "制作人"
    case "mangaka":
      return "漫画家"
    case "artist":
      return "艺术家"
    case "illustrator":
      return "插画师"
    case "seiyu":
      return "声优"
    case "writer":
      return "编剧"
    case "actor":
      return "演员"
    default:
      return value
  }
}

function readBangumiList(input: unknown) {
  if (Array.isArray(input)) {
    return input
  }

  if (!isRecord(input)) {
    return []
  }

  return toArray(input.data ?? input.items ?? input.results ?? input.subjects ?? input.notifications ?? input.topics ?? input.groups ?? input.list ?? input.blogs ?? input.reviews ?? input.entries ?? input.indexes ?? input.indices ?? input.collects ?? input.collections)
}

function readRakuenTopicList(input: unknown, fallbackType?: BangumiRakuenTopicType): BangumiRakuenTopic[] {
  if (typeof input === "string") {
    const topicList = parseRakuenTopicHtml(input)
    if (topicList.length) {
      return topicList.filter((topic) => !fallbackType || topic.topicType === fallbackType)
    }
    return parseGroupTopicTableHtml(input).filter((topic) => !fallbackType || topic.topicType === fallbackType)
  }

  return readBangumiList(input)
    .map((item, index) => adaptRakuenTopic(item, index, fallbackType))
    .filter(Boolean) as BangumiRakuenTopic[]
}

function getRakuenTopicTypeForMode(mode: BangumiRakuenMode): BangumiRakuenTopicType {
  return mode.startsWith("subject") ? "subject" : "group"
}

function buildRakuenViewMessage(mode: BangumiRakuenMode, topicCount: number) {
  const modeTitle = describeRakuenMode(mode)
  if (topicCount) {
    return `已接入${modeTitle}真实响应：话题 ${topicCount} 条。`
  }
  return `${modeTitle}接口暂未返回可展示话题。`
}

function describeRakuenMode(mode: BangumiRakuenMode) {
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

function parseRakuenTopicHtml(html: string): BangumiRakuenTopic[] {
  const section = html.match(/<div\b[^>]*id=["']eden_tpc_list["'][^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? html.match(/<ul\b[^>]*id=["']eden_tpc_list["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? html
  const items = section.match(/<li\b[^>]*class=["'][^"']*item_list[^"']*["'][^>]*>[\s\S]*?<\/li>/gi) ?? []

  return items.map((item) => {
    const identity = readRakuenTopicIdentity(item)
    if (!identity) {
      return null
    }

    const id = identity.id
    const title = cleanBangumiText(item.match(/<a\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]) ?? `话题 #${id}`
    const group = cleanBangumiText(item.match(/<a\b[^>]*href=["']\/group\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]) ?? (identity.type === "group" ? "小组" : "条目讨论")
    const author = cleanBangumiText(item.match(/<a\b[^>]*href=["']\/user\/[^"']+["'][^>]*title=["']([^"']+)["'][^>]*>/i)?.[1] ?? readHtmlAttribute(item, "data-item-user")) ?? "Bangumi 用户"
    const replies = readNumber(item.match(/\(\+(\d+)\)/)?.[1]) ?? 0
    const time = cleanBangumiText(item.match(/<small\b[^>]*class=["'][^"']*time[^"']*["'][^>]*>([\s\S]*?)<\/small>/i)?.[1]) ?? "刚刚"

    return {
      id,
      topicType: identity.type,
      topicKey: `${identity.type}/${id}`,
      url: identity.url,
      title,
      group,
      author,
      replies,
      heat: replies >= 50 ? "热议中" : replies >= 10 ? "今日热门" : "新讨论",
      time,
      summary: identity.type === "group" ? "来自 bgm.tv 小组公共讨论。" : "来自 bgm.tv 条目公共讨论。",
    }
  }).filter(Boolean) as BangumiRakuenTopic[]
}

function parseGroupTopicTableHtml(html: string): BangumiRakuenTopic[] {
  const table = html.match(/<table\b[^>]*class=["'][^"']*topic_list[^"']*["'][^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? ""
  const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []

  return rows.map((row) => {
    const identity = readRakuenTopicIdentity(row)
    const id = identity?.id
    const title = cleanBangumiText(row.match(/<a\b[^>]*href=["']\/(?:rakuen\/topic\/group|group\/topic)\/\d+[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1])
    if (!id || !title) {
      return null
    }

    const group = cleanBangumiText(row.match(/<a\b[^>]*href=["']\/group\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]) ?? "小组"
    const author = cleanBangumiText(row.match(/<a\b[^>]*href=["']\/user\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]) ?? "Bangumi 用户"
    const replies = readNumber(row.match(/\(\+(\d+)\)/)?.[1]) ?? 0
    const time = cleanBangumiText(row.match(/<small\b[^>]*class=["'][^"']*grey[^"']*["'][^>]*>([\s\S]*?)<\/small>/gi)?.pop()?.replace(/<[^>]+>/g, "")) ?? "刚刚"

    return {
      id,
      topicType: "group",
      topicKey: `group/${id}`,
      url: identity?.url ?? buildRakuenTopicUrl(id, "group"),
      title,
      group,
      author,
      replies,
      heat: replies >= 50 ? "热议中" : replies >= 10 ? "今日热门" : "新讨论",
      time,
      summary: "来自 bgm.tv 小组最新话题。",
    }
  }).filter(Boolean) as BangumiRakuenTopic[]
}

function parseRakuenTopicDetailHtml(html: string, fallback: BangumiSubjectTopic) {
  const title =
    cleanBangumiText(html.match(/<h1\b[^>]*>[\s\S]*?<br\s*\/?>\s*([\s\S]*?)<\/h1>/i)?.[1]) ??
    cleanBangumiText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]) ??
    fallback.title
  const topicBlock = html.match(/<div\b[^>]*class=["'][^"']*postTopic[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*id=["']sliderContainer["']|<div\b[^>]*id=["']comment_list["']|<div\b[^>]*class=["'][^"']*row_reply|$)/i)?.[0] ?? ""
  const topicPostId = readNumber(topicBlock.match(/id=["']post_(\d+)["']/i)?.[1]) ?? fallback.id
  const topicUser = cleanBangumiText(topicBlock.match(/<strong>\s*<a\b[^>]*class=["'][^"']*\bl\b[^"']*["'][^>]*>([\s\S]*?)<\/a>\s*<\/strong>/i)?.[1]) ?? fallback.user
  const topicTime = cleanBangumiText(topicBlock.match(/<small\b[^>]*>#1\s*-\s*([\s\S]*?)<\/small>/i)?.[1]) ?? fallback.time
  const content = cleanBangumiText(normalizeBangumiHtmlText(topicBlock.match(/<div\b[^>]*class=["'][^"']*topic_content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])) ?? "暂无正文"
  const replyBlocks = html.match(/<div\b[^>]*id=["']post_\d+["'][^>]*class=["'][^"']*row_reply[^"']*["'][^>]*>[\s\S]*?(?=<div\b[^>]*id=["']post_\d+["'][^>]*class=["'][^"']*row_reply|<script\b|<div\b[^>]*id=["']reply_wrapper["']|<div\b[^>]*class=["']clear["']|$)/gi) ?? []
  const replies = replyBlocks.map((block, index) => parseRakuenReplyHtml(block, index)).filter(Boolean) as BangumiCommentReply[]

  return {
    topic: {
      ...fallback,
      title,
      user: topicUser,
      replies: replies.length || fallback.replies,
      time: topicTime,
    },
    content,
    replies,
  }
}

function parseRakuenReplyHtml(block: string, index: number): BangumiCommentReply | null {
  const id = readNumber(block.match(/id=["']post_(\d+)["']/i)?.[1]) ?? index + 1
  const floor = readNumber(block.match(/floor-anchor["'][^>]*>#(\d+)<\/a>/i)?.[1]) ?? index + 2
  const time = cleanBangumiText(block.match(/floor-anchor["'][^>]*>#[\d]+<\/a>\s*-\s*([\s\S]*?)<\/small>/i)?.[1]) ?? "刚刚"
  const user =
    cleanBangumiText(block.match(/<strong>\s*<a\b[^>]*class=["'][^"']*post_author_[^"']*["'][^>]*>([\s\S]*?)<\/a>\s*<\/strong>/i)?.[1]) ??
    cleanBangumiText(block.match(/<strong>\s*<a\b[^>]*class=["'][^"']*\bl\b[^"']*["'][^>]*>([\s\S]*?)<\/a>\s*<\/strong>/i)?.[1]) ??
    "Bangumi 用户"
  const avatarStyle = block.match(/background-image\s*:\s*url\(['"]?([^)'";]+)['"]?\)/i)?.[1]
  const message = block.match(/<div\b[^>]*class=["'][^"']*message[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  const content = cleanBangumiText(normalizeBangumiHtmlText(message))
  if (!content) {
    return null
  }

  return {
    id,
    user,
    avatarUrl: avatarStyle ? normalizeBangumiImageUrl(avatarStyle) : undefined,
    content,
    time,
    floor,
  }
}

function normalizeBangumiHtmlText(value?: string) {
  if (!value) {
    return undefined
  }

  return value.replace(/<img\b[^>]*(?:alt|title)=["']([^"']+)["'][^>]*>/gi, " $1 ")
}

function readHtmlAttribute(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return html.match(new RegExp(`${escaped}=["']([^"']+)["']`, "i"))?.[1]
}

function readRakuenTopicIdentity(value?: string): { id: number; type: "subject" | "group"; url: string } | null {
  if (!value) {
    return null
  }

  const matches = [
    ...value.matchAll(/href=["']([^"']*(?:rakuen\/topic\/(?:group|subject)\/\d+|group\/topic\/\d+)[^"']*)["']/gi),
    ...value.matchAll(/((?:https?:\/\/[^\s"'<>]+)?\/?(?:rakuen\/topic\/(?:group|subject)\/\d+|group\/topic\/\d+)(?:[?#][^\s"'<>]*)?)/gi),
  ]

  for (const candidate of matches) {
    const href = candidate[1]
    const rakuenMatch = href.match(/(?:^|\/)rakuen\/topic\/(group|subject)\/(\d+)(?:[?#][^"']*)?$/i)
    const legacyGroupMatch = href.match(/(?:^|\/)group\/topic\/(\d+)(?:[?#][^"']*)?$/i)
    const type: "subject" | "group" = rakuenMatch?.[1] === "subject" ? "subject" : "group"
    const id = readNumber(rakuenMatch?.[2] ?? legacyGroupMatch?.[1])
    if (!id) {
      continue
    }

    return {
      id,
      type,
      url: normalizeRakuenTopicUrl(href, id, type),
    }
  }

  return null
}

function normalizeRakuenTopicUrl(href: string, id: number, type: "subject" | "group") {
  const path = href.replace(/^https?:\/\/[^/]+\//i, "").replace(/^\/+/, "").replace(/[?#].*$/, "")
  return path || buildRakuenTopicUrl(id, type)
}

function inferRakuenTopicType(...values: unknown[]): "subject" | "group" {
  for (const value of values) {
    if (!isRecord(value)) {
      continue
    }
    const raw = [value.type, value.category, value.kind, value.topicType, value.topic_type, value.discussionType, value.discussion_type]
      .map((item) => readString(item)?.toLowerCase())
      .find(Boolean)
    if (raw?.includes("subject") || raw?.includes("条目")) {
      return "subject"
    }
    if (raw?.includes("group") || raw?.includes("小组")) {
      return "group"
    }
  }
  return "group"
}

function buildRakuenTopicUrl(id: number, type: "subject" | "group"): string {
  return type === "group" ? `/rakuen/topic/group/${id}` : `/rakuen/topic/subject/${id}`
}

function readRakuenTopicHtmlTitle(html: string) {
  return cleanBangumiText(html.match(/<h1\b[^>]*>[\s\S]*?<br\s*\/?>\s*([\s\S]*?)<\/h1>/i)?.[1]) ?? cleanBangumiText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1])
}

function readRakuenTopicHtmlIdentity(html: string): { id: number; type: "subject" | "group"; url: string } | null {
  const candidates = [
    html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1],
    html.match(/<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i)?.[1],
    html.match(/(?:^|["'\s])\/?rakuen\/topic\/(?:group|subject)\/\d+(?:[?#][^"'\s<>]*)?/i)?.[0],
    html.match(/(?:^|["'\s])\/?group\/topic\/\d+(?:[?#][^"'\s<>]*)?/i)?.[0],
  ]

  for (const candidate of candidates) {
    const identity = readRakuenTopicIdentity(candidate?.trim().replace(/^["'\s]+/, ""))
    if (identity) {
      return identity
    }
  }

  return null
}

function isCompatibleTopicHtml(html: string, fallback: BangumiSubjectTopic, type: "subject" | "group") {
  const identity = readRakuenTopicHtmlIdentity(html)
  if (identity && (identity.id !== fallback.id || identity.type !== type)) {
    return false
  }

  return isCompatibleTopicTitle(readRakuenTopicHtmlTitle(html), fallback.title)
}

function isCompatibleTopicTitle(nextTitle: string | undefined, fallbackTitle: string) {
  const normalizedNext = normalizeComparableText(nextTitle)
  const normalizedFallback = normalizeComparableText(fallbackTitle)
  if (!normalizedNext || !normalizedFallback) {
    return true
  }
  return normalizedNext.includes(normalizedFallback) || normalizedFallback.includes(normalizedNext)
}

function normalizeComparableText(value?: string) {
  return cleanBangumiText(value)?.replace(/[\s\-_|｜・·:：]+/g, "").toLowerCase()
}

function readIndexSubjectList(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input
  }

  if (!isRecord(input)) {
    return []
  }

  const data = isRecord(input.data) ? input.data : undefined
  const candidates = [
    input.items,
    input.subjects,
    input.entries,
    input.collects,
    input.collections,
    input.list,
    isRecord(input.subjects) ? input.subjects.data : undefined,
    isRecord(input.subjects) ? input.subjects.items : undefined,
    isRecord(input.subjects) ? input.subjects.list : undefined,
    isRecord(input.subjects) ? input.subjects.subjects : undefined,
    isRecord(input.items) ? input.items.data : undefined,
    isRecord(input.items) ? input.items.items : undefined,
    isRecord(input.items) ? input.items.list : undefined,
    data?.items,
    data?.subjects,
    data?.entries,
    data?.collects,
    data?.collections,
    data?.list,
    isRecord(data?.subjects) ? data.subjects.data : undefined,
    isRecord(data?.subjects) ? data.subjects.items : undefined,
    isRecord(data?.subjects) ? data.subjects.list : undefined,
    isRecord(input.index) ? input.index.items : undefined,
    isRecord(input.index) ? input.index.subjects : undefined,
    isRecord(input.index) ? input.index.collects : undefined,
    isRecord(input.index) ? input.index.collections : undefined,
    isRecord(input.idx) ? input.idx.items : undefined,
    isRecord(input.idx) ? input.idx.subjects : undefined,
    isRecord(input.idx) ? input.idx.collects : undefined,
    isRecord(input.idx) ? input.idx.collections : undefined,
  ]

  for (const candidate of candidates) {
    const list = toArray(candidate)
    if (list.length) {
      return list
    }
  }

  return []
}

function extractSubjectSource(input: unknown) {
  if (!isRecord(input)) {
    return input
  }

  if (isRecord(input.subject)) return input.subject
  if (isRecord(input.item)) return input.item
  if (isRecord(input.entry)) return input.entry
  if (isRecord(input.collect) && isRecord(input.collect.subject)) return input.collect.subject
  if (isRecord(input.collection) && isRecord(input.collection.subject)) return input.collection.subject
  return input
}

function buildNoticeDetail(input: Record<string, unknown>) {
  const mainID = readNumber(input.mainID) ?? readNumber(input.main_id) ?? readNumber(input.relatedID) ?? readNumber(input.related_id)
  const title =
    readString(input.title) ??
    readString(input.label) ??
    readString(input.name) ??
    "这条内容"

  switch (readNumber(input.type)) {
    case 1:
      return `在你的小组话题《${title}》中发表了新回复`
    case 2:
      return `在小组话题《${title}》中回复了你`
    case 3:
      return `在你的条目讨论《${title}》中发表了新回复`
    case 4:
      return `在条目讨论《${title}》中回复了你`
    case 5:
      return `在角色讨论《${title}》中发表了新回复`
    case 6:
      return `在角色《${title}》中回复了你`
    case 7:
      return `在你的日志《${title}》中发表了新回复`
    case 8:
      return `在日志《${title}》中回复了你`
    case 9:
      return `在章节讨论《${title}》中发表了新回复`
    case 10:
      return `在章节讨论《${title}》中回复了你`
    case 11:
      return `在目录《${title}》中给你留言了`
    case 12:
      return `在目录《${title}》中回复了你`
    case 13:
      return `在人物《${title}》中回复了你`
    case 14:
      return "请求与你成为好友"
    case 15:
      return "通过了你的好友请求"
    case 17:
      return `在你的社团讨论《${title}》中发表了新回复`
    case 18:
      return `在社团讨论《${title}》中回复了你`
    case 19:
      return `在同人作品《${title}》中回复了你`
    case 20:
      return `在你的展会讨论《${title}》中发表了新回复`
    case 21:
      return `在展会讨论《${title}》中回复了你`
    case 22:
      return mainID ? `回复了你的时光机吐槽 #${mainID}` : "回复了你的时光机吐槽"
    case 23:
      return `在小组话题《${title}》中提到了你`
    case 24:
      return `在条目讨论《${title}》中提到了你`
    case 25:
      return `在角色《${title}》中提到了你`
    case 26:
      return `在人物讨论《${title}》中提到了你`
    case 27:
      return `在目录《${title}》中提到了你`
    case 28:
      return `在《${title}》中提到了你`
    case 29:
      return `在日志《${title}》中提到了你`
    case 30:
      return `在章节讨论《${title}》中提到了你`
    case 31:
      return `在社团《${title}》的留言板中提到了你`
    case 32:
      return `在社团讨论《${title}》中提到了你`
    case 33:
      return `在同人作品《${title}》中提到了你`
    case 34:
      return `在展会讨论《${title}》中提到了你`
    default:
      return undefined
  }
}

function describeNoticeType(type?: number) {
  switch (type) {
    case 14:
    case 15:
      return "好友提醒"
    case 22:
      return "时光机提醒"
    case 11:
    case 12:
    case 27:
      return "目录提醒"
    default:
      return type ? `提醒 #${type}` : undefined
  }
}

function adaptUser(input: unknown, fallback: BangumiUser): BangumiUser {
  if (!isRecord(input)) {
    return fallback
  }

  const nickname = readString(input.nickname) ?? readString(input.name) ?? fallback.name
  const username = readString(input.username) ?? readString(input.account) ?? fallback.account
  const sign = readString(input.sign) ?? readString(input.motto) ?? fallback.motto
  const bio = readString(input.bio) ?? fallback.bio
  const joinedAt = readString(input.joinedAt) ?? readString(input.joined_at)
  const site = readString(input.site)
  const networkServices = toArray(input.networkServices ?? input.network_services)
    .map((service) => {
      if (!isRecord(service)) return undefined
      const title = readString(service.title)
      const account = readString(service.account)
      return title && account ? `${title} ${account}` : undefined
    })
    .filter(Boolean) as string[]

  const collections = buildUserCollections(input, fallback.collections)

  return {
    id: readNumber(input.id) ?? fallback.id,
    name: nickname,
    account: username,
    motto: sign,
    badge: fallback.badge,
    joined: joinedAt ? `${joinedAt.slice(0, 10)} 加入` : fallback.joined,
    bio: bio || fallback.bio,
    collections: site ? [...collections, `Home ${site}`] : networkServices.length ? [...collections, ...networkServices.slice(0, 2)] : collections,
  }
}

function buildUserCollections(input: Record<string, any>, fallback: string[]) {
  const stats = isRecord(input.stats) ? input.stats : null
  if (!stats) {
    return fallback
  }

  const anime = readNumber(stats.anime) ?? readNumber(stats.subjectsAnime)
  const book = readNumber(stats.book) ?? readNumber(stats.subjectsBook)
  const game = readNumber(stats.game) ?? readNumber(stats.subjectsGame)
  const music = readNumber(stats.music) ?? readNumber(stats.subjectsMusic)

  const mapped = [
    anime ? `动画 ${anime}` : undefined,
    book ? `书籍 ${book}` : undefined,
    game ? `游戏 ${game}` : undefined,
    music ? `音乐 ${music}` : undefined,
  ].filter(Boolean) as string[]

  return mapped.length ? mapped : fallback
}

function adaptSubject(input: unknown, index: number): BangumiSubject | null {
  if (!isRecord(input)) {
    return null
  }

  const base = subjects[index % subjects.length]
  const id = readNumber(input.id) ?? base.id + index + 1000
  const name = readString(input.name) ?? readString(input.title) ?? base.title
  const directNameCn = readString(input.nameCn) ?? readString(input.name_cn) ?? readString(input.nameCN) ?? readString(input.chineseName) ?? readString(input.chinese_title)
  const infoboxChineseTitle = readSubjectChineseTitle(input)
  const nameCn = directNameCn ?? infoboxChineseTitle
  const displayTitle = name ?? nameCn ?? base.title
  const summary = readString(input.summary) ?? base.summary
  const date = readString(input.date) ?? readString(input.airDate) ?? base.year
  const score = readNumber(input.score) ?? readNumber(input.rating?.score) ?? base.score
  const rank = readNumber(input.rank) ?? base.rank
  const votes = readNumber(input.collectionTotal) ?? readNumber(input.total) ?? readNumber(input.rating?.total) ?? base.votes
  const type = readNumber(input.type)
  const kind = mapSubjectKind(type) ?? base.kind
  const imageUrl = readBangumiImageUrl(input) ?? base.imageUrl

  return {
    ...base,
    id,
    title: displayTitle,
    originalTitle: nameCn ?? displayTitle,
    chineseTitle: nameCn && nameCn !== displayTitle && isLikelyChineseTitle(nameCn) ? nameCn : undefined,
    summary,
    year: date.slice(0, 4) || base.year,
    score,
    rank,
    votes,
    kind,
    imageUrl,
    progressLabel: buildCalendarProgressLabel(input, kind, base.progressLabel),
    collection: mapCollectionLabel(readNumber(input.collection?.type) ?? readNumber(input.collectionType) ?? readNumber(input.collection_type) ?? readNumber(input.ctype)),
    meta: buildMeta(input, kind),
  }
}

function buildCalendarProgressLabel(input: Record<string, unknown>, kind: BangumiSubject["kind"], fallback: string) {
  const collection = isRecord(input.collection) ? input.collection : null
  const epStatus = readNumber(collection?.epStatus) ?? readNumber(collection?.ep_status) ?? readNumber(input.epStatus) ?? readNumber(input.ep_status)
  const volStatus = readNumber(collection?.volStatus) ?? readNumber(collection?.vol_status) ?? readNumber(input.volStatus) ?? readNumber(input.vol_status)
  const collectionProgress = buildProgressLabel(kind, epStatus, volStatus, undefined)
  if (collectionProgress) {
    return collectionProgress
  }
  const airWeekday = readNumber(input.airWeekday) ?? readNumber(input.air_weekday)
  const airDate = readString(input.airDate) ?? readString(input.air_date) ?? readString(input.date)
  const eps = readNumber(input.eps) ?? readNumber(input.totalEpisodes) ?? readNumber(input.total_episodes)
  const epsCount = eps ? `${eps} 话` : undefined
  const weekday = airWeekday ? `周${["一", "二", "三", "四", "五", "六", "日"][(Math.max(1, airWeekday) - 1) % 7]}` : undefined
  return [weekday, airDate, epsCount].filter(Boolean).join(" · ") || fallback
}

function buildMeta(input: Record<string, unknown>, kind: BangumiSubject["kind"]) {
  const romanTitle = readSubjectRomanTitle(input)
  const production = readSubjectProduction(input, kind)
  const platform = readString(input.platform) ?? readInfoboxValue(input, ["平台", "放送类型", "发行平台"])
  const date = readString(input.date) ?? readString(input.airDate) ?? readString(input.air_date) ?? readString(input.releaseDate) ?? readString(input.release_date) ?? readInfoboxValue(input, ["放送开始", "发售日", "发行日期", "开始"])
  const eps = readNumber(input.eps) ?? readNumber(input.totalEpisodes) ?? readNumber(input.total_episodes) ?? readNumber(input.episodes) ?? readNumber(readInfoboxValue(input, ["话数", "集数"]))
  const volumes = readNumber(input.volumes) ?? readNumber(input.vols) ?? readNumber(input.totalVolumes) ?? readNumber(input.total_volumes) ?? readNumber(readInfoboxValue(input, ["册数", "卷数"]))
  const tracks = readNumber(input.tracks) ?? readNumber(input.discs) ?? readNumber(input.totalTracks) ?? readNumber(input.total_tracks) ?? readNumber(readInfoboxValue(input, ["曲目数量", "曲数", "碟片数量"]))
  const countLabel = buildSubjectCountMeta(kind, eps, volumes, tracks)
  const parts = uniqueMetaParts([romanTitle, production, platform, date, countLabel])
  return parts.join(" / ") || kind
}

function uniqueMetaParts(items: Array<string | undefined>) {
  const seen = new Set<string>()
  return items.filter((item): item is string => {
    const normalized = item?.trim()
    if (!normalized || seen.has(normalized)) {
      return false
    }
    seen.add(normalized)
    return true
  })
}

function readSubjectChineseTitle(input: Record<string, unknown>) {
  const direct =
    readInfoboxValue(input, ["中文名", "中文标题", "中文名稱", "简体中文名", "繁体中文名", "中国語名", "中国語タイトル"])
  if (direct && isLikelyChineseTitle(direct)) {
    return direct
  }

  const aliases = readInfoboxValues(input, ["别名", "别名列表", "又名"])
  return aliases.find((alias) => isLikelyChineseTitle(alias))
}

function isLikelyChineseTitle(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    return false
  }
  const cjkChars = normalized.match(/[\u4e00-\u9fff]/g)?.length ?? 0
  const kanaChars = normalized.match(/[\u3040-\u30ff]/g)?.length ?? 0
  return cjkChars > 0 && kanaChars === 0
}

function readSubjectRomanTitle(input: Record<string, unknown>) {
  const direct =
    readString(input.romanTitle) ??
    readString(input.roman_title) ??
    readString(input.romaji) ??
    readString(input.romajiTitle) ??
    readString(input.romaji_title) ??
    readInfoboxValue(input, ["罗马字", "罗马音", "罗马注音", "Romaji", "ROMAJI"])
  if (direct) {
    return direct
  }

  const aliases = readInfoboxValues(input, ["别名", "别名列表", "又名"])
  return aliases.find((alias) => isLikelyRomanTitle(alias))
}

function readSubjectProduction(input: Record<string, unknown>, kind: BangumiSubject["kind"]) {
  const direct =
    readString(input.studio) ??
    readString(input.production) ??
    readString(input.company) ??
    readString(input.producer) ??
    readInfoboxValue(input, productionInfoboxKeys(kind))
  return direct
}

function productionInfoboxKeys(kind: BangumiSubject["kind"]) {
  switch (kind) {
    case "动画":
    case "三次元":
      return ["动画制作", "制作", "制作公司", "制作协力", "製作", "アニメーション制作", "制作プロダクション"]
    case "书籍":
      return ["出版社", "连载杂志", "掲載誌", "出版社/品牌"]
    case "音乐":
      return ["厂牌", "唱片公司", "发行", "发行方", "レーベル"]
    case "游戏":
      return ["开发", "开发商", "发行", "发行商", "游戏开发商", "开发元"]
    default:
      return ["制作", "制作公司"]
  }
}

function readInfoboxValue(input: Record<string, unknown>, keys: string[]) {
  return readInfoboxValues(input, keys)[0]
}

function readInfoboxValues(input: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = keys.map((key) => key.toLowerCase())
  return toArray(input.infobox)
    .flatMap((item) => {
      if (!isRecord(item)) {
        return []
      }
      const key = readString(item.key) ?? readString(item.name) ?? readString(item.title)
      if (!key || !normalizedKeys.includes(key.toLowerCase())) {
        return []
      }
      return readInfoboxRawValues(item.value ?? item.values ?? item.v)
    })
    .filter(Boolean)
}

function readInfoboxRawValues(value: unknown): string[] {
  const text = readString(value)
  if (text) {
    return [text]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => readInfoboxRawValues(item))
  }
  if (isRecord(value)) {
    const nested =
      readString(value.v) ??
      readString(value.value) ??
      readString(value.name) ??
      readString(value.title) ??
      readString(value.label)
    return nested ? [nested] : []
  }
  return []
}

function isLikelyRomanTitle(value: string) {
  const normalized = value.trim()
  if (!normalized || normalized.length < 3) {
    return false
  }
  const latinChars = normalized.match(/[A-Za-z]/g)?.length ?? 0
  const japaneseChars = normalized.match(/[\u3040-\u30ff\u3400-\u9fff]/g)?.length ?? 0
  return latinChars >= 3 && latinChars >= japaneseChars
}

function buildSubjectCountMeta(kind: BangumiSubject["kind"], eps?: number, volumes?: number, tracks?: number) {
  switch (kind) {
    case "动画":
    case "三次元":
      return eps ? `${eps} 话` : undefined
    case "书籍":
      return volumes ? `${volumes} 卷` : eps ? `${eps} 话` : undefined
    case "音乐":
      return tracks ? `${tracks} 曲` : eps ? `${eps} 曲目` : undefined
    case "游戏":
      return undefined
    default:
      return undefined
  }
}

function mapSearchSubjectType(value: string) {
  switch (value) {
    case "书籍":
      return 1
    case "动画":
      return 2
    case "音乐":
      return 3
    case "游戏":
      return 4
    case "三次元":
      return 6
    default:
      return undefined
  }
}

function mapSubjectKind(type?: number): BangumiSubject["kind"] | null {
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
      return null
  }
}

function readBangumiImageUrl(input: Record<string, unknown>) {
  const direct =
    readString(input.imageUrl) ??
    readString(input.image_url) ??
    readString(input.cover) ??
    readString(input.avatar) ??
    readString(input.icon)
  if (direct) {
    return normalizeBangumiImageUrl(direct)
  }

  const images = isRecord(input.images) ? input.images : isRecord(input.image) ? input.image : null
  if (!images) {
    return undefined
  }

  const url =
    readString(images.common) ??
    readString(images.grid) ??
    readString(images.large) ??
    readString(images.medium) ??
    readString(images.small)
  return url ? normalizeBangumiImageUrl(url) : undefined
}

function normalizeBangumiImageUrl(value: string) {
  if (value.startsWith("//")) {
    return `https:${value}`
  }
  if (value.startsWith("http://")) {
    return value.replace(/^http:\/\//, "https://")
  }
  return value
}

function firstRecord(...values: unknown[]): Record<string, any> | undefined {
  return values.find((value) => isRecord(value)) as Record<string, any> | undefined
}

function readReviewText(input: Record<string, any>): string | undefined {
  return (
    readCleanText(input.content) ??
    readCleanText(input.body) ??
    readCleanText(input.html) ??
    readCleanText(input.text) ??
    readCleanText(input.comment) ??
    readCleanText(input.summary) ??
    readCleanText(input.description) ??
    readCleanText(input.desc)
  )
}

function readCleanText(value: unknown): string | undefined {
  return cleanBangumiText(readString(value))
}

function cleanBangumiText(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  const cleaned = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\[(?:\/)?(?:b|i|u|s|size|color|url|img|quote|code|mask|spoiler)[^\]]*\]/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return cleaned.length ? cleaned : undefined
}

function summarizeBangumiText(value?: string): string {
  const normalized = cleanBangumiText(value)?.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return "暂无长评摘要"
  }

  return normalized.length > 160 ? `${normalized.slice(0, 160)}...` : normalized
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export const bangumiMockCurrentUser = currentUser
