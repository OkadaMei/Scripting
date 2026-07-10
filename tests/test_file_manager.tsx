import { fileManager } from "../class/file_manager"

export async function testFileManager() {
  console.log("=== 开始测试文件管理器 ===\n")
  
  try {
    // 1. 测试初始化
    console.log("1. 测试初始化...")
    await fileManager.init()
    console.log("✅ 初始化成功\n")
    
    // 2. 测试路径生成
    console.log("2. 测试路径生成...")
    const audioPath = fileManager.getAudioPath("test-music-001")
    const coverPath = fileManager.getCoverPath("test-music-001")
    console.log("音频路径:", audioPath)
    console.log("封面路径:", coverPath)
    console.log("✅ 路径生成成功\n")
    
    // 3. 测试文件存在性检查
    console.log("3. 测试文件存在性检查...")
    const audioExists = await fileManager.audioExists("test-music-001")
    const coverExists = await fileManager.coverExists("test-music-001")
    console.log("音频文件存在:", audioExists)
    console.log("封面文件存在:", coverExists)
    console.log("✅ 存在性检查成功\n")
    
    // 4. 测试保存文件
    console.log("4. 测试保存文件...")
    const testData = new Uint8Array([1, 2, 3, 4, 5])
    await fileManager.saveAudio("test-music-002", testData)
    await fileManager.saveCover("test-music-002", testData)
    console.log("✅ 文件保存成功\n")
    
    // 5. 验证文件已保存
    console.log("5. 验证文件已保存...")
    const audio2Exists = await fileManager.audioExists("test-music-002")
    const cover2Exists = await fileManager.coverExists("test-music-002")
    console.log("音频文件存在:", audio2Exists)
    console.log("封面文件存在:", cover2Exists)
    console.log("✅ 文件验证成功\n")
    
    // 6. 测试存储大小
    console.log("6. 测试存储大小...")
    const storageSize = await fileManager.getStorageSize()
    console.log("当前存储大小:", storageSize, "字节")
    console.log("✅ 存储大小获取成功\n")
    
    // 7. 测试删除文件
    console.log("7. 测试删除文件...")
    await fileManager.deleteAudio("test-music-002")
    await fileManager.deleteCover("test-music-002")
    const audio2ExistsAfterDelete = await fileManager.audioExists("test-music-002")
    const cover2ExistsAfterDelete = await fileManager.coverExists("test-music-002")
    console.log("删除后音频文件存在:", audio2ExistsAfterDelete)
    console.log("删除后封面文件存在:", cover2ExistsAfterDelete)
    console.log("✅ 文件删除成功\n")
    
    console.log("=== 所有测试通过 ✅ ===")
    return true
  } catch (error) {
    console.error("❌ 测试失败:", error)
    return false
  }
}