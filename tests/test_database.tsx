import { useState, VStack, Text, Button, ScrollView, NavigationStack } from "scripting"
import { database } from "../class/database"

type TestResult = {
  name: string
  passed: boolean
  message: string
}

function TestDatabase() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const addResult = (name: string, passed: boolean, message: string) => {
    setResults((prev: TestResult[]) => [...prev, { name, passed, message }])
  }

  const runTests = async () => {
    setIsRunning(true)
    setResults([])

    try {
      await database.init()
      addResult("数据库初始化", true, "数据库初始化成功")

      const testMusic = {
        id: "test_001",
        title: "测试歌曲",
        artist: "测试歌手",
        album: "测试专辑",
        duration: 180,
        is_downloaded: false,
        added_at: Date.now()
      }

      await database.addMusic(testMusic)
      addResult("添加音乐", true, "音乐添加成功")

      const music = await database.getMusic("test_001")
      addResult("获取音乐", music?.title === "测试歌曲", music ? `找到: ${music.title}` : "未找到")

      const allMusic = await database.getAllMusic()
      addResult("获取所有音乐", true, `共 ${allMusic.length} 首`)

      await database.updateMusicDownloadStatus("test_001", true, 5242880)
      addResult("更新下载状态", true, "更新成功")

      await database.updateMusicPlayCount("test_001")
      addResult("更新播放次数", true, "更新成功")

      await database.toggleFavorite("test_001")
      addResult("切换收藏", true, "切换成功")

      const playlistId = await database.createPlaylist("我的最爱")
      addResult("创建播放列表", true, `ID: ${playlistId}`)

      await database.addMusicToPlaylist(playlistId, "test_001")
      addResult("添加到播放列表", true, "添加成功")

      const playlistMusic = await database.getPlaylistMusic(playlistId)
      addResult("获取播放列表音乐", true, `${playlistMusic.length} 首`)

      await database.addSearchHistory("周杰伦")
      const history = await database.getSearchHistory(10)
      addResult("搜索历史", true, `${history.length} 条`)

      const taskId = await database.createDownloadTask("test_001")
      await database.updateDownloadTask(taskId, "downloading", 0.5)
      addResult("下载任务", true, "任务创建成功")

      await database.deleteMusic("test_001")
      const deleted = await database.getMusic("test_001")
      addResult("删除音乐", !deleted, deleted ? "删除失败" : "删除成功")

    } catch (error) {
      addResult("测试异常", false, `${error}`)
    }

    setIsRunning(false)
  }

  const passedCount = results.filter((r: TestResult) => r.passed).length

  return (
      <NavigationStack>
        <ScrollView padding={20}>
        <VStack spacing={20}>
                  <Text font="largeTitle">数据库测试</Text>
                  
                  <Button
            title={isRunning ? "测试中..." : "运行测试"}
            action={runTests}
          />

          {results.length > 0 && (
            <VStack spacing={10}>
              <Text font="headline">
                测试结果: {passedCount}/{results.length} 通过
              </Text>
              
              {results.map((result: TestResult, index: number) => (
                <VStack 
                  key={index}
                  padding={10}
                  background={result.passed ? "#e8f5e9" : "#ffebee"}
                  spacing={5}
                >
                  <Text>
                    {result.passed ? "✅" : "❌"} {result.name}
                  </Text>
                  <Text foregroundStyle="#666">
                    {result.message}
                  </Text>
                </VStack>
              ))}
            </VStack>
          )}
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}

export default TestDatabase