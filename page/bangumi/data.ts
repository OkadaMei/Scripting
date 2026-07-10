export type BangumiSubject = {
  id: number
  title: string
  originalTitle: string
  chineseTitle?: string
  kind: "动画" | "书籍" | "音乐" | "游戏" | "三次元"
  year: string
  summary: string
  score: number
  votes: number
  rank: number
  collection: string
  progressLabel: string
  tags: string[]
  meta: string
  episodes: string[]
  relations: string[]
  cast: string[]
  discussionCount: number
  color: string
  accent: string
  imageUrl?: string
}

export type TimelineTarget = {
  id?: number
  title: string
  subtitle?: string
  imageUrl?: string
  kind?: string
  url?: string
}

export type TimelineItem = {
  id: number
  user: string
  action: string
  content: string
  time: string
  replies: number
  reactions: string[]
  category?: number
  categoryLabel?: string
  type?: number
  sourceName?: string
  sourceUrl?: string
  batch?: string
  avatarUrl?: string
  subjectId?: number
  subjectTitle?: string
  subject?: BangumiSubject
  subjects?: BangumiSubject[]
  targets?: TimelineTarget[]
  comment?: string
  rate?: number
  collectId?: number
  replyable?: boolean
  reactionPath?: string
}

export type RakuenTopic = {
  id: number
  title: string
  group: string
  author: string
  replies: number
  heat: string
}

export type BangumiUser = {
  id: number
  name: string
  account: string
  motto: string
  badge: string
  joined: string
  bio: string
  collections: string[]
}

export const bangumiAccent = "#F09199"
export const bangumiLink = { light: "#0084B4", dark: "#5AC8FA" } as const
export const bangumiAppBackground = {
  light: "#F7F8FA",
  dark: "#101114",
} as const
export const bangumiNavBarBackground = {
  light: "rgba(247,248,250,0.92)",
  dark: "rgba(16,17,20,0.92)",
} as const
export const bangumiCard = {
  light: "rgba(255,255,255,0.96)",
  dark: "rgba(30,31,36,0.96)",
} as const
export const bangumiMutedCard = {
  light: "rgba(245,247,250,0.96)",
  dark: "rgba(42,43,49,0.92)",
} as const
export const bangumiHeroBackground = {
  light: {
    colors: ["rgba(240,145,153,0.20)", "rgba(255,255,255,0.96)"] as ["rgba(240,145,153,0.20)", "rgba(255,255,255,0.96)"],
    startPoint: "topLeading",
    endPoint: "bottomTrailing",
  },
  dark: {
    colors: ["rgba(240,145,153,0.24)", "rgba(30,31,36,0.96)"] as ["rgba(240,145,153,0.24)", "rgba(30,31,36,0.96)"],
    startPoint: "topLeading",
    endPoint: "bottomTrailing",
  },
} as const
export const bangumiLinkSoftBackground = {
  light: "rgba(0,132,180,0.10)",
  dark: "rgba(90,200,250,0.18)",
} as const
export const bangumiAccentSoftBackground = {
  light: "rgba(240,145,153,0.10)",
  dark: "rgba(255,158,170,0.18)",
} as const
export const bangumiScoreBackground = {
  light: "rgba(255,183,77,0.16)",
  dark: "rgba(255,204,102,0.20)",
} as const

export const currentUser: BangumiUser = {
  id: 1,
  name: "@SakuraAyane",
  account: "SakuraAyane",
  motto: "今天也在用更顺手的方式刷 Bangumi。",
  badge: "超合金",
  joined: "2021-04-07 加入",
  bio: "热衷动画、游戏与 UI 细节，会把时间线、进度管理和收藏页都整理成自己最顺手的样子。",
  collections: ["动画 248", "书籍 63", "游戏 31", "音乐 18"],
}

