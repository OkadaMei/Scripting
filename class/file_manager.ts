import { Path } from "scripting"
import { setting } from "./setting"

class MusicFileManager {
  private get rootPath(): string {
    return setting.getBasePath()
  }

  private get audioDir(): string {
    return Path.join(this.rootPath, "audios")
  }

  private get coverDir(): string {
    return Path.join(this.rootPath, "covers")
  }

  async init(): Promise<void> {
    await FileManager.createDirectory(this.audioDir, true)
    await FileManager.createDirectory(this.coverDir, true)
  }

  async importAudio(sourcePath: string, musicId: string, format: string): Promise<string> {
    if (!musicId || musicId.includes("/") || musicId.includes("..")) {
      throw new Error("Invalid music ID")
    }
    const destinationPath = this.getAudioPath(musicId, format)
    await FileManager.copyFile(sourcePath, destinationPath)
    return destinationPath
  }

  async saveAudio(musicId: string, data: Uint8Array): Promise<string> {
    if (!musicId || musicId.includes("/") || musicId.includes("..")) {
      throw new Error("Invalid music ID")
    }
    const path = this.getAudioPath(musicId)
    await FileManager.writeAsBytes(path, data)
    return path
  }

  async saveCover(musicId: string, data: Uint8Array): Promise<string> {
    if (!musicId || musicId.includes("/") || musicId.includes("..")) {
      throw new Error("Invalid music ID")
    }
    const path = this.getCoverPath(musicId)
    await FileManager.writeAsBytes(path, data)
    return path
  }

  async saveCoverData(musicId: string, data: Data): Promise<string> {
    if (!musicId || musicId.includes("/") || musicId.includes("..")) {
      throw new Error("Invalid music ID")
    }

    const image = UIImage.fromData(data)
    if (!image) {
      throw new Error("Invalid cover data")
    }

    const jpeg = image.toJPEGData(0.9)
    if (!jpeg) {
      throw new Error("Failed to convert cover to JPEG")
    }

    const path = this.getCoverPath(musicId)
    await FileManager.writeAsData(path, jpeg)
    return path
  }

  getAudioPath(musicId: string, format: string = "mp3"): string {
      return Path.join(this.audioDir, `${musicId}.${format}`)
    }

    async findAudioPath(musicId: string): Promise<string | null> {
      for (const fmt of ["mp3", "m4a", "ogg", "flac", "wav"]) {
        const p = this.getAudioPath(musicId, fmt)
        if (await FileManager.exists(p)) return p
      }
      return null
    }

  getCoverPath(musicId: string): string {
    return Path.join(this.coverDir, `${musicId}.jpg`)
  }

  async audioExists(musicId: string): Promise<boolean> {
      return (await this.findAudioPath(musicId)) !== null
    }

  async coverExists(musicId: string): Promise<boolean> {
    return await FileManager.exists(this.getCoverPath(musicId))
  }

  async deleteAudio(musicId: string): Promise<void> {
      const path = await this.findAudioPath(musicId)
      if (path) await FileManager.remove(path)
    }

  async deleteCover(musicId: string): Promise<void> {
    const path = this.getCoverPath(musicId)
    if (await FileManager.exists(path)) {
      await FileManager.remove(path)
    }
  }

  async getStorageSize(): Promise<number> {
    let totalSize = 0

    if (await FileManager.exists(this.audioDir)) {
      const audioFiles = await FileManager.readDirectory(this.audioDir)
      for (const file of audioFiles) {
        const filePath = Path.join(this.audioDir, file)
        const stat = await FileManager.stat(filePath)
        totalSize += stat.size || 0
      }
    }

    if (await FileManager.exists(this.coverDir)) {
      const coverFiles = await FileManager.readDirectory(this.coverDir)
      for (const file of coverFiles) {
        const filePath = Path.join(this.coverDir, file)
        const stat = await FileManager.stat(filePath)
        totalSize += stat.size || 0
      }
    }

    return totalSize
  }
}

export const fileManager = new MusicFileManager()