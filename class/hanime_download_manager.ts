import { AbortController, AbortSignal, fetch, Path } from "scripting"
import { HANIME_BASE_URL, HanimeVideoItem, HanimeVideoSource } from "./hanime"
import { HanimeDownloadedItem, hanimeDatabase } from "./hanime_database"
import { setting } from "./setting"

const DOWNLOAD_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Mobile Safari/537.36"

type DownloadResult = {
  filePath: string
  fileSize: number
  sourceType?: string
}

export type HanimeDownloadExportResult = {
  filePath: string
  location: string
  isDirectory: boolean
}

export type HanimeDownloadTaskStatus = "downloading" | "paused" | "failed"

export type HanimeDownloadTask = {
  downloadKey: string
  video: HanimeVideoItem
  source: HanimeVideoSource
  sourceLabel?: string
  status: HanimeDownloadTaskStatus
  progress: number | null
  completedUnits: number
  totalUnits: number
  error?: string
  updatedAt: number
}

type DownloadContext = {
  signal: AbortSignal
  report: (completedUnits: number, totalUnits: number, progress?: number | null) => void
}

class HanimeDownloadManager {
  private tasks = new Map<string, HanimeDownloadTask>()
  private controllers = new Map<string, AbortController>()
  private listeners = new Set<() => void>()
  private get downloadDir(): string {
    return Path.join(setting.getBasePath(), "downloads")
  }

  async init(): Promise<void> {
    await FileManager.createDirectory(this.downloadDir, true)
  }

