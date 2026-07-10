import {
  Button,
  Group,
  HStack,
  Image,
  Label,
  List,
  NavigationLink,
  ProgressView,
  Section,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { formatFileSize, HanimeDownloadTask, hanimeDownloadManager } from "../../class/hanime_download_manager"
import { HanimeDownloadedItem } from "../../class/hanime_database"
import { EmptyState } from "../components/empty_state"
import { ErrorState } from "../components/error_state"
import { LocalVideoPlayerView } from "../hanime/local_video_player"
import { HanimeVideoRow } from "../hanime/video_components"
import { HanimeActionPill, HanimeHeroCard } from "../components/hanime_ui"
import { HANIME_THEME } from "../theme"

export function DownloadView() {
  const [tasks, setTasks] = useState<HanimeDownloadTask[]>(hanimeDownloadManager.getTasks())
  const [downloads, setDownloads] = useState<HanimeDownloadedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = hanimeDownloadManager.subscribe(() => setTasks(hanimeDownloadManager.getTasks()))
    void loadDownloads()
    return unsubscribe
  }, [])

  async function loadDownloads() {
    try {
      setLoading(true)
      setError(null)
      setDownloads(await hanimeDownloadManager.getDownloads())
    } catch (loadError) {
      setError(`${loadError}`)
    } finally {
      setLoading(false)
    }
  }

  async function retry(task: HanimeDownloadTask) {
    try {
      await hanimeDownloadManager.retry(task.video.videoCode)
      await loadDownloads()
    } catch (retryError) {
      await Dialog.alert({ title: "下载失败", message: `${retryError}` })
    }
  }

  async function deleteDownload(item: HanimeDownloadedItem) {
    const confirmed = await Dialog.confirm({ title: "删除本机文件", message: "确定删除此下载文件吗？", confirmLabel: "删除", cancelLabel: "取消" })
    if (!confirmed) return
    try {
      await hanimeDownloadManager.deleteDownload(item)
      await loadDownloads()
    } catch (deleteError) {
      await Dialog.alert({ title: "删除失败", message: `${deleteError}` })
    }
  }

  return (
    <List listStyle="inset" onAppear={() => { void loadDownloads() }}>
      <Section>
        <HanimeHeroCard
          eyebrow="GIRIGIRI · DOWNLOADS"
          title="离线下载管理"
          subtitle="查看任务进度、暂停或重试下载；完成后可在本机离线播放。"
          stats={[
            { title: "进行中", value: `${tasks.filter((task) => task.status === "downloading").length} 项`, icon: "arrow.down.circle.fill" },
            { title: "待处理", value: `${tasks.filter((task) => task.status !== "downloading").length} 项`, icon: "pause.circle.fill" },
            { title: "已下载", value: loading ? "加载中" : `${downloads.length} 项`, icon: "tray.fill" },
          ]}
          actions={<HanimeActionPill title="刷新下载" systemImage="arrow.clockwise" action={() => { void loadDownloads() }} disabled={loading} tone="secondary" />}
        />
      </Section>

      <Section>
        <Text font="caption" foregroundStyle="secondaryLabel">
          HLS 按分片显示精确进度；直链视频将在保存完成后更新。暂停后可重新开始下载。
        </Text>
      </Section>

      {tasks.length > 0 ? (
        <Section title={`进行中的任务 · ${tasks.length}`}>
          {tasks.map((task) => <DownloadTaskRow key={task.downloadKey} task={task} onRetry={retry} />)}
        </Section>
      ) : null}

      {error ? <Section><ErrorState message={error} onRetry={() => { void loadDownloads() }} /></Section> : null}

      {downloads.length > 0 ? (
        <Section title={`已下载 · ${downloads.length}`}>
          {downloads.some((item) => item.isFileAvailable === false) ? (
            <Text font="caption" foregroundStyle="systemOrange">
              部分文件当前不可访问，记录已保留；请确认本机存储空间或 iCloud 文件可用后再播放、导出或删除。
            </Text>
          ) : null}
          {downloads.map((item) => (
            <NavigationLink
              key={item.downloadKey}
              destination={<LocalVideoPlayerView item={item} />}
              contextMenu={{ menuItems: <Group><Button title="删除本机文件" systemImage="trash" role="destructive" action={() => { void deleteDownload(item) }} /></Group> }}
            >
              <HanimeVideoRow
                video={item}
                accessory={<Text font="caption" foregroundStyle={item.isFileAvailable === false ? "systemOrange" : "secondaryLabel"}>{item.isFileAvailable === false ? "文件暂不可用" : formatFileSize(item.fileSize)}</Text>}
              />
            </NavigationLink>
          ))}
        </Section>
      ) : null}

      {!loading && tasks.length === 0 && downloads.length === 0 ? (
        <Section>
          <EmptyState icon="arrow.down.circle" title="暂无下载任务" message="在详情页选择剧集后，下载进度、暂停状态和失败信息都会显示在这里。" />
        </Section>
      ) : null}
    </List>
  )
}

