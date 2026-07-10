import { database } from "../class/database"

type TestResult = {
  name: string
  passed: boolean
  message: string
}

export async function runDatabaseTests(): Promise<TestResult[]> {
  const results: TestResult[] = []

  const addResult = (name: string, passed: boolean, message: string) => {
    results.push({ name, passed, message })
  }

  try {
    // Test 1: 初始化数据库
    try {
      await database.init()
      addResult("数据库初始化", true, "数据库初始化成功")
    } catch (error) {
      addResult("数据库初始化", false, `错误: ${error}`)
      return results
    }

    // Test 2: 添加音乐
    const testMusic = {
      id: "test_001",
      title: "测试歌曲",
      artist: "测试歌手",
      album: "测试专辑",
      duration: 180,
      cover_url: "https://example.com/cover.jpg",
      audio_url: "https://example.com/audio.m4a",
      is_downloaded: false,
      added_at: Date.now()
    }

    try {
      await database.addMusic(testMusic)
      addResult("添加音乐", true, "音乐添加成功")
    } catch (error) {
      addResult("添加音乐", false, `错误: ${error}`)
    }

    // Test 3: 获取音乐
    try {
      const music = await database.getMusic("test_001")
      if (music && music.title === "测试歌曲") {
        addResult("获取音乐", true, `找到音乐: ${music.title}`)
      } else {
        addResult("获取音乐", false, "未找到音乐或数据不匹配")
      }
    } catch (error) {
      addResult("获取音乐", false, `错误: ${error}`)
    }

    // Test 4: 获取所有音乐
    try {
      const allMusic = await database.getAllMusic()
      addResult("获取所有音乐", true, `共 ${allMusic.length} 首音乐`)
    } catch (error) {
      addResult("获取所有音乐", false, `错误: ${error}`)
    }

    // Test 5: 更新下载状态
    try {
      await database.updateMusicDownloadStatus("test_001", true, 5242880)
      const music = await database.getMusic("test_001")
      if (music?.is_downloaded && music.file_size === 5242880) {
        addResult("更新下载状态", true, "下载状态更新成功")
      } else {
        addResult("更新下载状态", false, "状态未正确更新")
      }
    } catch (error) {
      addResult("更新下载状态", false, `错误: ${error}`)
    }

    // Test 6: 更新播放次数
    try {
      await database.updateMusicPlayCount("test_001")
      const music = await database.getMusic("test_001")
      if (music?.play_count === 1) {
        addResult("更新播放次数", true, `播放次数: ${music.play_count}`)
      } else {
        addResult("更新播放次数", false, "播放次数未正确更新")
      }
    } catch (error) {
      addResult("更新播放次数", false, `错误: ${error}`)
    }

    // Test 7: 切换收藏状态
    try {
      const isFavorite = await database.toggleFavorite("test_001")
      addResult("切换收藏", true, `收藏状态: ${isFavorite}`)
    } catch (error) {
      addResult("切换收藏", false, `错误: ${error}`)
    }

    // Test 8: 创建播放列表
    let playlistId = ""
    try {
      playlistId = await database.createPlaylist("我的最爱", "cover.jpg")
      addResult("创建播放列表", true, `播放列表ID: ${playlistId}`)
    } catch (error) {
      addResult("创建播放列表", false, `错误: ${error}`)
    }

    // Test 9: 添加音乐到播放列表
    if (playlistId) {
      try {
        await database.addMusicToPlaylist(playlistId, "test_001")
        addResult("添加到播放列表", true, "音乐已添加到播放列表")
      } catch (error) {
        addResult("添加到播放列表", false, `错误: ${error}`)
      }

      // Test 10: 获取播放列表音乐
      try {
        const playlistMusic = await database.getPlaylistMusic(playlistId)
        addResult("获取播放列表音乐", true, `播放列表有 ${playlistMusic.length} 首音乐`)
      } catch (error) {
        addResult("获取播放列表音乐", false, `错误: ${error}`)
      }
    }

    // Test 11: 搜索历史
    try {
      await database.addSearchHistory("周杰伦")
      const history = await database.getSearchHistory(10)
      addResult("搜索历史", true, `历史记录: ${history.length} 条`)
    } catch (error) {
      addResult("搜索历史", false, `错误: ${error}`)
    }

    // Test 12: 下载任务
    try {
      const taskId = await database.createDownloadTask("test_001")
      await database.updateDownloadTask(taskId, "downloading", 0.5)
      const task = await database.getDownloadTask(taskId)
      if (task?.status === "downloading" && task.progress === 0.5) {
        addResult("下载任务", true, `任务状态: ${task.status}, 进度: ${task.progress}`)
      } else {
        addResult("下载任务", false, "任务状态不正确")
      }
    } catch (error) {
      addResult("下载任务", false, `错误: ${error}`)
    }

    // Test 13: 删除音乐
    try {
      await database.deleteMusic("test_001")
      const music = await database.getMusic("test_001")
      if (!music) {
        addResult("删除音乐", true, "音乐已删除")
      } else {
        addResult("删除音乐", false, "音乐未被删除")
      }
    } catch (error) {
      addResult("删除音乐", false, `错误: ${error}`)
    }

  } catch (error) {
    addResult("测试异常", false, `${error}`)
  }

  return results
}