  getTasks(): HanimeDownloadTask[] {
    return Array.from(this.tasks.values()).sort((left, right) => right.updatedAt - left.updatedAt)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  pause(downloadKey: string): void {
    const controller = this.controllers.get(downloadKey)
    if (!controller) return
    controller.abort()
    this.controllers.delete(downloadKey)
    this.updateTask(downloadKey, { status: "paused", error: undefined })
  }

  dismissTask(downloadKey: string): void {
    if (this.controllers.has(downloadKey)) return
    this.tasks.delete(downloadKey)
    this.emit()
  }

  async retry(downloadKey: string): Promise<HanimeDownloadedItem> {
    const task = this.tasks.get(downloadKey)
    if (!task) throw new Error("下载任务不存在")
    return await this.download(task.video, task.source)
  }

  async download(video: HanimeVideoItem, source: HanimeVideoSource): Promise<HanimeDownloadedItem> {
    if (!isDownloadableVideoSource(source)) {
      throw new Error("该播放源无法识别，暂不支持离线下载。")
    }
    const downloadKey = getDownloadKey(video.videoCode, source)
    if (this.controllers.has(downloadKey)) {
      throw new Error("该字幕剧集正在下载，请到「下载」标签查看进度。")
    }

    const controller = new AbortController()
    this.controllers.set(downloadKey, controller)
    this.tasks.set(downloadKey, {
      downloadKey,
      video,
      source,
      sourceLabel: source.label,
      status: "downloading",
      progress: null,
      completedUnits: 0,
      totalUnits: 0,
      updatedAt: Date.now(),
    })
    this.emit()

    const context: DownloadContext = {
      signal: controller.signal,
      report: (completedUnits, totalUnits, progress = totalUnits > 0 ? completedUnits / totalUnits : null) => {
        this.updateTask(downloadKey, { completedUnits, totalUnits, progress, status: "downloading", error: undefined })
      },
    }

    try {
      await this.init()
      const existing = await hanimeDatabase.getDownload(video.videoCode, downloadKey)
      const result = isHlsSource(source)
        ? await this.downloadHls(downloadKey, source, context)
        : await this.downloadDirect(downloadKey, source, context)

      await hanimeDatabase.saveDownload({
        video,
        downloadKey,
        sourceUrl: source.url,
        sourceLabel: source.label,
        sourceType: result.sourceType || source.type,
        filePath: result.filePath,
        fileSize: result.fileSize,
      })

      if (existing && existing.filePath !== result.filePath) {
        await this.removeStoredPath(existing.filePath)
      }

      const item = await hanimeDatabase.getDownload(video.videoCode, downloadKey)
      if (!item) throw new Error("下载记录保存失败")
      this.tasks.delete(downloadKey)
      this.emit()
      return item
    } catch (error) {
      const paused = controller.signal.aborted
      this.updateTask(downloadKey, {
        status: paused ? "paused" : "failed",
        error: paused ? undefined : `${error}`,
      })
      throw error
    } finally {
      this.controllers.delete(downloadKey)
    }
  }

  async getDownload(videoCode: string, source: HanimeVideoSource): Promise<HanimeDownloadedItem | null> {
    const item = await hanimeDatabase.getDownload(videoCode, getDownloadKey(videoCode, source))
    if (!item) return null
    return { ...item, isFileAvailable: await this.existsStoredPath(item.filePath) }
  }

  async getDownloadsForVideo(videoCode: string): Promise<HanimeDownloadedItem[]> {
    const items = await hanimeDatabase.getDownloadsForVideo(videoCode)
    return await Promise.all(items.map(async (item) => ({ ...item, isFileAvailable: await this.existsStoredPath(item.filePath) })))
  }

  async getDownloads(): Promise<HanimeDownloadedItem[]> {
    await this.init()
    const items = await hanimeDatabase.getDownloads()
    // 文件系统（尤其是 iCloud）可能暂时不可访问。刷新列表绝不能据此删除已完成记录。
    return await Promise.all(items.map(async (item) => ({
      ...item,
      isFileAvailable: await this.existsStoredPath(item.filePath),
    })))
  }

  async deleteDownload(item: HanimeDownloadedItem): Promise<void> {
    await this.removeStoredPath(item.filePath)
    await hanimeDatabase.deleteDownload(item.videoCode, item.downloadKey)
  }

  async exportToFilesApp(item: HanimeDownloadedItem): Promise<HanimeDownloadExportResult> {
    const sourcePath = item.filePath.endsWith("index.m3u8") ? Path.dirname(item.filePath) : item.filePath
    if (!(await FileManager.exists(sourcePath))) {
      throw new Error("本地下载文件当前不可访问。下载记录已保留，请确认存储空间或 iCloud 文件可用后再试。")
    }

    const exportDir = Path.join(FileManager.documentsDirectory, "GiriGiri", "Downloads")
    await FileManager.createDirectory(exportDir, true)

    const exportName = exportNameForDownload(item, sourcePath)
    const targetPath = await this.uniqueExportPath(exportDir, exportName)
    await this.copyStoredPath(sourcePath, targetPath)

    return {
      filePath: targetPath,
      location: "文件 App > Scripting > GiriGiri > Downloads",
      isDirectory: await FileManager.isDirectory(targetPath),
    }
  }

  private async downloadDirect(videoCode: string, source: HanimeVideoSource, context: DownloadContext): Promise<DownloadResult> {
    const filePath = this.getDirectFilePath(videoCode, source)
    const tempPath = `${filePath}.tmp`
    if (await FileManager.exists(tempPath)) await FileManager.remove(tempPath)
    const response = await fetch(source.url, { headers: downloadHeaders("video/*,*/*;q=0.8"), signal: context.signal })
    if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)

    const totalSize = Number(response.headers.get("content-length") || 0)
    context.report(0, totalSize, null)
    try {
      const data = await response.data()
      context.report(data.size || totalSize, totalSize || data.size || 1, 1)
      await FileManager.writeAsData(tempPath, data)
      if (await FileManager.exists(filePath)) await FileManager.remove(filePath)
      await FileManager.rename(tempPath, filePath)
      const stat = await FileManager.stat(filePath)
      return { filePath, fileSize: stat.size || data.size || 0, sourceType: source.type || "video/mp4" }
    } catch (error) {
      if (await FileManager.exists(tempPath)) await FileManager.remove(tempPath)
      throw error
    }
  }

