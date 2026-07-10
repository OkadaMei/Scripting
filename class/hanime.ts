import { fetch } from "scripting"

export const HANIME_BASE_URL = "https://ani.girigirilove.com/"

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

const VIDEO_URL_REGEX = /(?:https?:\/\/ani\.girigirilove\.com)?\/?GV(\d+)\/?/gi
const PLAY_URL_REGEX = /(?:https?:\/\/ani\.girigirilove\.com)?\/?playGV(\d+)-(\d+)-(\d+)\/?/gi

export type HanimeVideoItem = {
  title: string
  coverUrl: string
  videoCode: string
  duration?: string
  views?: string
  uploadTime?: string
  currentArtist?: string
  reviews?: string
  itemType?: "normal" | "simplified"
}

export type HanimeHomeBanner = {
  title: string
  description?: string
  picUrl: string
  videoCode?: string
}

export type HanimeHomeSection = {
  id: string
  title: string
  items: HanimeVideoItem[]
}

export type HanimeHomePage = {
  banner?: HanimeHomeBanner
  sections: HanimeHomeSection[]
  timestamp: number
}

export type HanimeVideoSource = {
  label: string
  url: string
  type?: string
}

export type HanimeVideoDetail = {
  title: string
  coverUrl: string
  chineseTitle?: string
  introduction?: string
  uploadTime?: string
  views?: string
  videoUrls: HanimeVideoSource[]
  simplifiedVideoUrls?: HanimeVideoSource[]
  tags: string[]
  playlist?: {
    playlistName?: string
    video: HanimeVideoItem[]
  }
  relatedHanimes: HanimeVideoItem[]
  artist?: {
    name: string
    avatarUrl?: string
    genre?: string
  }
  favTimes?: number
  unlikesCount?: number
  originalComic?: string
  watchUrl: string
}

export type HanimeSearchParams = {
  query?: string
  page?: number
  genre?: string
  sort?: string
  date?: string
  duration?: string
  tags?: string[]
  brands?: string[]
}

export const HANIME_SORT_OPTIONS = [
  { label: "默认", value: "" },
  { label: "按最新", value: "time" },
  { label: "按最热", value: "hits" },
  { label: "按评分", value: "score" },
]

export const HANIME_GENRE_OPTIONS = [
  { label: "日番", value: "2" },
  { label: "美番", value: "3" },
  { label: "剧场版", value: "21" },
  { label: "真人番剧", value: "20" },
  { label: "BD 副音轨", value: "24" },
  { label: "演唱会 / 周边", value: "26" },
]

type SuggestResponse = {
  code?: number
  msg?: string
  total?: number
  list?: Array<{
    id?: number | string
    name?: string
    pic?: string
  }>
}

class HanimeClient {
  async getHomePage(): Promise<HanimeHomePage> {
    const html = await this.fetchHtml("")
    return parseHomePage(html)
  }

  async searchVideos(params: HanimeSearchParams): Promise<HanimeVideoItem[]> {
    const query = params.query?.trim()
    if (query) {
      return await this.searchSuggest(query)
    }

    const tag = params.tags?.find(Boolean)
    const html = await this.fetchHtml(buildShowPath({
      typeId: params.genre || "2",
      sort: normalizeSort(params.sort),
      tag,
      page: params.page || 1,
    }))
    return parseVideoItems(html)
  }

  async getVideo(videoCode: string): Promise<HanimeVideoDetail> {
    const normalizedCode = normalizeVideoCode(videoCode)
    if (!normalizedCode) throw new Error("缺少 GiriGiri 番剧 ID。")
    const html = await this.fetchHtml(`GV${normalizedCode}/`)
    return parseVideoDetail(html, normalizedCode)
  }

  async resolvePlayableSource(source: HanimeVideoSource): Promise<HanimeVideoSource> {
    if (isDirectPlayableUrl(source.url, source.type)) {
      return { ...source, url: normalizeUrl(source.url), type: normalizePlayableType(source.url, source.type) }
    }

    const html = await this.fetchHtml(source.url)
    const playable = parsePlayableSource(html)
    if (!playable?.url) {
      throw new Error("播放页未解析到可供原生播放器使用的视频直链。")
    }

    return {
      label: source.label,
      url: normalizeUrl(playable.url),
      type: normalizePlayableType(playable.url, playable.type || source.type),
    }
  }

