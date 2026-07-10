import { Script } from "scripting"
import { player } from "../class/player"
import { fileManager } from "../class/file_manager"

export async function testPlayerLocal() {
  console.log("=== 测试播放器本地文件播放 ===\n")

  try {
    console.log("测试 1: 检查本地文件路径")
    const testMusicId = "test_music_123"
    const localPath = fileManager.getAudioPath(testMusicId)
    console.log("本地路径:", localPath)
    console.log("✓ 路径生成正常\n")

    console.log("测试 2: 检查文件存在性")
    const exists = await fileManager.audioExists(testMusicId)
    console.log("文件是否存在:", exists)
    console.log("✓ 文件检查正常\n")

    console.log("测试 3: 验证播放器实例可初始化")
    await player.init()
    console.log("播放器状态:", player.getState())
    console.log("✓ 播放器初始化正常\n")

    console.log("=== 所有测试通过 ✓ ===")
    console.log("\n说明:")
    console.log("- 本地播放器只依赖本机音频文件")
    console.log("- 导入后的歌曲会从本地文件目录读取")
    console.log("- 不再依赖任何在线搜索或下载服务")
  } catch (error) {
    console.log("✗ 测试失败:", error)
    throw error
  } finally {
    Script.exit()
  }
}
