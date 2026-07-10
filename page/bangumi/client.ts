import { Script, fetch } from "scripting"
import type { BangumiRakuenMode } from "./types"

export type BangumiAuth = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export type BangumiClientCredentials = {
  clientId: string
  clientSecret: string
}

export type BangumiClientConfig = {
  clientName: "Chii"
  publicEndpoint: "https://api.bgm.tv"
  privateEndpoint: "https://next.bgm.tv"
  webEndpoint: "https://bgm.tv"
  callbackURL: string
  authDomain: string
}

export type BangumiAppState = {
  isAuthenticated: boolean
  isolationMode: boolean
  hasUnreadNotice: boolean
  appearanceMode: "system" | "light" | "dark"
  manualAppearanceMode: "light" | "dark"
}

export type BangumiOAuthCallbackPayload = {
  code: string
  error: string
  errorDescription: string
}

export type BangumiOAuthConsumeResult = {
  status: "idle" | "success" | "error"
  message: string
}

export type BangumiOAuthDebugInfo = {
  lastCallbackInput: string
  lastParsedCallback: string
  lastConsumeResult: string
  lastTokenRequest: string
  lastTokenResponse: string
  lastError: string
  updatedAt: number
}

export type SubjectCollectionQuery = {
  since?: number
  limit?: number
  offset?: number
  type?: number
  subjectType?: number
}

export type TimelineQuery = {
  mode?: string
  limit?: number
  until?: number
}

export type TimelinePostPayload = {
  content: string
  turnstileToken?: string
}

export type TimelineReplyPayload = {
  content: string
  replyTo?: number
  turnstileToken?: string
}

export type SearchSubjectQuery = {
  keyword: string
  type?: number
  limit?: number
  offset?: number
}

export type SearchMonoQuery = {
  keyword: string
  limit?: number
  offset?: number
}

export type SubjectCollectionUpdate = {
  type: number
  rate?: number
  comment?: string
  private?: boolean
}

export type EpisodeCollectionUpdate = {
  type: number
}

const STORAGE_KEYS = {
  auth: "bangumi.auth",
  state: "bangumi.state",
  authDomain: "bangumi.authDomain",
  clientId: "bangumi.clientId",
  clientSecret: "bangumi.clientSecret",
  oauthDebug: "bangumi.oauthDebug",
} as const

const BANGUMI_SCRIPT_NAME = "Bangumi Beta"
const AUTH_REFRESH_SKEW_MS = 60 * 1000

export function buildBangumiResumeURL(queryParameters: Record<string, string> = {}) {
  return Script.createRunSingleURLScheme(BANGUMI_SCRIPT_NAME, {
    oauth_callback: "1",
    ...queryParameters,
  })
}

export function getBangumiCallbackURL() {
  return buildBangumiResumeURL()
}

export function getBangumiClientConfig(): BangumiClientConfig {
  return {
    clientName: "Chii",
    publicEndpoint: "https://api.bgm.tv",
    privateEndpoint: "https://next.bgm.tv",
    webEndpoint: "https://bgm.tv",
    callbackURL: getBangumiCallbackURL(),
    authDomain: readString(STORAGE_KEYS.authDomain, "next.bgm.tv"),
  }
}

export function getBangumiAppState(): BangumiAppState {
  const state = readJson<Partial<BangumiAppState>>(STORAGE_KEYS.state, {})
  return {
    isAuthenticated: Boolean(state.isAuthenticated),
    isolationMode: Boolean(state.isolationMode),
    hasUnreadNotice: Boolean(state.hasUnreadNotice),
    appearanceMode: state.appearanceMode === "light" || state.appearanceMode === "dark" ? state.appearanceMode : "system",
    manualAppearanceMode: state.manualAppearanceMode === "light" || state.manualAppearanceMode === "dark" ? state.manualAppearanceMode : "dark",
  }
}

export function setBangumiAppState(next: BangumiAppState) {
  Storage.set(STORAGE_KEYS.state, JSON.stringify(next))
}

export function getBangumiAuth() {
  return readJson<BangumiAuth | null>(STORAGE_KEYS.auth, null)
}

export function getBangumiOAuthDebugInfo(): BangumiOAuthDebugInfo {
  return readJson<BangumiOAuthDebugInfo>(STORAGE_KEYS.oauthDebug, {
    lastCallbackInput: "",
    lastParsedCallback: "",
    lastConsumeResult: "",
    lastTokenRequest: "",
    lastTokenResponse: "",
    lastError: "",
    updatedAt: 0,
  })
}