  private async downloadHls(videoCode: string, source: HanimeVideoSource, context: DownloadContext): Promise<DownloadResult> {
    const safeCode = safeFileName(videoCode)
    const hlsDir = Path.join(this.downloadDir, safeCode)
    const tempDir = Path.join(this.downloadDir, `${safeCode}.tmp`)
    if (await FileManager.exists(tempDir)) await FileManager.remove(tempDir)
    await FileManager.createDirectory(tempDir, true)

    try {
      const mediaPlaylistUrl = await resolveMediaPlaylistUrl(source.url, context.signal)
      const playlistText = await fetchText(mediaPlaylistUrl, context.signal)
      if (hasUnsupportedHlsKey(playlistText)) {
        throw new Error("该 HLS 使用了暂不支持的加密方式，无法离线保存。")
      }

      const segmentsDir = Path.join(tempDir, "segments")
      const keysDir = Path.join(tempDir, "keys")
      await FileManager.createDirectory(segmentsDir, true)
      await FileManager.createDirectory(keysDir, true)

      let fileSize = 0
      let segmentIndex = 0
      let keyIndex = 0
      const lines = playlistText.split(/\r?\n/)
      const rewritten: string[] = []
      const keyMap = new Map<string, string>()
      const totalUnits = lines.filter((line) => {
        const trimmed = line.trim()
        return trimmed.startsWith("#EXT-X-MAP") || (!!trimmed && !trimmed.startsWith("#"))
      }).length
      let completedUnits = 0
      context.report(completedUnits, totalUnits)

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) {
          rewritten.push(line)
          continue
        }

        if (trimmed.startsWith("#EXT-X-KEY")) {
          const uri = parseAttribute(trimmed, "URI")
          if (uri) {
            const keyUrl = resolveUrl(uri, mediaPlaylistUrl)
            let keyFileName = keyMap.get(keyUrl)
            if (!keyFileName) {
              keyFileName = `key_${keyIndex}${extensionFromUrl(keyUrl, "key")}`
              keyIndex += 1
              const keyData = await fetchData(keyUrl, context.signal)
              const keyPath = Path.join(keysDir, keyFileName)
              await FileManager.writeAsData(keyPath, keyData)
              fileSize += (await FileManager.stat(keyPath)).size || keyData.size || 0
              keyMap.set(keyUrl, keyFileName)
              completedUnits += 1
              context.report(completedUnits, totalUnits)
            }
            rewritten.push(rewriteAttribute(line, "URI", `keys/${keyFileName}`))
          } else {
            rewritten.push(line)
          }
          continue
        }

        if (trimmed.startsWith("#EXT-X-MAP")) {
          const uri = parseAttribute(trimmed, "URI")
          if (uri) {
            const mapUrl = resolveUrl(uri, mediaPlaylistUrl)
            const mapFileName = `init_${segmentIndex}${extensionFromUrl(mapUrl, "mp4")}`
            const mapData = await fetchData(mapUrl, context.signal)
            const mapPath = Path.join(segmentsDir, mapFileName)
            await FileManager.writeAsData(mapPath, mapData)
            fileSize += (await FileManager.stat(mapPath)).size || mapData.size || 0
            completedUnits += 1
            context.report(completedUnits, totalUnits)
            rewritten.push(rewriteAttribute(line, "URI", `segments/${mapFileName}`))
          } else {
            rewritten.push(line)
          }
          continue
        }

        if (trimmed.startsWith("#")) {
          rewritten.push(line)
          continue
        }

        const segmentUrl = resolveUrl(trimmed, mediaPlaylistUrl)
        const segmentFileName = `seg_${segmentIndex.toString().padStart(5, "0")}${extensionFromUrl(segmentUrl, "ts")}`
        segmentIndex += 1
        const segmentData = await fetchData(segmentUrl, context.signal)
        const segmentPath = Path.join(segmentsDir, segmentFileName)
        await FileManager.writeAsData(segmentPath, segmentData)
        fileSize += (await FileManager.stat(segmentPath)).size || segmentData.size || 0
        completedUnits += 1
        context.report(completedUnits, totalUnits)
        rewritten.push(`segments/${segmentFileName}`)
      }

      if (segmentIndex === 0) throw new Error("未找到可下载的视频分片。")

      const playlistPath = Path.join(tempDir, "index.m3u8")
      await FileManager.writeAsString(playlistPath, rewritten.join("\n"))
      if (await FileManager.exists(hlsDir)) await FileManager.remove(hlsDir)
      await FileManager.rename(tempDir, hlsDir)

