import { Path } from "scripting"
import { HanimeVideoItem } from "./hanime"
import { setting } from "./setting"

export type HanimeLibraryItem = HanimeVideoItem & {
  isFavorite: boolean
  playCount: number
  addedAt: number
  updatedAt: number
  lastWatchedAt?: number
}

export type HanimeStats = {
  favorites: number
  history: number
  downloads: number
}

export type HanimeDownloadedItem = HanimeVideoItem & {
  /** 同一作品内用于区分字幕版本与剧集的稳定下载键。 */
  downloadKey: string
  sourceUrl: string
  sourceLabel?: string
  sourceType?: string
  filePath: string
  fileSize: number
  downloadedAt: number
  updatedAt: number
  /** 文件暂时不可访问时仍保留下载记录，避免刷新列表误删完成记录。 */
  isFileAvailable?: boolean
}

export type HanimeDownloadInput = {
  video: HanimeVideoItem
  downloadKey: string
  sourceUrl: string
  sourceLabel?: string
  sourceType?: string
  filePath: string
  fileSize: number
}

class HanimeDatabase {
  private db: SQLite.Database | null = null

  async init(): Promise<void> {
    await FileManager.createDirectory(setting.getBasePath(), true)
    this.db = SQLite.open(Path.join(setting.getBasePath(), "hanime.db"))
    await this.createTables()
  }

  async saveVideo(video: HanimeVideoItem): Promise<void> {
    await this.ensureReady()
    const existing = await this.getVideo(video.videoCode)
    const now = Date.now()
    const values = [
      video.title,
      video.coverUrl || existing?.coverUrl || "",
      video.duration ?? existing?.duration ?? null,
      video.views ?? existing?.views ?? null,
      video.uploadTime ?? existing?.uploadTime ?? null,
      video.currentArtist ?? existing?.currentArtist ?? null,
      video.reviews ?? existing?.reviews ?? null,
    ]

    // 不能使用 INSERT OR REPLACE：REPLACE 会先删除 hanime_video 的父记录，
    // 进而触发 hanime_download 的 ON DELETE CASCADE，使本地下载在播放后消失。
    if (existing) {
      await this.db!.execute(
        `UPDATE hanime_video SET
          title = ?, cover_url = ?, duration = ?, views = ?, upload_time = ?, artist = ?, reviews = ?, updated_at = ?
         WHERE video_code = ?`,
        [...values, now, video.videoCode]
      )
      return
    }

    await this.db!.execute(
      `INSERT INTO hanime_video (
        video_code, title, cover_url, duration, views, upload_time, artist, reviews,
        is_favorite, play_count, last_watched_at, added_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)`,
      [video.videoCode, ...values, now, now]
    )
  }

  async addHistory(video: HanimeVideoItem): Promise<void> {
    await this.saveVideo(video)
    await this.ensureReady()
    const now = Date.now()
    await this.db!.execute(
      "UPDATE hanime_video SET play_count = play_count + 1, last_watched_at = ?, updated_at = ? WHERE video_code = ?",
      [now, now, video.videoCode]
    )
  }

  async toggleFavorite(video: HanimeVideoItem): Promise<boolean> {
    await this.saveVideo(video)
    await this.ensureReady()
    const existing = await this.getVideo(video.videoCode)
    const nextValue = existing?.isFavorite ? 0 : 1
    await this.db!.execute(
      "UPDATE hanime_video SET is_favorite = ?, updated_at = ? WHERE video_code = ?",
      [nextValue, Date.now(), video.videoCode]
    )
    return nextValue === 1
  }

  async setFavorite(video: HanimeVideoItem, favorite: boolean): Promise<void> {
    await this.saveVideo(video)
    await this.ensureReady()
    await this.db!.execute(
      "UPDATE hanime_video SET is_favorite = ?, updated_at = ? WHERE video_code = ?",
      [favorite ? 1 : 0, Date.now(), video.videoCode]
    )
  }

  async isFavorite(videoCode: string): Promise<boolean> {
    const video = await this.getVideo(videoCode)
    return video?.isFavorite === true
  }