  watchUrl(videoCode: string): string {
    const normalizedCode = normalizeVideoCode(videoCode)
    return normalizedCode ? `${HANIME_BASE_URL}GV${normalizedCode}/` : HANIME_BASE_URL
  }

  private async searchSuggest(query: string): Promise<HanimeVideoItem[]> {
    const url = buildUrl("index.php/ajax/suggest", {
      mid: 1,
      wd: query,
      limit: 30,
    })
    const response = await fetch(url, { headers: requestHeaders("application/json,text/plain,*/*;q=0.8") })
    if (!response.ok) throwHttpError(response.status)

    const data = await response.json() as SuggestResponse
    const items = data.list || []
    const result: HanimeVideoItem[] = []
    for (const item of items) {
      const code = normalizeVideoCode(String(item.id || ""))
      if (!code) continue
      result.push({
        title: normalizeTitleText(item.name || `GiriGiri #${code}`),
        coverUrl: normalizeUrl(item.pic || ""),
        videoCode: code,
        itemType: "simplified",
      })
    }
    return result
  }

  private async fetchHtml(path: string): Promise<string> {
    const response = await fetch(buildUrl(path), { headers: requestHeaders("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8") })
    if (!response.ok) throwHttpError(response.status)

    const html = await response.text()
    if (/系統提示|系统提示/.test(html) && /verify|验证码|驗證碼|提交驗證/.test(html)) {
      throw new Error("站点要求验证码验证，请先用 Safari 打开 ani.girigirilove.com 完成验证后再重试。")
    }
    return html
  }
}

export const hanimeClient = new HanimeClient()

export function extractVideoCode(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = decodeHtml(value).trim()
  const playMatch = /playGV(\d+)-\d+-\d+/i.exec(trimmed)
  if (playMatch) return playMatch[1]
  const gvMatch = /(?:^|\/)GV(\d+)\/?/i.exec(trimmed)
  if (gvMatch) return gvMatch[1]
  const numeric = /^\d+$/.test(trimmed) ? trimmed : ""
  return numeric || null
}

function requestHeaders(accept: string): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    "Accept": accept,
    "Accept-Language": "zh-TW,zh-Hant;q=0.9,zh-CN;q=0.8,zh;q=0.7,en;q=0.5",
    "Referer": HANIME_BASE_URL,
  }
}

function throwHttpError(status: number): never {
  if (status === 403 || status === 429) {
    throw new Error("站点访问受限，请先用 Safari 打开 ani.girigirilove.com 确认可以正常访问后再刷新。")
  }
  throw new Error(`请求失败：HTTP ${status}`)
}

function buildUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const base = path.startsWith("http") ? path : `${HANIME_BASE_URL}${path.replace(/^\//, "")}`
  const query: string[] = []
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "") continue
      query.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return query.length > 0 ? `${base}?${query.join("&")}` : base
}

function buildShowPath({ typeId, sort, tag, page }: { typeId: string; sort?: string; tag?: string; page: number }): string {
  const fields = new Array<string>(12).fill("")
  fields[0] = typeId || "2"
  if (sort) fields[2] = sort
  if (tag) fields[3] = tag
  if (page > 1) fields[8] = String(page)
  return `show/${fields.map((field) => encodeURIComponent(field)).join("-")}/`
}

function normalizeSort(sort?: string): string {
  return sort === "time" || sort === "hits" || sort === "score" ? sort : ""
}

function parseHomePage(html: string): HanimeHomePage {
  const banner = parseBanner(html)
  const sections = parseHomeSections(html)
  if (sections.length === 0) {
    const fallbackItems = parseVideoItems(html).slice(0, 36)
    if (fallbackItems.length > 0) {
      sections.push({ id: "recommend", title: "首页推荐", items: fallbackItems })
    }
  }
  return { banner, sections, timestamp: Date.now() }
}