      const mp4Path = Path.join(this.downloadDir, `${safeCode}.mp4`)
      const exportedPath = Path.join(this.downloadDir, `${safeCode}.exporting.mp4`)
      if (await FileManager.exists(exportedPath)) await FileManager.remove(exportedPath)

      try {
        // 优先用 ffmpeg 对重写后的本地播放列表做 stream copy。
        // 与糖心脚本的实现一致：ffmpeg 能正确处理 TS/fMP4 分片及 AES-128 本地 key，
        // 而 AVAssetExportSession 对部分本地 HLS 的可导出性判断会过早失败。
        context.report(totalUnits, totalUnits, 0)
        await remuxLocalHlsToMp4(Path.join(hlsDir, "index.m3u8"), exportedPath)

        if (await FileManager.exists(mp4Path)) await FileManager.remove(mp4Path)
        await FileManager.rename(exportedPath, mp4Path)
        const mp4Size = (await FileManager.stat(mp4Path)).size || 0
        await FileManager.remove(hlsDir)
        context.report(totalUnits, totalUnits, 1)
        return { filePath: mp4Path, fileSize: mp4Size, sourceType: "video/mp4" }
      } catch (exportError) {
        // Shell/ffmpeg 不可用或遇到少数不兼容播放列表时，再尝试系统导出器。
        // 两种封装方式均失败才保留完整 HLS 离线播放包。
        if (await FileManager.exists(exportedPath)) await FileManager.remove(exportedPath)
        try {
          context.report(totalUnits, totalUnits, 0)
          await exportLocalHlsWithAvFoundation(Path.join(hlsDir, "index.m3u8"), exportedPath, (progress) => {
            context.report(totalUnits, totalUnits, Math.min(1, Math.max(0, progress)))
          })
          if (await FileManager.exists(mp4Path)) await FileManager.remove(mp4Path)
          await FileManager.rename(exportedPath, mp4Path)
          const mp4Size = (await FileManager.stat(mp4Path)).size || 0
          await FileManager.remove(hlsDir)
          return { filePath: mp4Path, fileSize: mp4Size, sourceType: "video/mp4" }
        } catch (_) {
          if (await FileManager.exists(exportedPath)) await FileManager.remove(exportedPath)
          return {
            filePath: Path.join(hlsDir, "index.m3u8"),
            fileSize,
            sourceType: "application/vnd.apple.mpegurl",
          }
        }
      }
    } catch (error) {
      if (await FileManager.exists(tempDir)) await FileManager.remove(tempDir)
      throw error
    }
  }

  private getDirectFilePath(downloadKey: string, source: HanimeVideoSource): string {
    return Path.join(this.downloadDir, `${safeFileName(downloadKey)}.${sourceExtension(source)}`)
  }

  private async existsStoredPath(filePath: string): Promise<boolean> {
    const targetPath = filePath.endsWith("index.m3u8") ? Path.dirname(filePath) : filePath
    return await FileManager.exists(targetPath)
  }

  private async removeStoredPath(filePath: string): Promise<void> {
    const targetPath = filePath.endsWith("index.m3u8") ? Path.dirname(filePath) : filePath
    if (await FileManager.exists(targetPath)) {
      await FileManager.remove(targetPath)
    }
  }

  private async copyStoredPath(sourcePath: string, targetPath: string): Promise<void> {
    if (await FileManager.isDirectory(sourcePath)) {
      await this.copyDirectory(sourcePath, targetPath)
    } else {
      await FileManager.copyFile(sourcePath, targetPath)
    }
  }

  private async copyDirectory(sourcePath: string, targetPath: string): Promise<void> {
    await FileManager.createDirectory(targetPath, true)
    const items = await FileManager.readDirectory(sourcePath)
    for (const item of items) {
      const childSourcePath = Path.join(sourcePath, item)
      const childTargetPath = Path.join(targetPath, item)
      await this.copyStoredPath(childSourcePath, childTargetPath)
    }
  }

  private updateTask(videoCode: string, patch: Partial<HanimeDownloadTask>): void {
    const current = this.tasks.get(videoCode)
    if (!current) return
    this.tasks.set(videoCode, { ...current, ...patch, updatedAt: Date.now() })
    this.emit()
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }

  private async uniqueExportPath(directory: string, fileName: string): Promise<string> {
    const extension = Path.extname(fileName)
    const name = Path.basename(fileName, extension)
    let index = 2
    let targetPath = Path.join(directory, fileName)

    while (await FileManager.exists(targetPath)) {
      targetPath = Path.join(directory, `${name}-${index}${extension}`)
      index += 1
    }

    return targetPath
  }
}

