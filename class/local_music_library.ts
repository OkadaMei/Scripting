import { Path } from "scripting"
import { database, Music } from "./database"
import { fileManager } from "./file_manager"

type ImportResult = {
  imported: Music[]
  skipped: string[]
}

const SUPPORTED_AUDIO_EXTENSIONS = new Set([".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg"])

class LocalMusicLibrary {
  async importFromPicker(): Promise<ImportResult> {
    const pickedPaths = await DocumentPicker.pickFiles()
    if (pickedPaths.length === 0) {
      return { imported: [], skipped: [] }
    }

    try {
      return await this.importFiles(pickedPaths)
    } finally {
      DocumentPicker.stopAcessingSecurityScopedResources()
    }
  }

  async importFiles(paths: string[]): Promise<ImportResult> {
    const imported: Music[] = []
    const skipped: string[] = []

    await fileManager.init()
    await database.init()

    for (const path of paths) {
      try {
        const ext = Path.extname(path).toLowerCase()
        if (!SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
          skipped.push(`${Path.basename(path)}：不支持的音频格式`)
          continue
        }

        const stat = await FileManager.stat(path)
        const metadata = await this.readMetadata(path)
        const id = this.generateMusicId(path)
        const format = ext.slice(1) || "mp3"
        await fileManager.importAudio(path, id, format)

        if (metadata.artwork) {
          await fileManager.saveCoverData(id, metadata.artwork)
        }

        const music: Music = {
          id,
          title: metadata.title || Path.basename(path, ext),
          artist: metadata.artist || "未知艺人",
          album: metadata.album || "未知专辑",
          duration: Math.round(metadata.duration),
          is_downloaded: true,
          file_size: stat.size || 0,
          added_at: Date.now(),
          play_count: 0,
          is_favorite: false,
        }

        await database.addMusic(music)
        imported.push(music)
      } catch (error) {
        console.error("导入音频失败:", error)
        skipped.push(`${Path.basename(path)}：导入失败`)
      }
    }

    return { imported, skipped }
  }

  async getRecentImports(limit: number = 12): Promise<Music[]> {
    const all = await database.getAllMusic()
    return all.slice(0, limit)
  }

  async searchLocal(keyword: string): Promise<Music[]> {
    const all = await database.getAllMusic()
    const query = keyword.trim().toLowerCase()
    if (!query) return all
    return all.filter((music) =>
      music.title.toLowerCase().includes(query) ||
      music.artist.toLowerCase().includes(query) ||
      music.album.toLowerCase().includes(query),
    )
  }

  private generateMusicId(path: string): string {
    const normalized = Path.basename(path).replace(/[^a-zA-Z0-9_-]/g, "_")
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${normalized}`
  }

  private async readMetadata(path: string): Promise<{
    title: string
    artist: string
    album: string
    duration: number
    artwork: Data | null
  }> {
    const probe = new AVPlayer()
    try {
      const loaded = probe.setSource(path)
      if (!loaded) {
        return {
          title: "",
          artist: "",
          album: "",
          duration: 0,
          artwork: null,
        }
      }

      const commonMetadata = (await probe.loadCommonMetadata()) ?? []
      const title = await this.readMetadataString(commonMetadata, ["title"])
      const artist = await this.readMetadataString(commonMetadata, ["artist", "creator"])
      const album = await this.readMetadataString(commonMetadata, ["albumName"])
      const artwork = await this.readMetadataArtwork(commonMetadata)

      return {
        title,
        artist,
        album,
        duration: probe.duration || 0,
        artwork,
      }
    } catch (error) {
      console.error("读取音频元数据失败:", error)
      return {
        title: "",
        artist: "",
        album: "",
        duration: 0,
        artwork: null,
      }
    } finally {
      probe.dispose()
    }
  }

  private async readMetadataString(items: AVMetadataItem[], keys: string[]): Promise<string> {
    for (const item of items) {
      if (item.commonKey && keys.includes(item.commonKey)) {
        const value = await item.stringValue
        if (value) return value
      }
    }
    return ""
  }

  private async readMetadataArtwork(items: AVMetadataItem[]): Promise<Data | null> {
    for (const item of items) {
      if (item.commonKey === "artwork") {
        const value = await item.dataValue
        if (value) return value
      }
    }
    return null
  }
}

export const localMusicLibrary = new LocalMusicLibrary()