function parseBanner(html: string): HanimeHomeBanner | undefined {
  const slide = extractFirstElementByClass(html, "slide-time-bj") || extractFirstElementByClass(html, "slide-a") || ""
  if (!slide) return undefined
  const videoCode = extractVideoCode(slide) || undefined
  const image = extractImage(slide)
  const title = extractTitle(slide) || image?.title
  if (!title && !image?.url) return undefined
  return {
    title: title || "首页推荐",
    description: extractTextByClass(slide, "slide-info") || "打开网页播放",
    picUrl: image?.url || "",
    videoCode,
  }
}

function parseHomeSections(html: string): HanimeHomeSection[] {
  const sectionHints = [
    { id: "weekday", title: "番剧周期表", heading: "番劇周期表" },
    { id: "watching", title: "最近大家在看", heading: "最近大家在看" },
    { id: "interest", title: "或许你感兴趣", heading: "或許你感興趣" },
    { id: "movie", title: "剧场版", heading: "劇場版" },
  ]
  const sections: HanimeHomeSection[] = []
  const seen = new Set<string>()

  for (let index = 0; index < sectionHints.length; index += 1) {
    const hint = sectionHints[index]
    const start = findHomeSectionHeading(html, hint.heading)
    if (start < 0) continue
    const nextStart = sectionHints
      .slice(index + 1)
      .map((next) => findHomeSectionHeading(html, next.heading, start + hint.heading.length))
      .filter((value) => value > start)
      .sort((left, right) => left - right)[0] ?? html.length
    const segment = html.slice(start, nextStart)
    const items = parseVideoItems(segment).filter((item) => {
      if (seen.has(item.videoCode)) return false
      seen.add(item.videoCode)
      return true
    }).slice(0, 18)
    if (items.length > 0) sections.push({ id: hint.id, title: hint.title, items })
  }

  const allItems = parseVideoItems(html).filter((item) => !seen.has(item.videoCode)).slice(0, 24)
  if (allItems.length > 0) {
    sections.unshift({ id: "latest", title: "最新更新", items: allItems })
  }
  return sections
}

function findHomeSectionHeading(html: string, heading: string, fromIndex: number = 0): number {
  const aliases = heading === "劇場版" ? ["劇場版", "剧场版"] : [heading]
  for (const alias of aliases) {
    const pattern = new RegExp(`<h[1-6]\\b[^>]*class=["'][^"']*\\btitle-h\\b[^"']*["'][^>]*>\\s*${escapeRegExp(alias)}\\s*<\\/h[1-6]>`, "i")
    const match = pattern.exec(html.slice(fromIndex))
    if (match) return fromIndex + match.index
  }
  return -1
}

function parseVideoItems(html: string): HanimeVideoItem[] {
  const result: HanimeVideoItem[] = []
  const seen = new Set<string>()
  const regex = new RegExp(VIDEO_URL_REGEX.source, "gi")
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) != null) {
    const videoCode = match[1]
    if (seen.has(videoCode)) continue

    const segment = extractVideoCardSegment(html, match.index)
    const image = extractImage(segment)
    const title = extractTitle(segment) || image?.title
    if (!title && !image?.url) continue

    seen.add(videoCode)
    result.push({
      title: title || `GiriGiri #${videoCode}`,
      coverUrl: image?.url || "",
      videoCode,
      duration: extractDuration(segment),
      views: extractViews(segment),
      uploadTime: extractUploadTime(segment),
      currentArtist: extractCategory(segment),
      reviews: extractScore(segment),
      itemType: /slide-time|public-list|anthology/i.test(segment) ? "simplified" : "normal",
    })
  }

  return result
}