  async saveDownload(input: HanimeDownloadInput): Promise<void> {
    await this.saveVideo(input.video)
    await this.ensureReady()
    const now = Date.now()
    const existing = await this.getDownload(input.video.videoCode, input.downloadKey)
    await this.db!.execute(
      `INSERT OR REPLACE INTO hanime_download (
        download_key, video_code, source_url, source_label, source_type, file_path, file_size, downloaded_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.downloadKey, input.video.videoCode, input.sourceUrl, input.sourceLabel ?? null, input.sourceType ?? null, input.filePath, input.fileSize, existing?.downloadedAt ?? now, now]
    )
  }

  async getDownload(videoCode: string, downloadKey: string): Promise<HanimeDownloadedItem | null> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>(
      `SELECT v.*, d.download_key, d.source_url, d.source_label, d.source_type, d.file_path, d.file_size, d.downloaded_at, d.updated_at AS download_updated_at
       FROM hanime_download d JOIN hanime_video v ON v.video_code = d.video_code
       WHERE d.video_code = ? AND d.download_key = ?`,
      [videoCode, downloadKey]
    )
    return rows.length > 0 ? this.rowToDownloadedItem(rows[0]) : null
  }

  async getDownloadsForVideo(videoCode: string): Promise<HanimeDownloadedItem[]> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>(
      `SELECT v.*, d.download_key, d.source_url, d.source_label, d.source_type, d.file_path, d.file_size, d.downloaded_at, d.updated_at AS download_updated_at
       FROM hanime_download d JOIN hanime_video v ON v.video_code = d.video_code
       WHERE d.video_code = ? ORDER BY d.downloaded_at DESC`, [videoCode]
    )
    return rows.map((row) => this.rowToDownloadedItem(row))
  }

  async getDownloads(): Promise<HanimeDownloadedItem[]> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>(
      `SELECT v.*, d.download_key, d.source_url, d.source_label, d.source_type, d.file_path, d.file_size, d.downloaded_at, d.updated_at AS download_updated_at
       FROM hanime_download d JOIN hanime_video v ON v.video_code = d.video_code ORDER BY d.downloaded_at DESC`
    )
    return rows.map((row) => this.rowToDownloadedItem(row))
  }

  async deleteDownload(videoCode: string, downloadKey: string): Promise<void> {
    await this.ensureReady()
    await this.db!.execute("DELETE FROM hanime_download WHERE video_code = ? AND download_key = ?", [videoCode, downloadKey])
  }

  async getVideo(videoCode: string): Promise<HanimeLibraryItem | null> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>("SELECT * FROM hanime_video WHERE video_code = ?", [videoCode])
    return rows.length > 0 ? this.rowToItem(rows[0]) : null
  }

  async getFavorites(): Promise<HanimeLibraryItem[]> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>(
      "SELECT * FROM hanime_video WHERE is_favorite = 1 ORDER BY updated_at DESC"
    )
    return rows.map((row) => this.rowToItem(row))
  }

  async getHistory(limit: number = 80): Promise<HanimeLibraryItem[]> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>(
      "SELECT * FROM hanime_video WHERE last_watched_at IS NOT NULL ORDER BY last_watched_at DESC LIMIT ?",
      [limit]
    )
    return rows.map((row) => this.rowToItem(row))
  }

  async getStats(): Promise<HanimeStats> {
    await this.ensureReady()
    const favoriteRows = await this.db!.fetchAll<any>("SELECT COUNT(*) AS count FROM hanime_video WHERE is_favorite = 1")
    const historyRows = await this.db!.fetchAll<any>("SELECT COUNT(*) AS count FROM hanime_video WHERE last_watched_at IS NOT NULL")
    const downloadRows = await this.db!.fetchAll<any>("SELECT COUNT(*) AS count FROM hanime_download")
    return {
      favorites: Number(favoriteRows[0]?.count || 0),
      history: Number(historyRows[0]?.count || 0),
      downloads: Number(downloadRows[0]?.count || 0),
    }
  }

  async deleteVideo(videoCode: string): Promise<void> {
    await this.ensureReady()
    await this.db!.execute("DELETE FROM hanime_video WHERE video_code = ?", [videoCode])
  }

  async clearHistory(): Promise<void> {
    await this.ensureReady()
    await this.db!.execute("UPDATE hanime_video SET play_count = 0, last_watched_at = NULL WHERE last_watched_at IS NOT NULL")
  }

  async addSearchHistory(keyword: string): Promise<void> {
    const normalized = keyword.trim()
    if (!normalized) return
    await this.ensureReady()
    await this.db!.execute(
      "INSERT OR REPLACE INTO hanime_search_history (keyword, searched_at) VALUES (?, ?)",
      [normalized, Date.now()]
    )
  }

  async getSearchHistory(limit: number = 12): Promise<string[]> {
    await this.ensureReady()
    const rows = await this.db!.fetchAll<any>(
      "SELECT keyword FROM hanime_search_history ORDER BY searched_at DESC LIMIT ?",
      [limit]
    )
    return rows.map((row) => String(row.keyword))
  }

  async clearSearchHistory(): Promise<void> {
    await this.ensureReady()
    await this.db!.execute("DELETE FROM hanime_search_history")
  }

  private async createTables(): Promise<void> {
    await this.ensureReady()
    await this.db!.execute(`
      CREATE TABLE IF NOT EXISTS hanime_video (
        video_code TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        cover_url TEXT,
        duration TEXT,
        views TEXT,
        upload_time TEXT,
        artist TEXT,
        reviews TEXT,
        is_favorite INTEGER DEFAULT 0,
        play_count INTEGER DEFAULT 0,
        last_watched_at INTEGER,
        added_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
    await this.db!.execute(`
      CREATE TABLE IF NOT EXISTS hanime_search_history (
        keyword TEXT PRIMARY KEY,
        searched_at INTEGER NOT NULL
      )
    `)
    const downloadColumns = await this.db!.fetchAll<any>("PRAGMA table_info(hanime_download)")
    if (downloadColumns.length > 0 && !downloadColumns.some((column) => column.name === "download_key")) {
      await this.db!.execute("ALTER TABLE hanime_download RENAME TO hanime_download_legacy")
    }
    await this.db!.execute(`
      CREATE TABLE IF NOT EXISTS hanime_download (
        download_key TEXT PRIMARY KEY,
        video_code TEXT NOT NULL,
        source_url TEXT NOT NULL,
        source_label TEXT,
        source_type TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        downloaded_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(video_code) REFERENCES hanime_video(video_code) ON DELETE CASCADE
      )
    `)
    const legacyColumns = await this.db!.fetchAll<any>("PRAGMA table_info(hanime_download_legacy)")
    if (legacyColumns.length > 0) {
      await this.db!.execute(`INSERT OR IGNORE INTO hanime_download (download_key, video_code, source_url, source_label, source_type, file_path, file_size, downloaded_at, updated_at)
        SELECT video_code || ':' || COALESCE(source_label, 'legacy'), video_code, source_url, source_label, source_type, file_path, file_size, downloaded_at, updated_at FROM hanime_download_legacy`)
      await this.db!.execute("DROP TABLE hanime_download_legacy")
    }
    await this.db!.execute("CREATE INDEX IF NOT EXISTS idx_hanime_video_favorite ON hanime_video(is_favorite)")
    await this.db!.execute("CREATE INDEX IF NOT EXISTS idx_hanime_video_history ON hanime_video(last_watched_at DESC)")
    await this.db!.execute("CREATE INDEX IF NOT EXISTS idx_hanime_search_time ON hanime_search_history(searched_at DESC)")
    await this.db!.execute("CREATE INDEX IF NOT EXISTS idx_hanime_download_time ON hanime_download(downloaded_at DESC)")
  }

  private async ensureReady(): Promise<void> {
    if (!this.db) throw new Error("Hanime database not initialized")
  }

  private rowToItem(row: any): HanimeLibraryItem {
    return {
      videoCode: String(row.video_code),
      title: String(row.title),
      coverUrl: String(row.cover_url || ""),
      duration: row.duration ?? undefined,
      views: row.views ?? undefined,
      uploadTime: row.upload_time ?? undefined,
      currentArtist: row.artist ?? undefined,
      reviews: row.reviews ?? undefined,
      itemType: "normal",
      isFavorite: Number(row.is_favorite || 0) === 1,
      playCount: Number(row.play_count || 0),
      lastWatchedAt: row.last_watched_at == null ? undefined : Number(row.last_watched_at),
      addedAt: Number(row.added_at || 0),
      updatedAt: Number(row.updated_at || 0),
    }
  }

  private rowToDownloadedItem(row: any): HanimeDownloadedItem {
    return {
      ...this.rowToItem(row),
      downloadKey: String(row.download_key || ""),
      sourceUrl: String(row.source_url || ""),
      sourceLabel: row.source_label ?? undefined,
      sourceType: row.source_type ?? undefined,
      filePath: String(row.file_path || ""),
      fileSize: Number(row.file_size || 0),
      downloadedAt: Number(row.downloaded_at || 0),
      updatedAt: Number(row.download_updated_at || row.updated_at || 0),
    }
  }
}

export const hanimeDatabase = new HanimeDatabase()
