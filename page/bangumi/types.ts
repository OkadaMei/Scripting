import type { BangumiSubject, BangumiUser, TimelineItem } from "./data"

export type BangumiRakuenTopicType = "subject" | "group"

export type BangumiRakuenCategory = "subject" | "group"
export type BangumiRakuenSubjectMode = "subjectTrending" | "subjectLatest"
export type BangumiRakuenGroupMode = "groupAll" | "groupJoined" | "groupCreated" | "groupReplied"
export type BangumiRakuenMode = BangumiRakuenSubjectMode | BangumiRakuenGroupMode

export type BangumiRakuenTopic = {
  id: number
  topicType: BangumiRakuenTopicType
  topicKey: string
  url: string
  title: string
  group: string
  author: string
  replies: number
  heat: string
  time: string
  summary: string
}

export type BangumiRakuenData = {
  topics: BangumiRakuenTopic[]
  source: "remote" | "mock"
  message: string
}

export type BangumiNoticeItem = {
  id: number
  title: string
  detail: string
  time: string
  unread: boolean
  user: string
  subject?: BangumiSubject
}

export type BangumiCalendarDay = {
  label: string
  weekday: string
  subjects: BangumiSubject[]
}

export type BangumiDiscoverSection = {
  title: string
  items: BangumiSubject[]
}

export type BangumiDiscoverData = {
  calendarDays: BangumiCalendarDay[]
  discoverSections: BangumiDiscoverSection[]
  source: "remote" | "mock"
  message: string
}

export type BangumiTimelineData = {
  items: TimelineItem[]
  source: "remote" | "mock"
  message: string
  lastId?: number
  exhausted?: boolean
}

export type BangumiTimelineDetailData = {
  item: TimelineItem
  replies: BangumiCommentReply[]
  source: "remote" | "mock"
  message: string
}

export type BangumiNoticeData = {
  items: BangumiNoticeItem[]
  total: number
  unread: number
  source: "remote" | "mock"
  message: string
}

export type BangumiCollectionSummaryItem = {
  title: "想看" | "在看" | "看过" | "搁置" | "抛弃"
  count: number
}

export type BangumiCollectionSummaryData = {
  items: BangumiCollectionSummaryItem[]
  total: number
  source: "remote" | "mock"
  message: string
}

export type BangumiSubjectTypeSummaryItem = {
  title: "动画" | "书籍" | "音乐" | "游戏" | "三次元"
  count: number
}

export type BangumiSubjectTypeSummaryData = {
  items: BangumiSubjectTypeSummaryItem[]
  total: number
  source: "remote" | "mock"
  message: string
}

export type BangumiProgressData = {
  subjects: BangumiSubject[]
  collectionSummary: BangumiCollectionSummaryItem[]
  source: "remote" | "mock"
  message: string
}

export type BangumiSearchData = {
  subjects: BangumiSubject[]
  total: number
  source: "remote" | "mock"
  message: string
}

export type BangumiSearchMonoItem = {
  id: number
  name: string
  originalName: string
  summary: string
  meta: string
  role: string
  collects: number
  comments: number
  kind: "角色" | "人物"
  imageUrl?: string
}

export type BangumiMonoSearchData = {
  items: BangumiSearchMonoItem[]
  total: number
  source: "remote" | "mock"
  message: string
}

export type BangumiMonoDetailData = {
  item: BangumiSearchMonoItem
  relatedSubjects: BangumiSubject[]
  relatedMonos: BangumiSearchMonoItem[]
  source: "remote" | "mock"
  message: string
}

export type BangumiSubjectEpisode = {
  id: number
  name: string
  originalName?: string
  sort: number
  type: string
  airdate: string
  duration: string
  comment: number
  collection: "未看" | "看过" | "抛弃"
}

export type BangumiSubjectComment = {
  id: number
  user: string
  avatarUrl?: string
  content: string
  score: number
  time: string
}

export type BangumiSubjectTopic = {
  id: number
  topicType?: BangumiRakuenTopicType
  topicKey?: string
  url?: string
  title: string
  user: string
  replies: number
  time: string
}

export type BangumiCommentReply = {
  id: number
  user: string
  avatarUrl?: string
  content: string
  time: string
  floor: number
}

export type BangumiEpisodeCommentData = {
  replies: BangumiCommentReply[]
  source: "remote" | "mock"
  message: string
}

export type BangumiTopicDetailData = {
  topic: BangumiSubjectTopic
  content: string
  replies: BangumiCommentReply[]
  source: "remote" | "mock"
  message: string
}

export type BangumiSubjectCharacter = {
  id: string
  character: BangumiSearchMonoItem
  actors: BangumiSearchMonoItem[]
  role: string
}

export type BangumiSubjectRelationItem = {
  id: string
  relation: string
  subject: BangumiSubject
}

export type BangumiSubjectIndexItem = {
  id: number
  title: string
  description: string
  total: number
}

export type BangumiIndexDetailData = {
  index: BangumiSubjectIndexItem
  subjects: BangumiSubject[]
  source: "remote" | "mock"
  message: string
}

export type BangumiSubjectReview = {
  id: number
  title: string
  user: string
  avatarUrl?: string
  summary: string
  content: string
  replies: number
  time: string
}

export type BangumiSubjectCollector = {
  id: string
  username: string
  nickname: string
  avatarUrl?: string
  collection: string
  comment: string
  score: number
  time: string
}

export type BangumiSubjectDetailData = {
  subject: BangumiSubject
  episodes: BangumiSubjectEpisode[]
  comments: BangumiSubjectComment[]
  topics: BangumiSubjectTopic[]
  reviews: BangumiSubjectReview[]
  collectors: BangumiSubjectCollector[]
  characters: BangumiSubjectCharacter[]
  relations: BangumiSubjectRelationItem[]
  recommendations: BangumiSubject[]
  indexes: BangumiSubjectIndexItem[]
  source: "remote" | "mock"
  message: string
}

export type BangumiUserDetailData = {
  user: BangumiUser
  source: "remote" | "mock"
  message: string
}