function extractVideoCardSegment(html: string, matchIndex: number): string {
  const containers = ["public-list-box", "slide-time-bj", "weekly-list", "module-card-item", "vod-detail"]
  for (const className of containers) {
    const start = findContainerStartBefore(html, matchIndex, className)
    if (start >= 0) {
      const element = extractElementAt(html, start)
      if (element && element.length < 20000) return element
    }
  }

  const anchorStart = html.lastIndexOf("<a", matchIndex)
  const anchorSegment = anchorStart >= 0 && anchorStart > matchIndex - 2000 ? extractElementAt(html, anchorStart) || "" : ""
  const contextSegment = html.slice(Math.max(0, matchIndex - 2600), Math.min(html.length, matchIndex + 4200))
  return `${anchorSegment}\n${contextSegment}`
}

function findContainerStartBefore(html: string, matchIndex: number, classPart: string): number {
  const searchStart = Math.max(0, matchIndex - 7000)
  const prefix = html.slice(searchStart, matchIndex)
  const regex = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*class=["'][^"']*${escapeRegExp(classPart)}[^"']*["'][^>]*>`, "gi")
  let last = -1
  let match: RegExpExecArray | null
  while ((match = regex.exec(prefix)) != null) {
    last = searchStart + match.index
  }
  return last
}

function parseVideoDetail(html: string, videoCode: string): HanimeVideoDetail {
  const detail = extractFirstElementByClass(html, "vod-detail") || html
  const title = extractTitle(detail) || extractMetaPropertyContent(html, "og:title")?.replace(/_.*$/, "") || `GiriGiri #${videoCode}`
  const image = extractImage(extractFirstElementByClass(detail, "detail-pic") || detail) || extractImage(html)
  const params = parseDetailParams(detail)
  const episodes = parseEpisodeSources(html)
  const firstEpisode = episodes[0]
  const tags = extractTags(detail)
  const related = parseVideoItems(extractRelatedSegment(html) || html)
    .filter((item) => item.videoCode !== videoCode)
    .slice(0, 24)

  return {
    title,
    coverUrl: image?.url || "",
    chineseTitle: params.month || undefined,
    introduction: extractVideoIntroduction(html) || undefined,
    uploadTime: params.release || params.year,
    views: params.views,
    videoUrls: episodes,
    tags,
    playlist: undefined,
    relatedHanimes: related,
    artist: params.director ? { name: params.director } : undefined,
    favTimes: parseOptionalInt(params.scoreCount),
    unlikesCount: undefined,
    originalComic: undefined,
    watchUrl: firstEpisode?.url || hanimeClient.watchUrl(videoCode),
  }
}

function parseEpisodeSources(html: string): HanimeVideoSource[] {
  const result: HanimeVideoSource[] = []
  const seen = new Set<string>()
  const groupNames = parseEpisodeGroupNames(html)
  const regex = new RegExp(PLAY_URL_REGEX.source, "gi")
  let match: RegExpExecArray | null

  while ((match = regex.exec(html)) != null) {
    const code = match[1]
    const sourceIndex = Number.parseInt(match[2], 10)
    const episodeIndex = Number.parseInt(match[3], 10)
    const key = `${code}-${sourceIndex}-${episodeIndex}`
    if (seen.has(key)) continue
    seen.add(key)

    const anchorStart = html.lastIndexOf("<a", match.index)
    const anchor = anchorStart >= 0 && anchorStart > match.index - 800 ? extractElementAt(html, anchorStart) || "" : ""
    const textLabel = normalizeEpisodeLabel(cleanText(anchor))
    const group = groupNames[sourceIndex - 1]
    const label = [group, textLabel || episodeIndex.toString().padStart(2, "0")].filter(Boolean).join(" · ")
    result.push({
      label,
      url: normalizeUrl(`playGV${code}-${sourceIndex}-${episodeIndex}/`),
      type: "text/html",
    })
  }

  return result.sort((left, right) => episodeSourceSortKey(left.label) - episodeSourceSortKey(right.label))
}

function parsePlayableSource(html: string): HanimeVideoSource | null {
  const playerJson = extractPlayerConfigJson(html)
  const playerSource = playerJson ? parsePlayerConfigSource(playerJson) : null
  if (playerSource) return playerSource

  const directUrl = extractFirstPlayableUrl(html)
  return directUrl ? { label: "视频直链", url: directUrl, type: normalizePlayableType(directUrl) } : null
}

function extractPlayerConfigJson(html: string): string | null {
  const marker = "player_aaaa="
  const markerIndex = html.indexOf(marker)
  if (markerIndex < 0) return null

  const jsonStart = html.indexOf("{", markerIndex)
  if (jsonStart < 0) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = jsonStart; index < html.length; index += 1) {
    const char = html[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === "\\") {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === "{") depth += 1
    if (char === "}") {
      depth -= 1
      if (depth === 0) return html.slice(jsonStart, index + 1)
    }
  }
  return null
}

