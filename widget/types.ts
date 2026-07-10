export type BangumiWidgetSourceState = "remote" | "partial" | "empty" | "error"

export type BangumiWidgetSubject = {
  id: number
  title: string
  subtitle: string
  kind: string
  collection: string
  progress: string
  score: string
  accent: string
  imageUrl?: string
}

export type BangumiWidgetTopic = {
  id: string
  title: string
  meta: string
  heat: string
}

export type BangumiWidgetData = {
  openURL: string
  todayLabel: string
  dateLabel: string
  updatedAtLabel: string
  sourceState: BangumiWidgetSourceState
  sourceLabel: string
  accountLabel: string
  noticeLabel: string
  themeLabel: string
  focusLabel: string
  progressText: string
  emptyTitle: string
  emptySubtitle: string
  watchingCount: number
  completedCount: number
  todayCount: number
  totalCount: number
  primary?: BangumiWidgetSubject
  upcoming: BangumiWidgetSubject[]
  todaySubjects: BangumiWidgetSubject[]
  topics: BangumiWidgetTopic[]
}
