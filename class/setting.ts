import { Path } from "scripting"

export type StorageLocation = "appGroup" | "iCloud"

class Setting {
  private LOCATION_KEY = "storage_location"
  location: StorageLocation = (Storage.get(this.LOCATION_KEY) as StorageLocation) || "appGroup"

  getBasePath(): string {
    return this.location === "iCloud"
      ? Path.join(FileManager.iCloudDocumentsDirectory, "GiriGiri")
      : Path.join(FileManager.appGroupDocumentsDirectory, "GiriGiri")
  }

  async setLocation(newLocation: StorageLocation): Promise<void> {
    if (this.location === newLocation) return

    const oldPath = this.getBasePath()
    this.location = newLocation
    const newPath = this.getBasePath()

    await this.migrateFiles(oldPath, newPath)
    Storage.set(this.LOCATION_KEY, newLocation)
  }

  private async migrateFiles(oldPath: string, newPath: string): Promise<void> {
    if (!(await FileManager.exists(oldPath))) return

    await FileManager.createDirectory(newPath, true)

    const items = await FileManager.readDirectory(oldPath)
    for (const item of items) {
      const oldItemPath = Path.join(oldPath, item)
      const newItemPath = Path.join(newPath, item)

      if (await FileManager.isDirectory(oldItemPath)) {
        await this.copyDirectory(oldItemPath, newItemPath)
      } else {
        await FileManager.copyFile(oldItemPath, newItemPath)
      }
    }

    await FileManager.remove(oldPath)
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await FileManager.createDirectory(dest, true)
    const items = await FileManager.readDirectory(src)

    for (const item of items) {
      const srcPath = Path.join(src, item)
      const destPath = Path.join(dest, item)

      if (await FileManager.isDirectory(srcPath)) {
        await this.copyDirectory(srcPath, destPath)
      } else {
        await FileManager.copyFile(srcPath, destPath)
      }
    }
  }
}

export const setting = new Setting()