function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`
}

async function runShell(command: string): Promise<void> {
  // Shell 尚未进入公开类型声明；兼容糖心脚本已适配的不同 TestFlight 接口名称。
  const shell = (globalThis as any).Shell
  if (!shell) throw new Error("当前 Scripting 版本不支持 Shell/ffmpeg。")

  let result: any
  if (typeof shell.run === "function") result = await shell.run(command, { timeout: 7200 })
  else if (typeof shell.exec === "function") result = await shell.exec(command)
  else if (typeof shell.execute === "function") result = await shell.execute(command)
  else if (typeof shell.runCommand === "function") result = await shell.runCommand(command)
  else throw new Error("当前 Scripting 的 Shell 接口不可用。")

  if (typeof result?.exitCode === "number" && result.exitCode !== 0) {
    throw new Error(result.output || `ffmpeg 退出码 ${result.exitCode}`)
  }
}

async function remuxLocalHlsToMp4(playlistPath: string, outputPath: string): Promise<void> {
  const command = [
    "ffmpeg",
    "-nostdin",
    "-y",
    "-hide_banner",
    "-loglevel error",
    "-allowed_extensions ALL",
    "-i", shellQuote(playlistPath),
    "-c copy",
    "-bsf:a aac_adtstoasc",
    "-movflags +faststart",
    shellQuote(outputPath),
  ].join(" ")
  await runShell(command)
}

async function exportLocalHlsWithAvFoundation(
  playlistPath: string,
  outputPath: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  const asset = new AVAsset(playlistPath)
  try {
    if (await asset.loadHasProtectedContent()) {
      throw new Error("该 HLS 含受保护内容，无法导出为 MP4。")
    }
    if (!(await asset.loadIsExportable())) {
      throw new Error("该 HLS 无法由 iOS 导出为 MP4。")
    }

    const exporter = new AVAssetExportSession(asset, "HighestQuality")
    exporter.outputFileType = "mp4"
    exporter.shouldOptimizeForNetworkUse = true
    exporter.onProgress = onProgress
    try {
      await exporter.exportTo(outputPath)
    } finally {
      exporter.dispose()
    }
  } finally {
    asset.dispose()
  }
}

export const hanimeDownloadManager = new HanimeDownloadManager()

export function getDownloadKey(videoCode: string, source: HanimeVideoSource): string {
  const label = source.label.trim().replace(/\s+/g, " ") || source.url.split("?")[0]
  return `${videoCode}:${label}`
}

export function selectBestDownloadableSource(sources: HanimeVideoSource[]): HanimeVideoSource | null {
  const candidates = sources.filter(isDownloadableVideoSource)
  if (candidates.length === 0) return null
  return candidates.sort((left, right) => sourceScore(right) - sourceScore(left))[0]
}

export function isDownloadableVideoSource(source: HanimeVideoSource): boolean {
  const url = source.url.toLowerCase().split("?")[0]
  const type = (source.type || "").toLowerCase()
  if (!source.url) return false
  if (isHlsSource(source)) return true
  return /\.(mp4|m4v|mov|webm)$/.test(url) || type.startsWith("video/")
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return "未知大小"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function isHlsSource(source: HanimeVideoSource): boolean {
  const url = source.url.toLowerCase().split("?")[0]
  const type = (source.type || "").toLowerCase()
  return url.endsWith(".m3u8") || type.includes("mpegurl") || type.includes("hls")
}

function downloadHeaders(accept: string): Record<string, string> {
  return {
    "User-Agent": DOWNLOAD_USER_AGENT,
    "Accept": accept,
    "Referer": HANIME_BASE_URL,
  }
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { headers: downloadHeaders("application/vnd.apple.mpegurl,text/plain,*/*;q=0.8"), signal })
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)
  return await response.text()
}

async function fetchData(url: string, signal?: AbortSignal): Promise<Data> {
  const response = await fetch(url, { headers: downloadHeaders("*/*"), signal })
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`)
  return await response.data()
}