export function clearBangumiOAuthDebugInfo() {
  Storage.remove(STORAGE_KEYS.oauthDebug)
}

export function getBangumiClientCredentials(): BangumiClientCredentials {
  return {
    clientId: readString(STORAGE_KEYS.clientId, ""),
    clientSecret: readString(STORAGE_KEYS.clientSecret, ""),
  }
}

export function setBangumiClientCredentials(next: Partial<BangumiClientCredentials>) {
  if (typeof next.clientId === "string") {
    Storage.set(STORAGE_KEYS.clientId, next.clientId)
  }
  if (typeof next.clientSecret === "string") {
    Storage.set(STORAGE_KEYS.clientSecret, next.clientSecret)
  }
}

export function setBangumiAuthDomain(domain: string) {
  Storage.set(STORAGE_KEYS.authDomain, domain.trim())
}

export function getBangumiClientSnapshot() {
  const credentials = getBangumiClientCredentials()
  const auth = getBangumiAuth()
  const config = getBangumiClientConfig()
  return {
    config,
    hasClientId: Boolean(credentials.clientId),
    hasClientSecret: Boolean(credentials.clientSecret),
    hasAccessToken: Boolean(auth?.accessToken),
    hasRefreshToken: Boolean(auth?.refreshToken),
    isExpired: isBangumiAuthExpired(auth),
    expiresAt: auth?.expiresAt ?? 0,
  }
}

export function isBangumiAuthExpired(auth = getBangumiAuth(), skewMs = AUTH_REFRESH_SKEW_MS) {
  if (!auth?.accessToken) {
    return true
  }
  if (!auth.expiresAt) {
    return false
  }
  return auth.expiresAt <= Date.now() + Math.max(0, skewMs)
}

export async function ensureBangumiAuth() {
  const auth = getBangumiAuth()
  if (!auth?.accessToken) {
    return null
  }

  if (!isBangumiAuthExpired(auth)) {
    return auth
  }

  if (!auth.refreshToken) {
    setBangumiAuth(null)
    return null
  }

  const credentials = getBangumiClientCredentials()
  if (!credentials.clientId || !credentials.clientSecret) {
    return auth
  }

  try {
    return await refreshAccessToken({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      refreshToken: auth.refreshToken,
    })
  } catch {
    setBangumiAuth(null)
    return null
  }
}

export async function consumeBangumiOAuthCallback(input: Record<string, any> | string | null | undefined): Promise<BangumiOAuthConsumeResult> {
  writeOAuthDebug({
    lastCallbackInput: serializeDebugValue(input),
  })

  const payload = parseBangumiOAuthCallbackPayload(input)
  writeOAuthDebug({
    lastParsedCallback: serializeDebugValue(payload),
  })

  if (!payload) {
    const result = {
      status: "idle",
      message: "未检测到授权回调参数",
    } satisfies BangumiOAuthConsumeResult
    writeOAuthDebug({ lastConsumeResult: serializeDebugValue(result) })
    return result
  }

  if (payload.error) {
    const result = {
      status: "error",
      message: payload.errorDescription || payload.error,
    } satisfies BangumiOAuthConsumeResult
    writeOAuthDebug({
      lastConsumeResult: serializeDebugValue(result),
      lastError: result.message,
    })
    return result
  }

  const credentials = getBangumiClientCredentials()
  if (!credentials.clientId || !credentials.clientSecret) {
    const result = {
      status: "error",
      message: "缺少应用 ID 或应用密钥，无法完成授权",
    } satisfies BangumiOAuthConsumeResult
    writeOAuthDebug({
      lastConsumeResult: serializeDebugValue(result),
      lastError: result.message,
    })
    return result
  }

  try {
    const auth = await exchangeForAccessToken({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      code: payload.code,
    })

    if (!auth?.accessToken) {
      const result = {
        status: "error",
        message: "授权回调未返回访问凭据",
      } satisfies BangumiOAuthConsumeResult
      writeOAuthDebug({
        lastConsumeResult: serializeDebugValue(result),
        lastError: result.message,
      })
      return result
    }

    const result = {
      status: "success",
      message: "已完成授权并保存登录状态",
    } satisfies BangumiOAuthConsumeResult
    writeOAuthDebug({
      lastConsumeResult: serializeDebugValue(result),
      lastError: "",
    })
    return result
  } catch (error) {
    const result = {
      status: "error",
      message: error instanceof Error ? error.message : "授权回调处理失败",
    } satisfies BangumiOAuthConsumeResult
    writeOAuthDebug({
      lastConsumeResult: serializeDebugValue(result),
      lastError: result.message,
    })
    return result
  }
}