function DownloadTaskRow({ task, onRetry }: { task: HanimeDownloadTask; onRetry: (task: HanimeDownloadTask) => void }) {
  const isDownloading = task.status === "downloading"
  const percent = task.progress == null ? null : Math.min(100, Math.round(task.progress * 100))
  const statusText = isDownloading
    ? (percent == null ? "正在下载，等待保存完成" : `正在下载 · ${percent}%`)
    : task.status === "paused"
      ? "已暂停"
      : "下载失败"

  return (
    <VStack
      alignment="leading"
      spacing={10}
      padding={HANIME_THEME.layout.row}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={HANIME_THEME.library.stateCardBackground}
      clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.cardRadius }}
    >
      <HStack spacing={10} frame={{ maxWidth: "infinity" }}>
        <Image systemName={isDownloading ? "arrow.down.circle.fill" : task.status === "paused" ? "pause.circle.fill" : "exclamationmark.circle.fill"} foregroundStyle={isDownloading ? "systemPink" : task.status === "paused" ? "systemOrange" : "systemRed"} />
        <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="body" fontWeight="semibold" lineLimit={1}>{task.video.title}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{task.sourceLabel || "默认剧集"} · {statusText}</Text>
        </VStack>
        {isDownloading ? (
          <Button action={() => hanimeDownloadManager.pause(task.downloadKey)} buttonStyle="plain">
            <TaskAction title="暂停" systemImage="pause.fill" tone="systemOrange" />
          </Button>
        ) : (
          <Button action={() => { void onRetry(task) }} buttonStyle="plain">
            <TaskAction title={task.status === "paused" ? "重新开始" : "重试"} systemImage="arrow.clockwise" tone={task.status === "failed" ? "systemRed" : "systemPink"} />
          </Button>
        )}
      </HStack>
      {isDownloading ? (
        <ProgressView value={task.progress ?? 0} total={1} currentValueLabel={<Text font="caption" foregroundStyle="secondaryLabel">{task.totalUnits > 0 ? `${task.completedUnits} / ${task.totalUnits} 个文件` : "准备下载…"}</Text>} />
      ) : null}
      {task.status === "failed" && task.error ? <Text font="caption" foregroundStyle="systemRed" lineLimit={2}>{task.error}</Text> : null}
    </VStack>
  )
}

function TaskAction({ title, systemImage, tone }: { title: string; systemImage: string; tone: "systemPink" | "systemOrange" | "systemRed" }) {
  return (
    <HStack spacing={5} padding={{ horizontal: 10, vertical: 8 }} background={HANIME_THEME.library.actionPillBackground} clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.controlRadius }}>
      <Image systemName={systemImage} font="caption" foregroundStyle={tone} />
      <Text font="caption" fontWeight="semibold" foregroundStyle={tone}>{title}</Text>
    </HStack>
  )
}
