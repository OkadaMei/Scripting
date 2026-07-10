import { fileManager } from "./file_manager"
import { setting } from "./setting"

export type Music = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  cover_url?: string
  audio_url?: string
  is_downloaded: boolean
  file_size?: number
  added_at: number
    play_count: number
  last_played_at?: number
  is_favorite: boolean
}

export type Playlist = {
  id: string
  name: string
  cover?: string
  created_at: number
  updated_at: number
  music_count: number
}

export type PlaylistMusic = {
  playlist_id: string
  music_id: string
  added_at: number
  position: number
}

export type SearchHistory = {
  id: string
  keyword: string
  searched_at: number
}

export type DownloadTask = {
  id: string
  music_id: string
  session_id?: string
  status: "pending" | "downloading" | "paused" | "cancelled" | "completed" | "failed"
  progress: number
  error?: string
  created_at: number
  updated_at: number
}

class Database {
  private db: SQLite.Database | null = null
  private dbPath: string = ""

  async init(): Promise<void> {
        await fileManager.init()
        const basePath = setting.getBasePath()
        this.dbPath = basePath + "/music.db"
        this.db = SQLite.open(this.dbPath)
        await this.createTables()
      }

  private async migrateDatabase(): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")
      
      try {
        const tables = await this.db.fetchAll<any>("SELECT name FROM sqlite_master WHERE type='table'")
        const tableNames = tables.map(t => t.name)
        
        if (tableNames.includes("download_task")) {
          const columns = await this.db.fetchAll<any>("PRAGMA table_info(download_task)")
          const columnNames = columns.map(c => c.name)
          
          if (!columnNames.includes("session_id")) {
            await this.db.execute("ALTER TABLE download_task ADD COLUMN session_id TEXT")
          }
        }
      } catch (error) {
        console.log("Migration check:", error)
      }
    }

    private async createTables(): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")

      // 检查并添加缺失的列
      await this.migrateDatabase()

      // 音乐表
      await this.db.execute(`
        CREATE TABLE IF NOT EXISTS music (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        album TEXT NOT NULL,
        duration INTEGER NOT NULL,
        cover_url TEXT,
        audio_url TEXT,
        is_downloaded INTEGER DEFAULT 0,
        file_size INTEGER,
        added_at INTEGER NOT NULL,
        play_count INTEGER DEFAULT 0,
        last_played_at INTEGER,
        is_favorite INTEGER DEFAULT 0
      )
    `)

    // 播放列表表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS playlist (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cover TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        music_count INTEGER DEFAULT 0
      )
    `)

    // 播放列表-音乐关联表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS playlist_music (
        playlist_id TEXT NOT NULL,
        music_id TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (playlist_id, music_id)
      )
    `)

    // 搜索历史表
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS search_history (
        id TEXT PRIMARY KEY,
        keyword TEXT NOT NULL,
        searched_at INTEGER NOT NULL
      )
    `)

    // 下载任务表
        await this.db.execute(`
          CREATE TABLE IF NOT EXISTS download_task (
            id TEXT PRIMARY KEY,
            music_id TEXT NOT NULL,
            session_id TEXT,
            status TEXT NOT NULL,
            progress REAL DEFAULT 0,
            error TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          )
        `)

    // 创建索引
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_music_artist ON music(artist)")
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_music_album ON music(album)")
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_music_downloaded ON music(is_downloaded)")
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_playlist_music_playlist ON playlist_music(playlist_id)")
    await this.db.execute("CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(searched_at DESC)")
  }

  // Music CRUD
  async addMusic(music: Omit<Music, "play_count" | "is_favorite">): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")
      await this.db.execute(
        `INSERT OR REPLACE INTO music (id, title, artist, album, duration, cover_url, audio_url, is_downloaded, file_size, added_at, last_played_at, play_count, is_favorite)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
        [music.id, music.title, music.artist, music.album, music.duration, music.cover_url ?? null, music.audio_url ?? null, music.is_downloaded ? 1 : 0, music.file_size ?? null, music.added_at, music.last_played_at ?? null]
      )
    }

  async getMusic(id: string): Promise<Music | null> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM music WHERE id = ?", [id])
      return rows.length > 0 ? this.rowToMusic(rows[0]) : null
    }

  async getAllMusic(): Promise<Music[]> {
        if (!this.db) throw new Error("Database not initialized")
        const rows = await this.db.fetchAll<any>("SELECT * FROM music ORDER BY added_at DESC")
        return rows.map(row => this.rowToMusic(row))
      }

    async getDownloadedMusic(): Promise<Music[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM music WHERE is_downloaded = 1 ORDER BY added_at DESC")
      return rows.map(row => this.rowToMusic(row))
    }

    async getFavoriteMusic(): Promise<Music[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM music WHERE is_favorite = 1 ORDER BY added_at DESC")
      return rows.map(row => this.rowToMusic(row))
    }

    async getRecentlyPlayed(limit: number = 20): Promise<Music[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM music WHERE last_played_at IS NOT NULL ORDER BY last_played_at DESC LIMIT ?", [limit])
      return rows.map(row => this.rowToMusic(row))
    }

    async getMusicByArtist(): Promise<{ artist: string, count: number, musics: Music[] }[]> {
          if (!this.db) throw new Error("Database not initialized")
          const allMusic = await this.db.fetchAll<any>("SELECT * FROM music ORDER BY artist, added_at DESC")
          const grouped = new Map<string, Music[]>()
          
          for (const row of allMusic) {
            const music = this.rowToMusic(row)
            if (!grouped.has(music.artist)) {
              grouped.set(music.artist, [])
            }
            grouped.get(music.artist)!.push(music)
          }
          
          return Array.from(grouped.entries())
            .map(([artist, musics]) => ({
              artist,
              count: musics.length,
              musics
            }))
            .sort((a, b) => b.count - a.count)
        }

    async getMusicByAlbum(): Promise<{ album: string, artist: string, count: number, musics: Music[] }[]> {
          if (!this.db) throw new Error("Database not initialized")
          const allMusic = await this.db.fetchAll<any>("SELECT * FROM music ORDER BY album, artist, added_at DESC")
          const grouped = new Map<string, Music[]>()
          
          for (const row of allMusic) {
            const music = this.rowToMusic(row)
            const key = `${music.album}|${music.artist}`
            if (!grouped.has(key)) {
              grouped.set(key, [])
            }
            grouped.get(key)!.push(music)
          }
          
          return Array.from(grouped.entries())
            .map(([key, musics]) => {
              const [album, artist] = key.split('|')
              return {
                album,
                artist,
                count: musics.length,
                musics
              }
            })
            .sort((a, b) => b.count - a.count)
        }

  async updateMusicDownloadStatus(id: string, isDownloaded: boolean, fileSize?: number): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")
      await this.db.execute(
        "UPDATE music SET is_downloaded = ?, file_size = ? WHERE id = ?",
        [isDownloaded ? 1 : 0, fileSize ?? null, id]
      )
    }

  async updateMusicPlayCount(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    const now = Date.now()
    await this.db.execute(
      "UPDATE music SET play_count = play_count + 1, last_played_at = ? WHERE id = ?",
      [now, id]
    )
  }

  async toggleFavorite(id: string): Promise<boolean> {
    if (!this.db) throw new Error("Database not initialized")
    const music = await this.getMusic(id)
    if (!music) return false
    const newValue = !music.is_favorite
    await this.db.execute("UPDATE music SET is_favorite = ? WHERE id = ?", [newValue ? 1 : 0, id])
    return newValue
  }

  async deleteMusic(id: string): Promise<void> {
        if (!this.db) throw new Error("Database not initialized")
        
        const music = await this.getMusic(id)
        if (music?.is_downloaded) {
          await fileManager.deleteAudio(id)
          await fileManager.deleteCover(id)
        }
        
        await this.db.execute("DELETE FROM music WHERE id = ?", [id])
        await this.db.execute("DELETE FROM playlist_music WHERE music_id = ?", [id])
      }

  // Playlist CRUD
  async createPlaylist(name: string, cover?: string): Promise<string> {
      if (!this.db) throw new Error("Database not initialized")
      const id = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const now = Date.now()
      await this.db.execute(
        "INSERT INTO playlist (id, name, cover, created_at, updated_at, music_count) VALUES (?, ?, ?, ?, ?, 0)",
        [id, name, cover ?? null, now, now]
      )
      return id
    }

  async getPlaylist(id: string): Promise<Playlist | null> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM playlist WHERE id = ?", [id])
      return rows.length > 0 ? this.rowToPlaylist(rows[0]) : null
    }

  async getAllPlaylists(): Promise<Playlist[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM playlist ORDER BY created_at DESC")
      return rows.map(row => this.rowToPlaylist(row))
    }

  async addMusicToPlaylist(playlistId: string, musicId: string): Promise<void> {
        if (!this.db) throw new Error("Database not initialized")
        const existing = await this.db.fetchAll<any>(
          "SELECT 1 FROM playlist_music WHERE playlist_id = ? AND music_id = ?",
          [playlistId, musicId]
        )
        if (existing.length > 0) return
        const now = Date.now()
        const rows = await this.db.fetchAll<any>(
          "SELECT MAX(position) as max_pos FROM playlist_music WHERE playlist_id = ?",
          [playlistId]
        )
        const position = (rows[0]?.max_pos ?? -1) + 1
        await this.db.execute(
          "INSERT INTO playlist_music (playlist_id, music_id, added_at, position) VALUES (?, ?, ?, ?)",
          [playlistId, musicId, now, position]
        )
        await this.db.execute(
          "UPDATE playlist SET music_count = music_count + 1, updated_at = ? WHERE id = ?",
          [now, playlistId]
        )
      }

  async removeMusicFromPlaylist(playlistId: string, musicId: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    await this.db.execute(
      "DELETE FROM playlist_music WHERE playlist_id = ? AND music_id = ?",
      [playlistId, musicId]
    )
    await this.db.execute(
      "UPDATE playlist SET music_count = music_count - 1, updated_at = ? WHERE id = ?",
      [Date.now(), playlistId]
    )
  }

  async getPlaylistMusic(playlistId: string): Promise<Music[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>(
        `SELECT m.* FROM music m
         INNER JOIN playlist_music pm ON m.id = pm.music_id
         WHERE pm.playlist_id = ?
         ORDER BY pm.position`,
        [playlistId]
      )
      return rows.map(row => this.rowToMusic(row))
    }

  async deletePlaylist(id: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    await this.db.execute("DELETE FROM playlist WHERE id = ?", [id])
    await this.db.execute("DELETE FROM playlist_music WHERE playlist_id = ?", [id])
  }

  // Search History
  async addSearchHistory(keyword: string): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    const id = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await this.db.execute(
      "INSERT INTO search_history (id, keyword, searched_at) VALUES (?, ?, ?)",
      [id, keyword, Date.now()]
    )
  }

  async getSearchHistory(limit: number = 20): Promise<SearchHistory[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>(
        "SELECT * FROM search_history ORDER BY searched_at DESC LIMIT ?",
        [limit]
      )
      return rows.map(row => this.rowToSearchHistory(row))
    }

  async clearSearchHistory(): Promise<void> {
    if (!this.db) throw new Error("Database not initialized")
    await this.db.execute("DELETE FROM search_history")
  }

  // Download Task
  async createDownloadTask(musicId: string): Promise<string> {
    if (!this.db) throw new Error("Database not initialized")
    const id = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()
    await this.db.execute(
      "INSERT INTO download_task (id, music_id, status, progress, created_at, updated_at) VALUES (?, ?, 'pending', 0, ?, ?)",
      [id, musicId, now, now]
    )
    return id
  }

  async updateDownloadTask(id: string, status: DownloadTask["status"], progress: number, error?: string): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")
      await this.db.execute(
        "UPDATE download_task SET status = ?, progress = ?, error = ?, updated_at = ? WHERE id = ?",
        [status, progress, error ?? null, Date.now(), id]
      )
    }

  async getDownloadTask(id: string): Promise<DownloadTask | null> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM download_task WHERE id = ?", [id])
      return rows.length > 0 ? this.rowToDownloadTask(rows[0]) : null
    }

  async getAllDownloadTasks(): Promise<DownloadTask[]> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM download_task ORDER BY created_at DESC")
      return rows.map(row => this.rowToDownloadTask(row))
    }

  async deleteDownloadTask(id: string): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")
      await this.db.execute("DELETE FROM download_task WHERE id = ?", [id])
    }

    async updateDownloadTaskSessionId(id: string, sessionId: string): Promise<void> {
      if (!this.db) throw new Error("Database not initialized")
      await this.db.execute(
        "UPDATE download_task SET session_id = ? WHERE id = ?",
        [sessionId, id]
      )
    }

    async getDownloadTaskBySessionId(sessionId: string): Promise<DownloadTask | null> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM download_task WHERE session_id = ?", [sessionId])
      return rows.length > 0 ? this.rowToDownloadTask(rows[0]) : null
    }

    async getDownloadTaskByMusicId(musicId: string): Promise<DownloadTask | null> {
      if (!this.db) throw new Error("Database not initialized")
      const rows = await this.db.fetchAll<any>("SELECT * FROM download_task WHERE music_id = ?", [musicId])
      return rows.length > 0 ? this.rowToDownloadTask(rows[0]) : null
    }

  // Helper methods
  private rowToMusic(row: any): Music {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      duration: row.duration,
      cover_url: row.cover_url,
      audio_url: row.audio_url,
      is_downloaded: row.is_downloaded === 1,
      file_size: row.file_size,
      added_at: row.added_at,
      play_count: row.play_count,
      last_played_at: row.last_played_at,
      is_favorite: row.is_favorite === 1
    }
  }

  private rowToPlaylist(row: any): Playlist {
    return {
      id: row.id,
      name: row.name,
      cover: row.cover,
      created_at: row.created_at,
      updated_at: row.updated_at,
      music_count: row.music_count
    }
  }

  private rowToSearchHistory(row: any): SearchHistory {
    return {
      id: row.id,
      keyword: row.keyword,
      searched_at: row.searched_at
    }
  }

  private rowToDownloadTask(row: any): DownloadTask {
      return {
        id: row.id,
        music_id: row.music_id,
        session_id: row.session_id,
        status: row.status,
        progress: row.progress,
        error: row.error,
        created_at: row.created_at,
        updated_at: row.updated_at
      }
    }

  close(): void {
      this.db = null
    }
}

export const database = new Database()