async function resolveMediaPlaylistUrl(url: string, signal?: AbortSignal): Promise<string> {
  const playlist = await fetchText(url, signal)
  if (!playlist.includes("#EXT-X-STREAM-INF")) return url

  const lines = playlist.split(/\r?\n/)
  let pendingScore = 0
  let bestUrl = ""
  let bestScore = -1

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      pendingScore = streamScore(trimmed)
      continue
    }
    if (pendingScore > 0 && trimmed && !trimmed.startsWith("#")) {
      if (pendingScore > bestScore) {
        bestScore = pendingScore
        bestUrl = resolveUrl(trimmed, url)
      }
      pendingScore = 0
    }
  }

  return bestUrl || url
}

function streamScore(line: string): number {
  const resolution = parseAttribute(line, "RESOLUTION")
  const height = Number(resolution?.split("x")[1] || 0)
  const bandwidth = Number(parseAttribute(line, "BANDWIDTH") || 0)
  return Math.max(1, height * 100000000 + bandwidth)
}

function sourceExtension(source: HanimeVideoSource): string {
  const path = source.url.split("?")[0]
  const extension = Path.extname(path).replace(/^\./, "").toLowerCase()
  if (extension && extension.length <= 5 && extension !== "m3u8") return extension
  if ((source.type || "").toLowerCase().includes("webm")) return "webm"
  if ((source.type || "").toLowerCase().includes("quicktime")) return "mov"
  return "mp4"
}

function sourceScore(source: HanimeVideoSource): number {
  const labelScore = Number(source.label.match(/\d+/)?.[0] || 0)
  const hlsScore = isHlsSource(source) ? 5 : 0
  const typeScore = (source.type || "").includes("mp4") || source.url.toLowerCase().includes(".mp4") ? 10 : 0
  return labelScore + typeScore + hlsScore
}

function hasUnsupportedHlsKey(playlistText: string): boolean {
  return playlistText
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("#EXT-X-KEY"))
    .some((line) => {
      const method = (parseAttribute(line, "METHOD") || "NONE").toUpperCase()
      return method !== "NONE" && method !== "AES-128"
    })
}

function parseAttribute(line: string, name: string): string | null {
  const match = new RegExp(`${name}=(("[^"]+")|([^,]+))`, "i").exec(line)
  if (!match) return null
  return (match[2] || match[3] || "").replace(/^"|"$/g, "")
}

function rewriteAttribute(line: string, name: string, value: string): string {
  return line.replace(new RegExp(`${name}=(("[^"]+")|([^,]+))`, "i"), `${name}="${value}"`)
}

function resolveUrl(value: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(value)) return value
  const base = new URL(baseUrl)
  if (value.startsWith("//")) return `${base.protocol}${value}`
  if (value.startsWith("/")) return `${base.protocol}//${base.host}${value}`
  const path = base.pathname.split("/").slice(0, -1).concat(value).join("/")
  return `${base.protocol}//${base.host}${Path.normalize(path)}`
}

function extensionFromUrl(url: string, fallback: string): string {
  const extension = Path.extname(url.split("?")[0]).toLowerCase()
  return extension && extension.length <= 6 ? extension : `.${fallback}`
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_") || `${Date.now()}`
}

function exportNameForDownload(item: HanimeDownloadedItem, sourcePath: string): string {
  const title = safeExportFileName(item.title || item.videoCode, item.videoCode)
  if (item.filePath.endsWith("index.m3u8")) return `${title}-HLS`

  const extension = Path.extname(sourcePath) || extensionFromSourceType(item.sourceType)
  return `${title}${extension}`
}

function extensionFromSourceType(sourceType?: string): string {
  const type = (sourceType || "").toLowerCase()
  if (type.includes("webm")) return ".webm"
  if (type.includes("quicktime") || type.includes("mov")) return ".mov"
  if (type.includes("mpegurl") || type.includes("hls")) return ".m3u8"
  return ".mp4"
}

function safeExportFileName(value: string, fallback: string): string {
  const sanitized = value
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")

  return sanitized.slice(0, 80) || safeFileName(fallback)
}