function parsePlayerConfigSource(json: string): HanimeVideoSource | null {
  try {
    const data = JSON.parse(json) as { url?: string; encrypt?: number; from?: string; note?: string }
    const decodedUrl = decodePlayerUrl(data.url || "", data.encrypt)
    if (!decodedUrl) return null
    return {
      label: data.note || playerSourceLabel(data.from) || "原生播放",
      url: decodedUrl,
      type: normalizePlayableType(decodedUrl),
    }
  } catch (error) {
    console.error("解析 GiriGiri 播放参数失败:", error)
    return null
  }
}

function decodePlayerUrl(value: string, encrypt?: number): string {
  let text = value || ""
  if (!text) return ""
  try {
    if (encrypt === 2) text = decodeURIComponent(base64DecodeUtf8(text))
    if (encrypt === 1) text = decodeURIComponent(text)
  } catch (error) {
    console.error("解码 GiriGiri 播放地址失败:", error)
  }
  return text
}

function base64DecodeUtf8(value: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
  let output = ""
  let index = 0
  const input = value.replace(/[^A-Za-z0-9+/=]/g, "")
  while (index < input.length) {
    const s = alphabet.indexOf(input.charAt(index++))
    const o = alphabet.indexOf(input.charAt(index++))
    const u = alphabet.indexOf(input.charAt(index++))
    const a = alphabet.indexOf(input.charAt(index++))
    const n = (s << 2) | (o >> 4)
    const r = ((o & 15) << 4) | (u >> 2)
    const i = ((u & 3) << 6) | a
    output += String.fromCharCode(n)
    if (u !== 64 && u >= 0) output += String.fromCharCode(r)
    if (a !== 64 && a >= 0) output += String.fromCharCode(i)
  }
  return decodeUtf8Binary(output)
}

function decodeUtf8Binary(value: string): string {
  let output = ""
  let index = 0
  while (index < value.length) {
    const first = value.charCodeAt(index)
    if (first < 128) {
      output += String.fromCharCode(first)
      index += 1
    } else if (first > 191 && first < 224) {
      const second = value.charCodeAt(index + 1)
      output += String.fromCharCode(((first & 31) << 6) | (second & 63))
      index += 2
    } else {
      const second = value.charCodeAt(index + 1)
      const third = value.charCodeAt(index + 2)
      output += String.fromCharCode(((first & 15) << 12) | ((second & 63) << 6) | (third & 63))
      index += 3
    }
  }
  return output
}

