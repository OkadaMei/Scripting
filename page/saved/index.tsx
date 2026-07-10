import {
  Button,
  Group,
  Image,
  Label,
  List,
  NavigationLink,
  Section,
  Text,
  useEffect,
  useState,
} from "scripting"
import { formatFileSize, hanimeDownloadManager } from "../../class/hanime_download_manager"
import { hanimeDatabase, HanimeDownloadedItem, HanimeLibraryItem, HanimeStats } from "../../class/hanime_database"
import { EmptyState } from "../components/empty_state"
import { ErrorState } from "../components/error_state"
import { HanimeActionPill, HanimeHeroCard } from "../components/hanime_ui"
import { LocalVideoPlayerView } from "../hanime/local_video_player"
import { VideoDetailView } from "../hanime/video_detail"
import { HanimeVideoRow } from "../hanime/video_components"

export function SavedView() {
  const [downloads, setDownloads] = useState<HanimeDownloadedItem[]>([])
  const [favorites, setFavorites] = useState<HanimeLibraryItem[]>([])
  const [history, setHistory] = useState<HanimeLibraryItem[]>([])
  const [stats, setStats] = useState<HanimeStats>({ favorites: 0, history: 0, downloads: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)
      const [downloadItems, favoriteItems, historyItems] = await Promise.all([
        hanimeDownloadManager.getDownloads(),
        hanimeDatabase.getFavorites(),
        hanimeDatabase.getHistory(),
      ])
      setDownloads(downloadItems)
      setFavorites(favoriteItems)
      setHistory(historyItems)
      setStats(await hanimeDatabase.getStats())
    } catch (loadError) {
      console.error("加载 GiriGiri 收藏历史失败:", loadError)
      setError(`${loadError}`)
    } finally {
      setLoading(false)
    }
  }


  async function clearHistory() {
    const confirmed = await Dialog.confirm({
      title: "清空观看历史",
      message: "确定清空本地观看历史吗？收藏不会被删除。",
      confirmLabel: "清空",
      cancelLabel: "取消",
    })
    if (!confirmed) return
    await hanimeDatabase.clearHistory()
    await loadData()
  }

  async function exportDownload(video: HanimeDownloadedItem) {
    try {
      const result = await hanimeDownloadManager.exportToFilesApp(video)
      await Dialog.alert({
        title: "已保存到文件 App",
        message: result.isDirectory
          ? `已导出为 HLS 文件夹，可在 ${result.location} 查看。`
          : `已导出视频文件，可在 ${result.location} 查看。`,
      })
    } catch (exportError) {
      await Dialog.alert({ title: "保存失败", message: `${exportError}` })
      await loadData()
    }
  }

  async function deleteDownload(video: HanimeDownloadedItem) {
    const confirmed = await Dialog.confirm({
      title: "删除本机文件",
      message: "确定删除此下载文件吗？收藏和观看历史会保留。",
      confirmLabel: "删除",
      cancelLabel: "取消",
    })
    if (!confirmed) return

    try {
      await hanimeDownloadManager.deleteDownload(video)
      await loadData()
    } catch (deleteError) {
      await Dialog.alert({ title: "删除失败", message: `${deleteError}` })
    }
  }

  return (
    <List listStyle="inset" onAppear={() => { void loadData() }}>
      <Section>
        <HanimeHeroCard
          eyebrow="YOUR LIBRARY"
          title="你的片库"
          subtitle="管理收藏、观看记录与已下载文件；本机文件可播放、导出或删除。"
          stats={[
            { title: "收藏", value: loading ? "加载中" : `${stats.favorites} 部`, icon: "heart.fill" },
            { title: "历史", value: loading ? "加载中" : `${stats.history} 部`, icon: "clock.fill" },
            { title: "本机文件", value: loading ? "加载中" : `${stats.downloads} 项`, icon: "tray.fill" },
          ]}
          actions={<HanimeActionPill title="刷新片库" systemImage="arrow.clockwise" action={() => { void loadData() }} />}
        />
      </Section>

      {error ? (
        <Section>
          <ErrorState message={error} onRetry={() => { void loadData() }} />
        </Section>
      ) : null}

      {downloads.length > 0 ? (
        <Section title={`本机文件 · ${downloads.length}`}>
          {downloads.some((video) => video.isFileAvailable === false) ? (
            <Text font="caption" foregroundStyle="systemOrange">
              部分文件当前不可访问，记录已保留；请确认本机存储空间或 iCloud 文件可用后再操作。
            </Text>
          ) : null}
          {downloads.map((video) => (
            <NavigationLink
              key={video.videoCode}
              destination={<LocalVideoPlayerView item={video} />}
              contextMenu={{
                menuItems: (
                  <Group>
                    <Button title="保存到文件 App" systemImage="folder.badge.plus" action={() => { void exportDownload(video) }} />
                    <Button title="删除本机文件" systemImage="trash" role="destructive" action={() => { void deleteDownload(video) }} />
                  </Group>
                ),
              }}
            >
              <HanimeVideoRow
                video={video}
                accessory={<Text font="caption" foregroundStyle={video.isFileAvailable === false ? "systemOrange" : "secondaryLabel"}>{video.isFileAvailable === false ? "文件暂不可用" : formatFileSize(video.fileSize)}</Text>}
              />
            </NavigationLink>
          ))}
          <Text font="caption" foregroundStyle="secondaryLabel">
这里展示从详情页保存到本机的直链视频或无 DRM HLS 文件。点按可播放；长按可导出或删除。
          </Text>
        </Section>
      ) : null}

      {favorites.length > 0 ? (
        <Section title={`收藏 · ${favorites.length}`}>
          {favorites.map((video) => (
            <NavigationLink key={video.videoCode} destination={<VideoDetailView video={video} />}>
              <HanimeVideoRow
                video={video}
                accessory={<Image systemName="heart.fill" tint="systemPink" />}
              />
            </NavigationLink>
          ))}
          <Text font="caption" foregroundStyle="secondaryLabel">
进入详情页可查看信息、调用系统播放器或取消收藏。
          </Text>
        </Section>
      ) : null}

      {history.length > 0 ? (
        <Section title="观看历史">
          {history.map((video) => (
            <NavigationLink key={video.videoCode} destination={<VideoDetailView video={video} />}>
              <HanimeVideoRow
                video={video}
                accessory={<Text font="caption" foregroundStyle="secondaryLabel">{formatTime(video.lastWatchedAt)}</Text>}
              />
            </NavigationLink>
          ))}
          <Button role="destructive" action={() => { void clearHistory() }}>
            <Label title="清空观看历史" systemImage="trash" />
          </Button>
        </Section>
      ) : null}

      {!loading && downloads.length === 0 && favorites.length === 0 && history.length === 0 ? (
        <Section>
          <EmptyState
            icon="heart.text.square"
            title="片库还是空的"
            message="收藏内容或从详情页打开系统播放器后，相关记录会自动出现在这里。"
          />
        </Section>
      ) : null}
    </List>
  )
}

function formatTime(value?: number): string {
  if (!value) return ""
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}