export const subjects: BangumiSubject[] = [
  {
    id: 101,
    title: "葬送的芙莉莲",
    originalTitle: "葬送のフリーレン",
    kind: "动画",
    year: "2023",
    summary: "勇者一行结束讨伐魔王后的漫长余韵，被重新拉长成关于生命、记忆与时间的旅行。",
    score: 8.8,
    votes: 22345,
    rank: 19,
    collection: "在看",
    progressLabel: "看到 EP 21 / 28",
    tags: ["奇幻", "公路", "治愈", "高分"],
    meta: "MADHOUSE / TV / Frieren Project",
    episodes: ["EP1", "EP2", "EP3", "EP4", "EP5", "EP6"],
    relations: ["前日谭小说", "角色歌", "设定集"],
    cast: ["芙莉莲", "费伦", "修塔尔克", "欣梅尔"],
    discussionCount: 324,
    color: "rgba(120,167,186,0.28)",
    accent: "#79A7BA",
  },
  {
    id: 102,
    title: "迷宫饭",
    originalTitle: "ダンジョン飯",
    kind: "动画",
    year: "2024",
    summary: "把地下城冒险、怪物料理和温暖日常混成一锅，香气十足又极具辨识度。",
    score: 8.4,
    votes: 15420,
    rank: 74,
    collection: "在看",
    progressLabel: "看到 EP 18 / 24",
    tags: ["冒险", "美食", "异世界"],
    meta: "TRIGGER / TV / 九井谅子原作",
    episodes: ["EP1", "EP2", "EP3", "EP4", "EP5"],
    relations: ["原作漫画", "设定资料集"],
    cast: ["莱欧斯", "玛露希尔", "奇尔查克", "森西"],
    discussionCount: 201,
    color: "rgba(228,171,86,0.28)",
    accent: "#E4AB56",
  },
  {
    id: 103,
    title: "赛博朋克：边缘行者",
    originalTitle: "Cyberpunk: Edgerunners",
    kind: "动画",
    year: "2022",
    summary: "高饱和霓虹与命运悲剧一起冲到极限，是非常典型的“看完会想立刻标记”的作品。",
    score: 8.2,
    votes: 31200,
    rank: 143,
    collection: "看过",
    progressLabel: "已看完 10 / 10",
    tags: ["赛博朋克", "动作", "原创"],
    meta: "TRIGGER / Netflix",
    episodes: ["EP1", "EP2", "EP3", "EP4"],
    relations: ["设定集", "原声集"],
    cast: ["大卫", "露西", "丽贝卡", "曼恩"],
    discussionCount: 518,
    color: "rgba(112,88,238,0.24)",
    accent: "#7058EE",
  },
  {
    id: 104,
    title: "Fate/strange Fake",
    originalTitle: "Fate/strange Fake",
    kind: "书籍",
    year: "2015",
    summary: "把熟悉的圣杯战争模板拧成更加混乱且华丽的群像结构。",
    score: 7.9,
    votes: 4821,
    rank: 682,
    collection: "在读",
    progressLabel: "读到 Vol. 6",
    tags: ["轻小说", "群像", "Fate"],
    meta: "成田良悟 / 电击文库",
    episodes: ["Vol.1", "Vol.2", "Vol.3"],
    relations: ["TV 动画", "Drama CD"],
    cast: ["Ayaka", "Sigma", "Enkidu"],
    discussionCount: 88,
    color: "rgba(180,116,154,0.24)",
    accent: "#B4749A",
  },
]

export const timelineItems: TimelineItem[] = [
  {
    id: 1,
    user: "Kanon",
    action: "完成了",
    content: "把《迷宫饭》一口气补到最新，TRIGGER 这次的节奏感太稳了。",
    time: "14 分钟前",
    replies: 12,
    reactions: ["👍 31", "❤️ 12"],
    subjectId: 102,
    subjectTitle: "迷宫饭",
  },
  {
    id: 2,
    user: "Inori",
    action: "将《葬送的芙莉莲》标记为在看",
    content: "每一集都像是把旅途里的细小情绪再温柔地擦亮一次。",
    time: "32 分钟前",
    replies: 8,
    reactions: ["✨ 22", "💬 8"],
    subjectId: 101,
    subjectTitle: "葬送的芙莉莲",
  },
  {
    id: 3,
    user: "Akari",
    action: "发表了新日志",
    content: "想把 Bangumi 的发现页做得更像“每日放送 + 热门条目”的杂志首页。",
    time: "1 小时前",
    replies: 5,
    reactions: ["📝 5", "👍 17"],
  },
]

export const rakuenTopics: RakuenTopic[] = [
  {
    id: 1,
    title: "2026 夏季新番前瞻：你最看好的原创番是哪一部？",
    group: "动画讨论",
    author: "Neru",
    replies: 83,
    heat: "热议中",
  },
  {
    id: 2,
    title: "有没有更适合整理个人收藏的标签体系？",
    group: "Bangumi 使用心得",
    author: "Mika",
    replies: 41,
    heat: "今日热门",
  },
  {
    id: 3,
    title: "最近有哪些制作规格很高但讨论度不够的游戏 OST？",
    group: "音乐专楼",
    author: "Rin",
    replies: 29,
    heat: "持续更新",
  },
]

export const calendarDays = [
  {
    label: "今天",
    weekday: "SAT",
    subjects: [subjects[0], subjects[1]],
  },
  {
    label: "明天",
    weekday: "SUN",
    subjects: [subjects[2], subjects[3]],
  },
]

export const discoverSections = [
  {
    title: "动画",
    items: [subjects[0], subjects[1], subjects[2]],
  },
  {
    title: "书籍",
    items: [subjects[3], subjects[0], subjects[1]],
  },
  {
    title: "音乐",
    items: [subjects[2], subjects[1], subjects[3]],
  },
]