function extractFirstPlayableUrl(html: string): string {
  const directPattern = /https?:\/\/[^"'<>\s]+?\.(?:m3u8|mp4|m4v|mov|webm)(?:\?[^"'<>\s]*)?/i
  return directPattern.exec(html)?.[0] || ""
}

function isDirectPlayableUrl(url: string, type?: string): boolean {
  const normalizedUrl = url.toLowerCase().split("?")[0]
  const normalizedType = (type || "").toLowerCase()
  return /\.(m3u8|mp4|m4v|mov|webm)$/.test(normalizedUrl) || normalizedType.startsWith("video/") || normalizedType.includes("mpegurl") || normalizedType.includes("hls")
}

function normalizePlayableType(url: string, type?: string): string {
  const normalizedUrl = url.toLowerCase().split("?")[0]
  const normalizedType = (type || "").toLowerCase()
  if (normalizedType && normalizedType !== "text/html") return type || normalizedType
  if (normalizedUrl.endsWith(".m3u8")) return "application/vnd.apple.mpegurl"
  if (normalizedUrl.endsWith(".webm")) return "video/webm"
  if (normalizedUrl.endsWith(".mov")) return "video/quicktime"
  return "video/mp4"
}

function playerSourceLabel(from?: string): string {
  if (from === "cht") return "繁中"
  if (from === "chs") return "简中"
  return from || ""
}

function parseEpisodeGroupNames(html: string): string[] {
  const tabSegment = extractFirstElementByClass(html, "anthology-tab") || ""
  return Array.from(tabSegment.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => normalizeFieldText(cleanText(match[1])))
    .filter(Boolean)
}

function normalizeEpisodeLabel(value: string): string {
  return normalizeFieldText(value)
    .replace(/^(播放|視頻|视频|繁中|簡中|简中)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function episodeSourceSortKey(label: string): number {
  const match = /(?:^|\D)(\d{1,4})(?:\D|$)/.exec(normalizeFullWidthDigits(label))
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

function extractRelatedSegment(html: string): string | null {
  const start = html.indexOf("相關作品") >= 0 ? html.indexOf("相關作品") : html.indexOf("推薦番劇")
  return start >= 0 ? html.slice(start) : null
}

function parseDetailParams(html: string): {
  director?: string
  actor?: string
  tags?: string
  month?: string
  release?: string
  year?: string
  views?: string
  scoreCount?: string
} {
  const text = cleanText(html)
  const field = (name: string) => {
    const match = new RegExp(`${name}\\s*[:：]\\s*([^，。\\n]+?)(?=(?:導演|导演|演員|演员|類型|类型)\\s*[:：]|$)`).exec(text)
    return normalizeFieldText(match?.[1] || "").replace(/,$/, "") || undefined
  }
  return {
    director: field("(?:導演|导演)"),
    actor: field("(?:演員|演员)"),
    tags: field("(?:類型|类型)"),
    month: /\b(一月|四月|七月|十月)\b/.exec(text)?.[1],
    release: /(\d{1,2}月\d{1,2}日上映)/.exec(text)?.[1],
    year: /\b(20\d{2}|19\d{2})\b/.exec(text)?.[1],
    views: /(?:熱度|热度|播放|觀看|观看)[：:]?\s*(\d+)/.exec(text)?.[1],
    scoreCount: /(\d+)次評分/.exec(text)?.[1],
  }
}

function extractTags(html: string): string[] {
  const params = parseDetailParams(html)
  const values = new Set<string>()
  for (const tag of (params.tags || "").split(/[,，、\s]+/)) {
    const text = normalizeFieldText(tag)
    if (text && text.length <= 16) values.add(text)
  }

  for (const match of html.matchAll(/\/show\/\d+---([^\/-]+)-{6,}\//gi)) {
    const tag = normalizeFieldText(decodeURIComponent(match[1]))
    if (tag && tag.length <= 16) values.add(tag)
  }

  return Array.from(values)
}

function extractVideoIntroduction(html: string): string {
  const candidates = [
    extractElementById(html, "height_limit") || "",
    extractFirstElementByClass(html, "vod-content") || "",
    extractFirstElementByClass(html, "content_desc") || "",
    extractMetaContent(html, "description") || extractMetaPropertyContent(html, "og:description") || "",
  ]

  for (const candidate of candidates) {
    const text = normalizeIntroductionText(cleanText(candidate))
    if (text) return text
  }
  return ""
}

function normalizeIntroductionText(value: string): string {
  const text = normalizeFieldText(value)
    .replace(/^簡介\s*/i, "")
    .replace(/\s*展開.*$/g, "")
    .replace(/girigiri愛動漫.*$/i, "")
    .trim()
  if (text.length < 8) return ""
  if (/^(播放|簡介|简介|角色|詳情|详情)$/.test(text)) return ""
  return text
}

function extractDuration(segment: string): string | undefined {
  const text = cleanText(segment)
  return /(更新至[^\s，。]+(?:\s*\/\s*[^\s，。]+)?|已完結|已完结|\d{1,2}點\d{1,2}分|\d{1,2}\.\d)/.exec(text)?.[1]
}

function extractUploadTime(segment: string): string | undefined {
  const text = cleanText(segment)
  return /(\d{1,2}月\d{1,2}日(?:起|上映)?|每週[一二三四五六日]|20\d{2}-\d{2}|20\d{2})/.exec(text)?.[1]
}

function extractCategory(segment: string): string | undefined {
  const text = extractTextByClass(segment, "slide-info-type") || extractTextByClass(segment, "public-list-subtitle") || ""
  const category = /(日番|美番|劇場版|剧场版|真人番劇|BD副音軌)/.exec(text)?.[1]
  return category || undefined
}

function extractViews(segment: string): string | undefined {
  const text = cleanText(segment)
  return /(?:|熱度|热度|播放|觀看|观看)\s*(\d+)/.exec(text)?.[1]
}

function extractScore(segment: string): string | undefined {
  const text = cleanText(segment)
  const score = /(?:普通級|PG-12|R-15|R-18)?\s*(\d+(?:\.\d))\s*(?:)?/.exec(text)?.[1]
  return score ? `评分 ${score}` : undefined
}

function extractImage(segment: string): { url: string; title?: string } | undefined {
  const images: Array<{ url: string; title?: string; score: number }> = []
  for (const imageMatch of segment.matchAll(/<img\b[^>]*>/gi)) {
    const tag = imageMatch[0]
    const url = normalizeUrl(getAttribute(tag, "data-src") || getAttribute(tag, "data-original") || getAttribute(tag, "src") || "")
    const title = normalizeTitleText(cleanText(getAttribute(tag, "alt") || getAttribute(tag, "title") || ""))
    if (!url || /blank|transparent|avatar|logo|liang|an\.png/i.test(url)) continue
    let score = 0
    if (/detail-pic|vod|public|lazy|mask-this|poster|slide/i.test(tag)) score += 4
    if (title) score += 2
    images.push({ url, title: title || undefined, score })
  }

  for (const bgMatch of segment.matchAll(/(?:data-background|data-src)=["']([^"']+)["']|background-image\s*:\s*url\(([^)]+)\)/gi)) {
    const raw = (bgMatch[1] || bgMatch[2] || "").replace(/^['"]|['"]$/g, "")
    const url = normalizeUrl(raw)
    if (!url || /blank|transparent|avatar|logo|liang|an\.png/i.test(url)) continue
    images.push({ url, title: undefined, score: 3 })
  }

  images.sort((left, right) => right.score - left.score)
  const best = images[0]
  return best ? { url: best.url, title: best.title } : undefined
}

function extractTitle(segment: string): string | undefined {
  const patterns = [
    /<a\b[^>]*class=["'][^"']*(?:public-list-exp|time-title|this-title|vod-title)[^"']*["'][^>]*\btitle=["']([^"']+)["'][^>]*>/i,
    /<img\b[^>]*(?:alt|title)=["']([^"']+)["'][^>]*>/i,
    /<h[1-4]\b[^>]*class=["'][^"']*(?:slide-info-title|time-title|this-title|title-h)\b[^"']*["'][^>]*>([\s\S]*?)<\/h[1-4]>/i,
    /<a\b[^>]*class=["'][^"']*(?:time-title|this-title|vod-title)\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    /<div\b[^>]*class=["'][^"']*(?:time-title|this-title|vod-title)\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<a\b[^>]*\btitle=["']([^"']+)["'][^>]*>/i,
  ]

  for (const pattern of patterns) {
    const value = normalizeTitleText(cleanText(pattern.exec(segment)?.[1] || ""))
    if (isLikelyTitle(value)) return value
  }

  const anchorTexts = Array.from(segment.matchAll(/<a\b[^>]*href=["'][^"']*\/GV\d+\/?["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => normalizeTitleText(cleanText(match[1])))
    .filter(isLikelyTitle)
  return anchorTexts.sort((left, right) => right.length - left.length)[0]
}

function isLikelyTitle(value: string): boolean {
  if (value.length < 2 || value.length > 140) return false
  if (/^(播放|視頻|视频|詳情|详情|更多|首頁|首页|日番|美番|劇場版|剧场版|普通級|普通级|PG-12|R-15|R-18)$/i.test(value)) return false
  if (/(在原作中广受欢迎|在原作中廣受歡迎|描绘了|描繪了|讲述了|講述了|故事讲述|故事講述)/.test(value)) return false
  if (/^\d{1,2}$/.test(value)) return false
  return true
}

function normalizeVideoCode(value: string | undefined | null): string {
  const code = extractVideoCode(value)
  return code || ""
}

function normalizeTitleText(value: string): string {
  return value
    .replace(/([\x00-\x1f])/g, " ")
    .replace(/([\x00-\x1f])/g, " ")
    .replace(/([\u3040-\u30ff\u3400-\u9fff])\s+([\u3040-\u30ff\u3400-\u9fff])/g, "$1$2")
    .replace(/\s+([、。，．！？!?：；])/g, "$1")
    .replace(/([（「『【［《([{])\s+/g, "$1")
    .replace(/\s+([）」』】］》)\]}])/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeFullWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) => String(char.charCodeAt(0) - 0xff10))
}

function extractTextByClass(html: string, classPart: string): string | undefined {
  const element = extractFirstElementByClass(html, classPart)
  return normalizeFieldText(cleanText(element || "")) || undefined
}

function normalizeFieldText(value: string): string {
  const text = value.replace(/\s+/g, " ").trim()
  return /^(播放|觀看|观看|更多|收藏|分享|詳情|详情|排序|單列|单列)$/i.test(text) ? "" : text
}

function extractMetaContent(html: string, name: string): string | undefined {
  const tag = html.match(new RegExp(`<meta\\b[^>]*name=["']${escapeRegExp(name)}["'][^>]*>`, "i"))?.[0]
  return tag ? getAttribute(tag, "content") : undefined
}

function extractMetaPropertyContent(html: string, property: string): string | undefined {
  const tag = html.match(new RegExp(`<meta\\b[^>]*property=["']${escapeRegExp(property)}["'][^>]*>`, "i"))?.[0]
  return tag ? getAttribute(tag, "content") : undefined
}

function extractFirstElementByClass(html: string, classPart: string): string | null {
  const regex = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*class=["'][^"']*${escapeRegExp(classPart)}[^"']*["'][^>]*>`, "i")
  const match = regex.exec(html)
  return match ? extractElementAt(html, match.index) : null
}

function extractElementById(html: string, id: string): string | null {
  const regex = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*id=["']${escapeRegExp(id)}["'][^>]*>`, "i")
  const match = regex.exec(html)
  return match ? extractElementAt(html, match.index) : null
}

function extractElementAt(html: string, startIndex: number): string | null {
  const start = html.slice(startIndex).match(/^<([a-zA-Z][\w:-]*)\b[^>]*>/)
  if (!start) return null
  const tagName = start[1]
  const tagRegex = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, "gi")
  tagRegex.lastIndex = startIndex
  let depth = 0
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(html)) != null) {
    const tag = match[0]
    const closing = tag.startsWith("</")
    const selfClosing = tag.endsWith("/>") || /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i.test(tagName)
    if (closing) {
      depth -= 1
    } else if (!selfClosing) {
      depth += 1
    }

    if (depth === 0) {
      return html.slice(startIndex, tagRegex.lastIndex)
    }
  }

  return null
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)
  return match ? decodeHtml(match[1]) : undefined
}

function normalizeUrl(value: string | undefined | null): string {
  if (!value) return ""
  const url = decodeHtml(value).trim()
  if (!url || url === "javascript:") return ""
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith("//")) return `https:${url}`
  if (url.startsWith("/")) return `${HANIME_BASE_URL.replace(/\/$/, "")}${url}`
  return `${HANIME_BASE_URL}${url.replace(/^\.\//, "")}`
}

function cleanText(value: string): string {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:i|em|span)\b[^>]*class=["'][^"']*(?:\bfa\b|icon|ds-)[^"']*["'][^>]*>[\s\S]*?<\/(?:i|em|span)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
