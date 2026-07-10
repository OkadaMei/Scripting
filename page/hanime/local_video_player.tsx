import {
  Button,
  HStack,
  Image,
  Label,
  List,
  Navigation,
  Section,
  Spacer,
  Text,
  useEffect,
  useState,
  VideoPlayer,
  VStack,
} from "scripting"
import { HanimeDownloadedItem, hanimeDatabase } from "../../class/hanime_database"
import { formatFileSize, hanimeDownloadManager } from "../../class/hanime_download_manager"
import { EmptyState } from "../components/empty_state"
import { HanimeActionPill } from "../components/hanime_ui"
import { HANIME_THEME } from "../theme"
import { normalizeVideoTitle, VideoCover } from "./video_components"

export function LocalVideoPlayerView({ item }: { item: HanimeDownloadedItem }) {
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleted, setDeleted] = useState(false)

  useEffect(() => {
    if (!deleted) void hanimeDatabase.addHistory(item)
  }, [item.videoCode, deleted])

  async function openSystemPlayer() {
    if (opening || deleted) return
    try {
      setOpening(true)
      setError(null)
      if (!item.sourceType?.includes("mpegurl")) {
        await QuickLook.previewURLs([item.filePath], true)
        return
      }
      const player = new AVPlayer()
      player.onReadyToPlay = () => player.play()
      player.onError = (playerError) => setError(`${playerError}`)
      if (!player.setSource(item.filePath)) {
        player.dispose()
        throw new Error(item.sourceType?.includes("mpegurl") ? "本地 HLS 播放包无法打开，可能已被删除或系统不支持该格式。" : "本地 MP4 无法打开，可能已被删除或格式不受支持。")
      }
      SharedAudioSession.setActive(true)
      SharedAudioSession.setCategory("playback", [])
      await Navigation.present({
        element: <LocalSystemPlayerModal player={player} />,
        modalPresentationStyle: "fullScreen",
      })
      player.dispose()
    } catch (playError) {
      setError(`${playError}`)
    } finally {
      setOpening(false)
    }
  }

  async function exportLocalFile() {
    try {
      const result = await hanimeDownloadManager.exportToFilesApp(item)
      await Dialog.alert({
        title: "已保存到文件 App",
        message: result.isDirectory
          ? `已导出为 HLS 文件夹，可在 ${result.location} 查看。`
          : `已导出视频文件，可在 ${result.location} 查看。`,
      })
    } catch (exportError) {
      await Dialog.alert({ title: "保存失败", message: `${exportError}` })
    }
  }

  async function deleteLocalFile() {
    const confirmed = await Dialog.confirm({
      title: "删除下载",
      message: "确定删除这个本地视频文件吗？收藏和观看历史会保留。",
      confirmLabel: "删除",
      cancelLabel: "取消",
    })
    if (!confirmed) return
    await hanimeDownloadManager.deleteDownload(item)
    setDeleted(true)

  }

  if (deleted) {
    return (
      <List listStyle="inset" navigationTitle="本地播放">
        <Section>
          <EmptyState
            icon="trash"
            title="本地文件已删除"
            message="返回收藏页刷新后，这条下载记录会从本地下载中移除。"
          />
        </Section>
      </List>
    )
  }

  return (
    <List listStyle="inset" navigationTitle="本地播放">
      <Section>
        <VStack alignment="leading" spacing={HANIME_THEME.layout.row} padding={{ vertical: 6 }}>
          <VStack
            alignment="leading"
            spacing={12}
            padding={HANIME_THEME.layout.section}
            frame={{ maxWidth: "infinity", alignment: "leading" }}
            background={{ style: HANIME_THEME.library.accentCardBackground, shape: { type: "rect", cornerRadius: HANIME_THEME.layout.heroRadius } }}
          >
            <HStack alignment="top" spacing={12}>
              <VideoCover url={item.coverUrl} width={86} height={52} />
              <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
                <Text font="caption" fontWeight="semibold" foregroundStyle="systemPink">GIRIGIRI · OFFLINE</Text>
                <Text font="title3" fontWeight="bold" lineLimit={2} multilineTextAlignment="leading">{normalizeVideoTitle(item.title)}</Text>
                <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{[item.sourceLabel || "本地剧集", item.sourceType?.includes("mpegurl") ? "HLS 离线播放包" : formatFileSize(item.fileSize)].join(" · ")}</Text>
              </VStack>
            </HStack>
            <HanimeActionPill title={opening ? "正在打开系统播放器…" : "使用系统播放器播放"} systemImage={opening ? "hourglass" : "play.rectangle.fill"} action={() => { void openSystemPlayer() }} disabled={opening} />
            <Text font="caption" foregroundStyle="secondaryLabel">{item.sourceType?.includes("mpegurl") ? "HLS 离线包使用原生播放器播放。" : "MP4 交由 iOS 原生视频预览器播放，支持横屏全屏与画中画。"}</Text>
          </VStack>

          {error ? (
            <VStack alignment="leading" spacing={4} padding={{ horizontal: 12, vertical: 10 }} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 12 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
              <Text font="caption" fontWeight="semibold" foregroundStyle="systemRed">播放异常</Text>
              <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={3} multilineTextAlignment="leading">{error}</Text>
            </VStack>
          ) : null}

        </VStack>
      </Section>

      <Section title="文件信息">
        <InfoRow title="文件大小" value={formatFileSize(item.fileSize)} />
        <InfoRow title="下载时间" value={formatTime(item.downloadedAt)} />
        <InfoRow title="格式" value={item.sourceType?.includes("mpegurl") ? "HLS 离线播放包（未能合并为 MP4）" : "MP4 本地视频"} />
        <InfoRow title="来源" value={item.sourceLabel || item.sourceType || "直连视频"} />
      </Section>

      <Section title="管理">
        <Button action={() => { void exportLocalFile() }}>
          <Label title="保存到文件 App" systemImage="folder.badge.plus" />
        </Button>
        <Button role="destructive" action={() => { void deleteLocalFile() }}>
          <Label title="删除本地文件" systemImage="trash" />
        </Button>
      </Section>
    </List>
  )
}

function LocalSystemPlayerModal({ player }: { player: AVPlayer }) {
  const dismiss = Navigation.useDismiss()

  return (
    <VStack spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="black">
      <HStack padding={{ horizontal: 18, vertical: 12 }} frame={{ maxWidth: "infinity" }}>
        <Spacer />
        <Button action={() => dismiss("close")} buttonStyle="plain">
          <HStack
            frame={{ width: 40, height: 40, alignment: "center" }}
            background={{ style: "systemPink", shape: { type: "rect", cornerRadius: 20, style: "continuous" } }}
          >
            <Image systemName="xmark" font="subheadline" foregroundStyle="white" />
          </HStack>
        </Button>
      </HStack>
      <VideoPlayer player={player} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} />
    </VStack>
  )
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <HStack alignment="top" spacing={12}>
      <Text>{title}</Text>
      <Spacer />
      <Text foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="trailing">{value}</Text>
    </HStack>
  )
}

function formatTime(value?: number): string {
  if (!value) return "未知"
  const date = new Date(value)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
}