export function setBangumiAuth(auth: BangumiAuth | null) {
  if (auth) {
    Storage.set(STORAGE_KEYS.auth, JSON.stringify(auth))
  } else {
    Storage.remove(STORAGE_KEYS.auth)
  }

  const current = getBangumiAppState()
  setBangumiAppState({
    ...current,
    isAuthenticated: Boolean(auth?.accessToken),
  })
}

export function buildOAuthURL(clientId: string) {
  const config = getBangumiClientConfig()
  const query = [
    `client_id=${encodeURIComponent(clientId)}`,
    "response_type=code",
    `redirect_uri=${encodeURIComponent(config.callbackURL)}`,
  ].join("&")
  return `https://${config.authDomain}/oauth/authorize?${query}`
}

export async function exchangeForAccessToken(params: {
  clientId: string
  clientSecret: string
  code: string
}) {
  const config = getBangumiClientConfig()
  const response = await postOAuthToken({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: config.callbackURL,
  })
  const auth = normalizeTokenResponse(response)
  if (auth) {
    setBangumiAuth(auth)
  }
  return auth
}

export async function refreshAccessToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}) {
  const config = getBangumiClientConfig()
  const response = await postOAuthToken({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    redirect_uri: config.callbackURL,
  })
  const auth = normalizeTokenResponse(response)
  if (auth) {
    setBangumiAuth(auth)
  }
  return auth
}

export async function loadCalendar() {
  const candidates = [
    () => requestPrivate("p1/calendar"),
    () => requestPublic("calendar"),
    () => requestPublic("v0/calendar"),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi calendar request failed")
}

export async function loadTrendingSubjects(type?: string) {
  const candidates = [
    () => requestPrivate(type ? `p1/trending/subjects?type=${encodeURIComponent(type)}` : "p1/trending/subjects"),
    () => requestPublic("v0/search/subjects", {
      method: "POST",
      body: JSON.stringify({
        keyword: "",
        sort: "rank",
        filter: type ? { type: [Number(type)] } : {},
      }),
      query: { limit: "8", offset: "0" },
    }),
    () => requestPublic("v0/search/subjects", {
      method: "POST",
      body: JSON.stringify({
        keyword: "",
        sort: "heat",
        filter: type ? { type: [Number(type)] } : {},
      }),
      query: { limit: "8", offset: "0" },
    }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi trending subjects request failed")
}

export async function loadSubject(subjectId: number) {
  const primary = await requestPrivate(`p1/subjects/${subjectId}`)
  try {
    const publicDetail = await requestPublic(`v0/subjects/${subjectId}`)
    if (isPlainObject(primary) && isPlainObject(publicDetail)) {
      return { ...publicDetail, ...primary, name_cn: readMergedString(primary.name_cn) ?? readMergedString(primary.nameCn) ?? readMergedString(primary.nameCN) ?? readMergedString(primary.chineseName) ?? readMergedString(primary.chinese_title) ?? readMergedString(publicDetail.name_cn) ?? readMergedString(publicDetail.nameCn) ?? readMergedString(publicDetail.nameCN) ?? readMergedString(publicDetail.chineseName) ?? readMergedString(publicDetail.chinese_title), infobox: primary.infobox ?? publicDetail.infobox }
    }
  } catch {
    // p1 detail is enough; v0 is only used to supplement name_cn / infobox.
  }
  return primary
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readMergedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

export async function loadCharacter(characterId: number) {
  return requestPrivate(`p1/characters/${characterId}`)
}

export async function loadPerson(personId: number) {
  return requestPrivate(`p1/persons/${personId}`)
}

export async function loadMonoDetails(kind: "角色" | "人物", id: number) {
  if (kind === "角色") {
    return Promise.all([
      loadCharacter(id),
      requestPrivate(`p1/characters/${id}/casts?limit=8&offset=0`),
      requestPrivate(`p1/characters/${id}/relations?limit=8&offset=0`),
    ])
  }

  return Promise.all([
    loadPerson(id),
    requestPrivate(`p1/persons/${id}/works?limit=8&offset=0`),
    requestPrivate(`p1/persons/${id}/relations?limit=8&offset=0`),
  ])
}

export async function loadSubjectIndexes(subjectId: number) {
  const candidates = [
    () => requestPrivate(`p1/subjects/${subjectId}/indexes?limit=12&offset=0`),
    () => requestPrivate(`p1/subjects/${subjectId}/indices?limit=12&offset=0`),
    () => requestPrivate(`p1/indexes`, { query: { subject_id: String(subjectId), limit: "12", offset: "0" } }),
    () => requestPrivate(`p1/indices`, { query: { subject_id: String(subjectId), limit: "12", offset: "0" } }),
    () => requestPublic(`v0/subjects/${subjectId}/indices`, { query: { limit: "12", offset: "0" } }),
    () => requestPublic(`v0/subjects/${subjectId}/indexes`, { query: { limit: "12", offset: "0" } }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi subject indexes request failed")
}

export async function loadSubjectDetails(subjectId: number) {
  return Promise.all([
    requestPrivate(`p1/subjects/${subjectId}/characters`),
    requestPrivate(`p1/subjects/${subjectId}/relations`),
    requestPrivate(`p1/subjects/${subjectId}/recs`),
    loadSubjectIndexes(subjectId).catch(() => null),
    requestPrivate(`p1/subjects/${subjectId}/episodes?limit=24&offset=0`),
    requestPrivate(`p1/subjects/${subjectId}/comments?limit=20&offset=0`),
    requestPrivate(`p1/subjects/${subjectId}/topics?limit=6&offset=0`),
    loadSubjectReviews(subjectId).catch(() => null),
    loadSubjectCollectors(subjectId).catch(() => null),
  ])
}

export async function loadSubjectReviews(subjectId: number) {
  const candidates = [
    () => requestPrivate(`p1/subjects/${subjectId}/reviews?limit=6&offset=0`),
    () => requestPrivate(`p1/subjects/${subjectId}/blogs?limit=6&offset=0`),
    () => requestPublic(`v0/subjects/${subjectId}/reviews`, { query: { limit: "6", offset: "0" } }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi subject reviews request failed")
}

export async function loadSubjectReviewDetail(subjectId: number, reviewId: number) {
  const candidates = [
    () => requestPrivate(`p1/reviews/${reviewId}`),
    () => requestPrivate(`p1/blogs/${reviewId}`),
    () => requestPrivate(`p1/subjects/${subjectId}/reviews/${reviewId}`),
    () => requestPrivate(`p1/subjects/${subjectId}/blogs/${reviewId}`),
    () => requestPublic(`v0/reviews/${reviewId}`),
    () => requestPublic(`v0/blogs/${reviewId}`),
    () => requestPublic(`v0/subjects/${subjectId}/reviews/${reviewId}`),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi subject review detail request failed")
}

export async function loadSubjectCollectors(subjectId: number) {
  const candidates = [
    () => requestPrivate(`p1/subjects/${subjectId}/collections?limit=8&offset=0`),
    () => requestPrivate(`p1/collections/subjects/${subjectId}/users?limit=8&offset=0`),
    () => requestPublic(`v0/subjects/${subjectId}/collections`, { query: { limit: "8", offset: "0" } }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi subject collectors request failed")
}

export async function loadIndexDetail(indexId: number) {
  const detailCandidates = [
    () => requestPrivate(`p1/indexes/${indexId}`),
    () => requestPrivate(`p1/indices/${indexId}`),
    () => requestPublic(`v0/indices/${indexId}`),
  ]
  const subjectCandidates = [
    () => requestPrivate(`p1/indexes/${indexId}/subjects?limit=30&offset=0`),
    () => requestPrivate(`p1/indices/${indexId}/subjects?limit=30&offset=0`),
    () => requestPublic(`v0/indices/${indexId}/subjects`, { query: { limit: "30", offset: "0" } }),
  ]

  let detailResponse: unknown = null
  let subjectResponse: unknown = null
  let lastError: unknown = null

  for (const candidate of detailCandidates) {
    try {
      detailResponse = await candidate()
      break
    } catch (error) {
      lastError = error
    }
  }

  for (const candidate of subjectCandidates) {
    try {
      subjectResponse = await candidate()
      break
    } catch (error) {
      lastError = error
    }
  }

  if (detailResponse || subjectResponse) {
    return { index: detailResponse, subjects: subjectResponse }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi index detail request failed")
}

export async function loadUser(username: string) {
  return requestPrivate(`p1/users/${encodeURIComponent(username)}`)
}

export async function loadCurrentUser() {
  const candidates = [
    "p1/me",
    "p1/user",
    "v0/me",
    "v0/users/-",
    "p1/users/-",
  ]

  let lastError: unknown = null
  for (const path of candidates) {
    try {
      return await requestPrivate(path)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi current user request failed")
}

export async function getSubjectCollections(query: SubjectCollectionQuery = {}) {
  const params: string[] = []
  if (query.since) params.push(`since=${encodeURIComponent(`${query.since}`)}`)
  if (query.limit) params.push(`limit=${encodeURIComponent(`${query.limit}`)}`)
  if (query.offset) params.push(`offset=${encodeURIComponent(`${query.offset}`)}`)
  if (query.type) params.push(`type=${encodeURIComponent(`${query.type}`)}`)
  if (query.subjectType) params.push(`subject_type=${encodeURIComponent(`${query.subjectType}`)}`)
  const suffix = params.length ? `?${params.join("&")}` : ""
  return requestPrivate(`p1/collections/subjects${suffix}`)
}

export async function getSubjectCollection(subjectId: number) {
  const candidates = [
    () => requestAuthorizedPublic(`v0/users/-/collections/${subjectId}`),
    () => requestPrivate(`p1/collections/subjects/${subjectId}`),
    () => requestPrivate(`p1/subjects/${subjectId}/collection`),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi subject collection request failed")
}

export async function updateSubjectCollection(subjectId: number, update: SubjectCollectionUpdate) {
  const body = JSON.stringify({
    type: update.type,
    rate: update.rate ?? 0,
    comment: update.comment ?? "",
    private: update.private ?? false,
  })
  const candidates = [
    () => requestAuthorizedPublic(`v0/users/-/collections/${subjectId}`, { method: "PATCH", body }),
    () => requestAuthorizedPublic(`v0/users/-/collections/${subjectId}`, { method: "POST", body }),
    () => requestPrivate(`p1/collections/subjects/${subjectId}`, { method: "POST", body }),
    () => requestPrivate("p1/collections/subjects", { method: "POST", body: JSON.stringify({ subject_id: subjectId, ...update }) }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi collection update failed")
}

export async function updateEpisodeCollection(subjectId: number, episodeId: number, update: EpisodeCollectionUpdate) {
  const body = JSON.stringify({ type: update.type })
  const candidates = [
    () => requestAuthorizedPublic(`v0/users/-/collections/-/episodes/${episodeId}`, { method: "PUT", body }),
    () => requestAuthorizedPublic(`v0/users/-/collections/${subjectId}/episodes`, { method: "PATCH", body: JSON.stringify({ episode_id: [episodeId], type: update.type }) }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi episode collection update failed")
}

export async function updateEpisodeCollections(subjectId: number, episodeIds: number[], update: EpisodeCollectionUpdate) {
  const uniqueEpisodeIds = Array.from(new Set(episodeIds.filter((id) => Number.isFinite(id) && id > 0)))
  if (!uniqueEpisodeIds.length) {
    return null
  }

  const candidates = [
    () => requestAuthorizedPublic(`v0/users/-/collections/${subjectId}/episodes`, {
      method: "PATCH",
      body: JSON.stringify({ episode_id: uniqueEpisodeIds, type: update.type }),
    }),
    ...(uniqueEpisodeIds.length === 1
      ? [() => requestAuthorizedPublic(`v0/users/-/collections/-/episodes/${uniqueEpisodeIds[0]}`, { method: "PUT", body: JSON.stringify({ type: update.type }) })]
      : []),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi episode collection batch update failed")
}

export async function getTimeline(query: TimelineQuery = {}) {
  const params = [
    `mode=${encodeURIComponent(query.mode ?? "friends")}`,
    `limit=${encodeURIComponent(`${query.limit ?? 20}`)}`,
  ]
  if (typeof query.until === "number") {
    params.push(`until=${encodeURIComponent(`${query.until}`)}`)
  }
  return requestPrivate(`p1/timeline?${params.join("&")}`)
}

export async function getUserTimeline(username: string, query: TimelineQuery = {}) {
  const params = [`limit=${encodeURIComponent(`${query.limit ?? 20}`)}`]
  if (typeof query.until === "number") {
    params.push(`until=${encodeURIComponent(`${query.until}`)}`)
  }
  return requestPrivate(`p1/users/${encodeURIComponent(username)}/timeline?${params.join("&")}`)
}

export async function getUserFriends(username: string, limit = 1) {
  const candidates = [
    () => requestPrivate(`p1/users/${encodeURIComponent(username)}/friends?limit=${encodeURIComponent(`${limit}`)}`),
    () => requestPrivate(`p1/friends?limit=${encodeURIComponent(`${limit}`)}`),
    () => requestPrivate(`p1/users/${encodeURIComponent(username)}/followers?limit=${encodeURIComponent(`${limit}`)}`),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi friends request failed")
}

export async function getTimelineReplies(timelineId: number) {
  return requestPrivate(`p1/timeline/${timelineId}/replies`)
}

export async function postTimeline(payload: TimelinePostPayload) {
  return requestPrivate("p1/timeline", {
    method: "POST",
    body: JSON.stringify({
      content: payload.content,
      turnstileToken: payload.turnstileToken ?? "",
    }),
  })
}

export async function postTimelineReply(timelineId: number, payload: TimelineReplyPayload) {
  return requestPrivate(`p1/timeline/${timelineId}/replies`, {
    method: "POST",
    body: JSON.stringify({
      content: payload.content,
      replyTo: payload.replyTo,
      turnstileToken: payload.turnstileToken ?? "",
    }),
  })
}

export async function likeBangumiPath(path: string, value = 1) {
  return requestPrivate(`${path.replace(/^\/+/, "")}/like`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  })
}

export async function unlikeBangumiPath(path: string) {
  return requestPrivate(`${path.replace(/^\/+/, "")}/like`, { method: "DELETE" })
}

export async function clearNotice(ids: number[]) {
  return requestPrivate("p1/clear-notify", {
    method: "POST",
    body: JSON.stringify({ id: ids }),
  })
}

export async function listNotice(limit = 1, unread = true) {
  const params = [`limit=${encodeURIComponent(`${limit}`)}`]
  if (unread) params.push("unread=true")
  return requestPrivate(`p1/notify?${params.join("&")}`)
}

export async function loadRakuenTopics(mode: BangumiRakuenMode = "groupAll", limit = 30) {
  const query = { limit: `${limit}`, offset: "0" }
  const request = getRakuenModeRequest(mode)
  const typedQuery = { ...query, ...request.query }
  const candidates = [
    () => requestPrivate(request.path, { query: typedQuery }),
    () => requestWebHtml("rakuen/topiclist", { query: { type: request.webType } }),
    ...(request.topicType === "group" ? [() => requestWebHtml("group")] : []),
    () => requestPrivate(`p1/rakuen/topics`, { query: { ...query, mode } }),
    () => requestPrivate(`p1/topics`, { query: { ...query, mode } }),
    () => requestPublic(`v0/rakuen/topics`, { query: { ...query, mode } }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi rakuen topics request failed")
}

export async function loadEpisodeComments(episodeId: number) {
  const candidates = [
    () => requestPrivate(`p1/episodes/${episodeId}/comments?limit=30&offset=0`),
    () => requestPrivate(`p1/episodes/${episodeId}/replies?limit=30&offset=0`),
    () => requestPublic(`v0/episodes/${episodeId}/comments`, { query: { limit: "30", offset: "0" } }),
  ]

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return await candidate()
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi episode comments request failed")
}

export async function loadTopicDetail(topicId: number, type: "subject" | "group" = "subject", topicUrl?: string) {
  const webCandidates = buildTopicDetailWebCandidates(topicId, type, topicUrl)
  const webRequests = webCandidates.map((path) => () => requestWebHtml(path))
  const candidates = type === "group"
    ? [
      ...webRequests,
      () => requestPrivate(`p1/groups/-/topics/${topicId}`),
    ]
    : [
      ...(topicUrl ? webRequests : []),
      () => requestPrivate(`p1/topics/${topicId}`),
      () => requestPrivate(`p1/topics/${topicId}/replies?limit=30&offset=0`),
      () => requestPrivate(`p1/subjects/-/topics/${topicId}`),
      ...(topicUrl ? [] : webRequests),
    ]

  const results: unknown[] = []
  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      results.push(await candidate())
    } catch (error) {
      lastError = error
      results.push(null)
    }
  }

  if (results.some(Boolean)) {
    return results
  }

  throw lastError instanceof Error ? lastError : new Error("Bangumi topic detail request failed")
}

export async function searchSubjects(query: SearchSubjectQuery) {
  const type = typeof query.type === "number" && query.type > 0 ? query.type : undefined
  return requestPublic("v0/search/subjects", {
    method: "POST",
    body: JSON.stringify({
      keyword: query.keyword,
      sort: "match",
      filter: type ? { type: [type] } : {},
    }),
    query: {
      limit: `${query.limit ?? 20}`,
      offset: `${query.offset ?? 0}`,
    },
  })
}

export async function searchCharacters(query: SearchMonoQuery) {
  return requestPrivate("p1/search/characters", {
    method: "POST",
    body: JSON.stringify({
      keyword: query.keyword,
      filter: {},
    }),
    query: {
      limit: `${query.limit ?? 20}`,
      offset: `${query.offset ?? 0}`,
    },
  })
}

export async function searchPersons(query: SearchMonoQuery) {
  return requestPrivate("p1/search/persons", {
    method: "POST",
    body: JSON.stringify({
      keyword: query.keyword,
      filter: {},
    }),
    query: {
      limit: `${query.limit ?? 20}`,
      offset: `${query.offset ?? 0}`,
    },
  })
}

async function requestPublic(path: string, options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: string; query?: Record<string, string> } = {}) {
  const config = getBangumiClientConfig()
  const query = options.query ? buildQueryString(options.query) : ""
  const response = await fetch(`${config.publicEndpoint}/${path}${query}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Bangumi Beta Scripting Client",
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`Bangumi public request failed: ${response.status} ${path}`)
  }

  return readResponseBody(response)
}

async function requestAuthorizedPublic(path: string, options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: string; query?: Record<string, string> } = {}) {
  const auth = await ensureBangumiAuth()
  const config = getBangumiClientConfig()
  const query = options.query ? buildQueryString(options.query) : ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Bangumi Beta Scripting Client",
  }

  if (auth?.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`
  }

  const response = await fetch(`${config.publicEndpoint}/${path}${query}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`Bangumi authorized public request failed: ${response.status} ${path}`)
  }

  return readResponseBody(response)
}

async function requestWebHtml(path: string, options: { query?: Record<string, string> } = {}) {
  const config = getBangumiClientConfig()
  const query = options.query ? buildQueryString(options.query) : ""
  const normalizedPath = path.replace(/^https?:\/\/[^/]+\//i, "").replace(/^\/+/, "")
  const response = await fetch(`${config.webEndpoint}/${normalizedPath}${query}`, {
    method: "GET",
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Bangumi Beta Scripting Client",
    },
  })

  if (!response.ok) {
    throw new Error(`Bangumi web request failed: ${response.status} ${path}`)
  }

  return response.text()
}

function buildTopicDetailWebCandidates(topicId: number, type: "subject" | "group", topicUrl?: string) {
  const paths = type === "group"
    ? [`rakuen/topic/group/${topicId}`, `group/topic/${topicId}`]
    : [`rakuen/topic/subject/${topicId}`, `subject/topic/${topicId}`]
  const normalizedTopicPath = topicUrl?.replace(/^https?:\/\/[^/]+\//i, "").replace(/^\/+/, "")
  return [normalizedTopicPath, ...paths].filter((path, index, array): path is string => Boolean(path) && array.indexOf(path) === index)
}

function getRakuenModeRequest(mode: BangumiRakuenMode) {
  switch (mode) {
    case "subjectTrending":
      return { path: "p1/trending/subjects/topics", query: {} as Record<string, string>, webType: "subject", topicType: "subject" as const }
    case "subjectLatest":
      return { path: "p1/subjects/-/topics", query: {} as Record<string, string>, webType: "subject", topicType: "subject" as const }
    case "groupJoined":
      return { path: "p1/groups/-/topics", query: { mode: "joined" }, webType: "group", topicType: "group" as const }
    case "groupCreated":
      return { path: "p1/groups/-/topics", query: { mode: "created" }, webType: "group", topicType: "group" as const }
    case "groupReplied":
      return { path: "p1/groups/-/topics", query: { mode: "replied" }, webType: "group", topicType: "group" as const }
    case "groupAll":
    default:
      return { path: "p1/groups/-/topics", query: { mode: "all" }, webType: "group", topicType: "group" as const }
  }
}

function buildQueryString(query: Record<string, string>) {
  const params = Object.entries(query)
    .filter(([, value]) => value.length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  return params.length ? `?${params.join("&")}` : ""
}

async function postOAuthToken(body: Record<string, string>) {
  const config = getBangumiClientConfig()
  writeOAuthDebug({
    lastTokenRequest: serializeDebugValue({
      url: `https://${config.authDomain}/oauth/access_token`,
      body,
    }),
  })

  const response = await fetch(`https://${config.authDomain}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  writeOAuthDebug({
    lastTokenResponse: serializeDebugValue({
      status: response.status,
      ok: response.ok,
      text,
    }),
  })

  let parsed: any = null
  if (text.length) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!response.ok) {
    const message = `授权请求失败：${response.status}${text ? ` ${text}` : ""}`
    writeOAuthDebug({ lastError: message })
    throw new Error(message)
  }

  return parsed
}

async function requestPrivate(path: string, options: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: string; query?: Record<string, string> } = {}) {
  const auth = await ensureBangumiAuth()
  const config = getBangumiClientConfig()
  const query = options.query ? buildQueryString(options.query) : ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (auth?.accessToken) {
    headers.Authorization = `Bearer ${auth.accessToken}`
  }

  const response = await fetch(`${config.privateEndpoint}/${path}${query}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  })

  if (response.status === 401 && auth?.refreshToken) {
    const refreshed = await ensureBangumiAuth()
    if (refreshed?.accessToken && refreshed.accessToken !== auth.accessToken) {
      headers.Authorization = `Bearer ${refreshed.accessToken}`
      const retryResponse = await fetch(`${config.privateEndpoint}/${path}${query}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body,
      })
      if (!retryResponse.ok) {
        throw new Error(`Bangumi request failed: ${retryResponse.status} ${path}`)
      }
      return readResponseBody(retryResponse)
    }
  }

  if (!response.ok) {
    throw new Error(`Bangumi request failed: ${response.status} ${path}`)
  }

  return readResponseBody(response)
}

async function readResponseBody(response: { text: () => Promise<string>; json?: () => Promise<any> }) {
  const text = await response.text()
  if (!text.length) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function parseBangumiOAuthCallbackPayload(input: Record<string, any> | string | null | undefined): BangumiOAuthCallbackPayload | null {
  const params = normalizeCallbackInput(input)
  if (!params) {
    return null
  }

  const code = readFirstString(params, ["code"])
  const error = readFirstString(params, ["error"])
  const errorDescription = readFirstString(params, ["error_description", "errorDescription"])
  const marker = readFirstString(params, ["oauth_callback"])

  if (!marker && !code && !error) {
    return null
  }

  return {
    code,
    error,
    errorDescription,
  }
}

function normalizeCallbackInput(input: Record<string, any> | string | null | undefined) {
  if (!input) {
    return null
  }

  if (typeof input === "string") {
    const questionMarkIndex = input.indexOf("?")
    const rawQuery = questionMarkIndex >= 0 ? input.slice(questionMarkIndex + 1) : input
    return parseQueryString(rawQuery)
  }

  if (typeof input === "object") {
    return input
  }

  return null
}

function parseQueryString(rawQuery: string) {
  const result: Record<string, string> = {}
  const query = rawQuery.replace(/^\?/, "")
  if (!query.length) {
    return result
  }

  for (const part of query.split("&")) {
    if (!part.length) continue
    const separatorIndex = part.indexOf("=")
    const rawKey = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part
    const rawValue = separatorIndex >= 0 ? part.slice(separatorIndex + 1) : ""
    result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.replace(/\+/g, " "))
  }

  return result
}

function readFirstString(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "string" && value.length) {
      return value
    }
  }
  return ""
}

function writeOAuthDebug(next: Partial<BangumiOAuthDebugInfo>) {
  const current = getBangumiOAuthDebugInfo()
  Storage.set(STORAGE_KEYS.oauthDebug, JSON.stringify({
    ...current,
    ...next,
    updatedAt: Date.now(),
  }))
}

function serializeDebugValue(value: unknown) {
  if (value == null) {
    return ""
  }
  if (typeof value === "string") {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function normalizeTokenResponse(response: any): BangumiAuth | null {
  if (!response || typeof response !== "object") {
    return null
  }

  const accessToken = typeof response.access_token === "string" ? response.access_token : typeof response.accessToken === "string" ? response.accessToken : ""
  const refreshToken = typeof response.refresh_token === "string" ? response.refresh_token : typeof response.refreshToken === "string" ? response.refreshToken : ""
  const expiresIn = typeof response.expires_in === "number" ? response.expires_in : typeof response.expiresIn === "number" ? response.expiresIn : 0

  if (!accessToken) {
    return null
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + Math.max(0, expiresIn) * 1000,
  }
}

function readString(key: string, fallback: string) {
  const value = Storage.get(key)
  return typeof value === "string" && value.length ? value : fallback
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
