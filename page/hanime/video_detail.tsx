import {
  Button,
  HStack,
  Image,
  Label,
  LazyVGrid,
  List,
  NavigationLink,
  RoundedRectangle,
  Section,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { extractVideoCode, hanimeClient, HanimeVideoDetail, HanimeVideoItem, HanimeVideoSource } from "../../class/hanime"
import { formatFileSize, HanimeDownloadTask, hanimeDownloadManager, isDownloadableVideoSource } from "../../class/hanime_download_manager"
import { HanimeDownloadedItem, hanimeDatabase } from "../../class/hanime_database"
import { EmptyState } from "../components/empty_state"
import { ErrorState } from "../components/error_state"
import { LoadingState } from "../components/loading_state"
import { HANIME_THEME } from "../theme"
import { HanimeActionPill, HanimeActionPillContent, HanimeHeroCard } from "../components/hanime_ui"
import { HanimeVideoRow, normalizeVideoTitle } from "./video_components"
import { LocalVideoPlayerView } from "./local_video_player"

export function VideoDetailView({ video }: { video: HanimeVideoItem }) {
  const [detail, setDetail] = useState<HanimeVideoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favorite, setFavorite] = useState(false)
  const [downloaded, setDownloaded] = useState<HanimeDownloadedItem[]>([])
  const [downloading, setDownloading] = useState(false)
  const [downloadTask, setDownloadTask] = useState<HanimeDownloadTask | null>(null)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [openingSourceUrl, setOpeningSourceUrl] = useState<string | null>(null)

  useEffect(() => {
    void loadDetail()
  }, [video.videoCode, video.title])

  useEffect(() => {
    const refreshTask = () => setDownloadTask(hanimeDownloadManager.getTasks().find((task) => task.video.videoCode === video.videoCode) || null)
    refreshTask()
    return hanimeDownloadManager.subscribe(refreshTask)
  }, [video.videoCode])

  async function loadDetail() {
    try {
      setLoading(true)
      setError(null)
      const resolvedVideo = await resolveVideoForDetail()
      const data = await hanimeClient.getVideo(resolvedVideo.videoCode)
      setDetail(data)
      const item = toVideoItem(data)
      await hanimeDatabase.saveVideo(item)
      setFavorite(await hanimeDatabase.isFavorite(item.videoCode))
      setDownloaded(await hanimeDownloadManager.getDownloadsForVideo(item.videoCode))
    } catch (loadError) {
      console.error("加载 GiriGiri 详情失败:", loadError)
      setError(`${loadError}`)
    } finally {
      setLoading(false)
    }
  }

  async function resolveVideoForDetail(): Promise<HanimeVideoItem> {
    if (video.videoCode) return video

    const title = normalizeVideoTitle(video.title)
    if (!title) throw new Error("推荐视频缺少详情入口，请刷新首页后重试。")

    const results = await hanimeClient.searchVideos({ query: title, page: 1, sort: "time" })
    const matched = results.find((result) => normalizeVideoTitle(result.title) === title) || results[0]
    if (!matched?.videoCode) throw new Error("未能解析推荐视频详情入口，请先打开官网确认该推荐仍可访问。")

    return {
      ...matched,
      title: matched.title || video.title,
      coverUrl: matched.coverUrl || video.coverUrl,
    }
  }

  function currentItem(): HanimeVideoItem {
    return detail ? toVideoItem(detail) : video
  }

  async function toggleFavorite() {
    try {
      const next = await hanimeDatabase.toggleFavorite(currentItem())
      setFavorite(next)
    } catch (favoriteError) {
      await Dialog.alert({ title: "收藏失败", message: `${favoriteError}` })
    }
  }

  async function openOfficialDetail() {
    await Safari.present(hanimeClient.watchUrl(currentItem().videoCode), true)
  }

  async function downloadCurrent() {
    if (!detail || downloading) return

    const selectedIndex = await Dialog.actionSheet({
      title: "选择下载剧集",
      message: "每次仅下载一话，请选择要保存的剧集。",
      actions: detail.videoUrls.map((source) => ({ label: source.label })),
    })
    if (selectedIndex == null) return

    const selectedSource = detail.videoUrls[selectedIndex]
    if (!selectedSource) return

    try {
      setDownloading(true)
      const downloadableSource = await hanimeClient.resolvePlayableSource(selectedSource)
      if (!isDownloadableVideoSource(downloadableSource)) {
        throw new Error(`「${selectedSource.label}」未解析到可保存的 MP4 或无 DRM HLS 视频地址。`)
      }

      const savedItem = await hanimeDownloadManager.download(currentItem(), downloadableSource)
      setDownloaded(await hanimeDownloadManager.getDownloadsForVideo(savedItem.videoCode))
      await Dialog.alert({
        title: "下载完成",
        message: `${selectedSource.label} 已保存到本机（${formatFileSize(savedItem.fileSize)}）。可在「收藏」的本机文件中播放或导出。`,
      })
    } catch (downloadError) {
      await Dialog.alert({ title: "下载失败", message: `${downloadError}` })
    } finally {
      setDownloading(false)
    }
  }

  async function openSystemPlayer(source?: HanimeVideoSource) {
    const item = currentItem()
    const targetSource = source || detail?.videoUrls[0] || {
      label: "系统播放",
      url: detail?.watchUrl || hanimeClient.watchUrl(item.videoCode),
      type: "text/html",
    }

    try {
      setOpeningSourceUrl(targetSource.url)
      await hanimeDatabase.addHistory(item)
      const resolved = await hanimeClient.resolvePlayableSource(targetSource)
      await Safari.present(resolved.url, true)
    } catch (playError) {
      await Dialog.alert({
        title: "系统播放器打开失败",
        message: `${playError}\n\n可以尝试切换其他剧集/线路，或打开官方详情页播放。`,
      })
    } finally {
      setOpeningSourceUrl(null)
    }
  }

  async function copyCurrentTitle(title: string) {
    const normalizedTitle = normalizeVideoTitle(title)
    if (!normalizedTitle) return

    try {
      await Pasteboard.setString(normalizedTitle)
      await Dialog.alert({ title: "已复制标题", message: normalizedTitle })
    } catch (copyError) {
      await Dialog.alert({ title: "复制标题失败", message: `${copyError}` })
    }
  }

  if (loading && !detail) {
    return (
      <List listStyle="inset">
        <Section>
          <LoadingState message="正在加载详情..." />
        </Section>
      </List>
    )
  }

  if (error && !detail) {
    return (
      <List listStyle="inset">
        <Section>
          <ErrorState message={error} onRetry={() => { void loadDetail() }} />
        </Section>
      </List>
    )
  }

  const item = currentItem()
  const displayTitle = formatDetailDisplayTitle(item, detail)
  const detailPageUrl = hanimeClient.watchUrl(item.videoCode)
  const primarySource = detail?.videoUrls[0]
  const activeDownload = downloadTask?.status === "downloading"
  

  return (
    <List
      listStyle="inset"
      onAppear={() => {
        void hanimeDatabase.saveVideo(item)
        void hanimeDownloadManager.getDownloadsForVideo(item.videoCode).then(setDownloaded)
      }}
      navigationDestination={activeTag ? {
        content: <TagSearchView tag={activeTag} />,
        isPresented: true,
        onChanged: (isPresented) => { if (!isPresented) setActiveTag(null) },
      } : undefined}
    >
      <Section>
        <VStack
          alignment="leading"
          spacing={HANIME_THEME.layout.row}
          padding={HANIME_THEME.layout.section}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
          background={{
            style: HANIME_THEME.library.accentCardBackground,
            shape: { type: "rect", cornerRadius: HANIME_THEME.layout.heroRadius },
          }}
        >
          <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            <Text
              font="headline"
              fontWeight="semibold"
              multilineTextAlignment="leading"
              allowsTightening={true}
              lineSpacing={1}
              layoutPriority={1}
              frame={{ maxWidth: "infinity", alignment: "leading" }}
            >
              {displayTitle}
            </Text>
            {detail?.chineseTitle ? (
              <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="leading">
                {detail.chineseTitle}
              </Text>
            ) : null}
          </VStack>

          <DetailHeroCover url={item.coverUrl || detail?.coverUrl} />

          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="leading">
            {formatDetailMeta(item, detail)}
          </Text>

          <VStack spacing={10} frame={{ maxWidth: "infinity" }}>
            <Button action={() => { void openSystemPlayer(primarySource) }} disabled={openingSourceUrl !== null || !detail} buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
              <SystemPlayPrimaryButton title={openingSourceUrl ? "正在打开系统播放器…" : "系统播放器播放"} subtitle="解析直链后交给 iOS 播放器，支持系统全屏 / PiP" />
            </Button>
            <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
              <Button action={() => { void openOfficialDetail() }} buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
                <HanimeActionPillContent title="详情页" systemImage="safari" tone="secondary" />
              </Button>
              {false ? (
                <NavigationLink destination={<LocalVideoPlayerView item={downloaded[0]} />} frame={{ maxWidth: "infinity" }}>
                  <HanimeActionPillContent title="本地播放" systemImage="play.rectangle.fill" tone="secondary" />
                </NavigationLink>
              ) : false ? (
                <Button action={() => { void hanimeDownloadManager.retry(item.videoCode).catch((retryError) => Dialog.alert({ title: "下载失败", message: `${retryError}` })) }} disabled={!detail} buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
                  <HanimeActionPillContent title={downloadTask?.status === "paused" ? "重新下载" : "重试下载"} systemImage="arrow.clockwise" tone="secondary" />
                </Button>
              ) : (
                <Button action={() => { void downloadCurrent() }} disabled={downloading || !detail} buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
                  <HanimeActionPillContent title={activeDownload || downloading ? "下载中" : "下载剧集"} systemImage="arrow.down.circle" tone="secondary" />
                </Button>
              )}
              <Button action={toggleFavorite} buttonStyle="plain" frame={{ maxWidth: "infinity" }}>
                <HanimeActionPillContent title={favorite ? "已收藏" : "收藏"} systemImage={favorite ? "heart.fill" : "heart"} />
              </Button>
            </HStack>
          </VStack>
        </VStack>
      </Section>

      <Section title="快捷操作">
        <Button action={() => { void copyCurrentTitle(item.title || displayTitle) }}>
          <CopyTitleActionRow />
        </Button>
      </Section>

      {detail && detail.videoUrls.length > 0 ? (
        <Section title="系统播放 · 剧集">
          <EpisodeGrid episodes={detail.videoUrls} openingSourceUrl={openingSourceUrl} onOpen={openSystemPlayer} />
        </Section>
      ) : (
        <Section>
          <EmptyState
            icon="play.rectangle"
            title="暂未解析到可播放剧集"
            message="可以打开官方详情页或稍后刷新重试。"
            actionTitle="打开详情页"
            action={openOfficialDetail}
          />
        </Section>
      )}

      {detail ? (
        <Section title="简介">
          <Text font="body" foregroundStyle={detail.introduction ? undefined : "secondaryLabel"} multilineTextAlignment="leading">
            {detail.introduction || "该视频暂未提供简介。"}
          </Text>
        </Section>
      ) : null}

      {detail?.tags && detail.tags.length > 0 ? (
        <Section title="标签">
          <TagGrid tags={detail.tags} onSelect={setActiveTag} />
        </Section>
      ) : null}

      {detail?.originalComic ? (
        <Section title="关联内容">
          <Button action={() => { void Safari.present(detail.originalComic!, true) }}>
            <Label title="打开原作链接" systemImage="book.fill" />
          </Button>
        </Section>
      ) : null}

      {detail?.playlist && detail.playlist.video.length > 0 ? (
        <Section title={detail.playlist.playlistName || "同系列"}>
          {detail.playlist.video.map((playlistItem) => (
            <NavigationLink key={playlistItem.videoCode} destination={<VideoDetailView video={playlistItem} />}>
              <HanimeVideoRow video={playlistItem} />
            </NavigationLink>
          ))}
        </Section>
      ) : null}

      {detail?.relatedHanimes && detail.relatedHanimes.length > 0 ? (
        <Section title="相关推荐">
          {detail.relatedHanimes.map((related) => (
            <NavigationLink key={related.videoCode} destination={<VideoDetailView video={related} />}>
              <HanimeVideoRow video={related} />
            </NavigationLink>
          ))}
        </Section>
      ) : null}
    </List>
  )
}

function formatDetailDisplayTitle(item: HanimeVideoItem, detail: HanimeVideoDetail | null): string {
  const title = normalizeVideoTitle(item.title)
  const studio = cleanDetailMeta(detail?.artist?.name || item.currentArtist)
  if (!studio) return title

  const escapedStudio = studio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const displayTitle = title.replace(new RegExp(`^\\[\\s*${escapedStudio}\\s*\\]\\s*`, "i"), "").trim()
  return displayTitle || title
}

function CopyTitleActionRow() {
  return (
    <HStack spacing={12} padding={{ vertical: 5 }} frame={{ maxWidth: "infinity", minHeight: 48, alignment: "center" }}>
      <Image systemName="doc.on.doc" font="body" foregroundStyle="systemPink" frame={{ width: 24 }} />
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="body" fontWeight="semibold">复制完整标题</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">复制站点原始标题到剪贴板</Text>
      </VStack>
      <Image systemName="chevron.right" font="caption" foregroundStyle="tertiaryLabel" />
    </HStack>
  )
}

function SystemPlayPrimaryButton({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <HStack
      spacing={12}
      frame={{ maxWidth: "infinity", minHeight: 68, alignment: "center" }}
      padding={{ horizontal: 18, vertical: 14 }}
      background="systemPink"
      clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.cardRadius }}
    >
      <Image systemName="play.tv.fill" font="title3" foregroundStyle="white" />
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="headline" fontWeight="bold" foregroundStyle="white" lineLimit={1}>{title}</Text>
        <Text font="caption" foregroundStyle="rgba(255,255,255,0.82)" lineLimit={2} multilineTextAlignment="leading">{subtitle}</Text>
      </VStack>
      <Image systemName="chevron.right" font="subheadline" foregroundStyle="rgba(255,255,255,0.86)" />
    </HStack>
  )
}

function DetailHeroCover({ url }: { url?: string }) {
  return url ? (
    <Image
      imageUrl={url}
      resizable={true}
      scaleToFill={true}
      frame={{ maxWidth: "infinity", height: 184 }}
      clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.cardRadius }}
    />
  ) : (
    <Image
      systemName="play.rectangle.fill"
      frame={{ maxWidth: "infinity", height: 184 }}
      foregroundStyle="secondaryLabel"
      background="secondarySystemBackground"
      clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.cardRadius }}
    />
  )
}

function formatDetailMeta(item: HanimeVideoItem, detail: HanimeVideoDetail | null): string {
  const studio = detail?.artist?.name || item.currentArtist
  const parts = [
    studio ? `制作：${cleanDetailMeta(studio)}` : "",
    item.duration ? `时长：${cleanDetailMeta(item.duration)}` : "",
    detail?.views || item.views ? `观看：${cleanDetailMeta(detail?.views || item.views)}` : "",
    detail?.uploadTime || item.uploadTime ? `发布：${cleanDetailMeta(detail?.uploadTime || item.uploadTime)}` : "",
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "GiriGiri"
}

function cleanDetailMeta(value?: string): string {
  return (value || "")
    .replace(/^(觀看次數|观看次数)[:：]?\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
}

const TAG_GRID_COLUMNS = [
  { size: { type: "flexible" as const, min: 0 }, spacing: 8 },
  { size: { type: "flexible" as const, min: 0 }, spacing: 8 },
  { size: { type: "flexible" as const, min: 0 } },
]

function TagGrid({ tags, onSelect }: { tags: string[]; onSelect: (tag: string) => void }) {
  return (
    <LazyVGrid columns={TAG_GRID_COLUMNS} alignment="leading" spacing={8}>
      {tags.map((tag) => (
        <Button key={tag} action={() => { onSelect(tag) }} buttonStyle="plain">
          <TagGridCell tag={tag} />
        </Button>
      ))}
    </LazyVGrid>
  )
}

function TagGridCell({ tag }: { tag: string }) {
  return (
    <Text font="caption" fontWeight="medium" lineLimit={1} foregroundStyle="label" frame={{ maxWidth: "infinity", minHeight: 34, alignment: "center" }} padding={{ horizontal: 6 }} overlay={
      <RoundedRectangle
        cornerRadius={8}
        stroke={{
          shapeStyle: "tertiaryLabel",
          strokeStyle: { lineWidth: 1, dash: [4, 3] },
        }}
      />
    }>
      #{tag}
    </Text>
  )
}

const EPISODE_GRID_COLUMNS = [
  { size: { type: "flexible" as const, min: 0 }, spacing: 8 },
  { size: { type: "flexible" as const, min: 0 }, spacing: 8 },
  { size: { type: "flexible" as const, min: 0 } },
]

function EpisodeGrid({
  episodes,
  openingSourceUrl,
  onOpen,
}: {
  episodes: HanimeVideoSource[]
  openingSourceUrl: string | null
  onOpen: (episode: HanimeVideoSource) => Promise<void>
}) {
  return (
    <VStack alignment="leading" spacing={12} padding={{ vertical: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="subheadline" fontWeight="semibold">选择剧集后直接打开 iOS 系统播放器</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={3} multilineTextAlignment="leading">
          脚本只负责解析站点播放页里的 m3u8/mp4 直链；播放、全屏与 PiP 交给系统播放器处理。
        </Text>
      </VStack>
      <SubtitleAvailability episodes={episodes} />
      <LazyVGrid columns={EPISODE_GRID_COLUMNS} alignment="leading" spacing={8}>
        {episodes.map((episode) => {
          const opening = openingSourceUrl === episode.url
          return (
            <Button key={episode.url} action={() => { void onOpen(episode) }} disabled={openingSourceUrl !== null} buttonStyle="plain">
              <EpisodeCell label={episode.label} opening={opening} />
            </Button>
          )
        })}
      </LazyVGrid>
    </VStack>
  )
}

function SubtitleAvailability({ episodes }: { episodes: HanimeVideoSource[] }) {
  const simplifiedCount = episodes.filter((episode) => shortSubtitleVersion(splitEpisodeLabel(episode.label).version) === "简中").length
  const traditionalCount = episodes.filter((episode) => shortSubtitleVersion(splitEpisodeLabel(episode.label).version) === "繁中").length
  const message = simplifiedCount === 0 && traditionalCount === 0
    ? "当前未标注简中或繁中字幕，请按剧集来源选择播放。"
    : simplifiedCount === 0
      ? "当前仅提供繁中字幕，暂无简中版本。"
      : traditionalCount === 0
        ? "当前仅提供简中字幕，暂无繁中版本。"
        : "简中与繁中字幕均有提供，请按版本选择剧集。"

  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={{ horizontal: 12, vertical: 10 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={HANIME_THEME.library.stateCardBackground}
      clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.controlRadius }}
    >
      <HStack spacing={8}>
        <Image systemName="captions.bubble.fill" font="caption" foregroundStyle="systemPink" />
        <Text font="caption" fontWeight="semibold">字幕可用性</Text>
        <SubtitleStatusBadge title="简中" count={simplifiedCount} tone="systemPink" />
        <SubtitleStatusBadge title="繁中" count={traditionalCount} tone="systemIndigo" />
      </HStack>
      <Text font="caption" foregroundStyle="secondaryLabel">{message}</Text>
    </VStack>
  )
}

function SubtitleStatusBadge({ title, count, tone }: { title: string; count: number; tone: "systemPink" | "systemIndigo" }) {
  const available = count > 0
  return (
    <Text
      font="caption2"
      fontWeight="bold"
      foregroundStyle={available ? tone : "secondaryLabel"}
      padding={{ horizontal: 6, vertical: 3 }}
      background={{ style: HANIME_THEME.library.selectedRowBackground, shape: { type: "capsule", style: "continuous" } }}
    >
      {available ? `${title} ${count} 集` : `${title} 暂无`}
    </Text>
  )
}

function EpisodeCell({ label, opening }: { label: string; opening: boolean }) {
  const { version, episode } = splitEpisodeLabel(label)
  const versionTone = subtitleVersionTone(version)

  return (
    <HStack spacing={7} frame={{ maxWidth: "infinity", minHeight: 44, alignment: "center" }} padding={{ horizontal: 8 }} background={opening ? HANIME_THEME.library.selectedRowBackground : undefined} clipShape={{ type: "rect", cornerRadius: 12 }} overlay={dashedBorder(opening)}>
      <Image systemName={opening ? "hourglass" : "play.circle.fill"} font="caption" foregroundStyle="systemPink" />
      {opening ? (
        <Text font="caption" fontWeight="semibold" foregroundStyle="systemPink" lineLimit={1}>打开中</Text>
      ) : (
        <HStack spacing={5} frame={{ maxWidth: "infinity", alignment: "center" }}>
          {version ? (
            <Text font="caption2" fontWeight="bold" foregroundStyle={versionTone} lineLimit={1} padding={{ horizontal: 5, vertical: 3 }} background={{ style: HANIME_THEME.library.selectedRowBackground, shape: { type: "capsule", style: "continuous" } }}>
              {shortSubtitleVersion(version)}
            </Text>
          ) : null}
          <Text font="caption" fontWeight="semibold" foregroundStyle="label" lineLimit={1}>{episode}</Text>
        </HStack>
      )}
    </HStack>
  )
}

function splitEpisodeLabel(label: string): { version: string; episode: string } {
  const parts = label.split(" · ")
  if (parts.length < 2) return { version: "", episode: label }
  return { version: parts.slice(0, -1).join(" · "), episode: parts[parts.length - 1] }
}

function shortSubtitleVersion(value: string): string {
  const normalized = value.replace(/\s+/g, "")
  if (/(繁|繁体|繁中|big5|traditional)/i.test(normalized)) return "繁中"
  if (/(简|簡|简体|簡體|简中|簡中|gb|simplified)/i.test(normalized)) return "简中"
  return value.length > 5 ? value.slice(0, 5) : value
}

function subtitleVersionTone(value: string): "systemPink" | "systemIndigo" | "secondaryLabel" {
  const short = shortSubtitleVersion(value)
  if (short === "繁中") return "systemIndigo"
  if (short === "简中") return "systemPink"
  return "secondaryLabel"
}


function dashedBorder(active: boolean = false) {
  return (
    <RoundedRectangle
      cornerRadius={10}
      stroke={{
        shapeStyle: active ? "systemPink" : "tertiaryLabel",
        strokeStyle: { lineWidth: active ? 1.5 : 1, dash: active ? undefined : [4, 3] },
      }}
    />
  )
}

function TagSearchView({ tag }: { tag: string }) {
  const [results, setResults] = useState<HanimeVideoItem[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadTagResults(1)
  }, [tag])

  async function loadTagResults(nextPage: number) {
    try {
      setLoading(true)
      setError(null)
      setPage(nextPage)
      const data = await hanimeClient.searchVideos({
        page: nextPage,
        sort: "time",
        tags: [tag],
      })
      setResults((current) => nextPage === 1 ? data : mergeVideoItems(current, data))
    } catch (searchError) {
      console.error("GiriGiri 标签搜索失败:", searchError)
      setError(`${searchError}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <List listStyle="inset" navigationTitle={`#${tag}`}>
      <Section>
        <HanimeHeroCard
          eyebrow="TAG · DISCOVERY"
          title={`#${tag}`}
          subtitle="按最新浏览同标签内容，结果会在本页累积加载。"
          stats={[{ title: "结果", value: `${results.length} 部`, icon: "tag.fill" }]}
          actions={<HanimeActionPill title={loading ? "搜索中" : "刷新结果"} systemImage="arrow.clockwise" action={() => { void loadTagResults(1) }} disabled={loading} />}
        />
      </Section>

      {error ? (
        <Section>
          <ErrorState message={error} onRetry={() => { void loadTagResults(page) }} />
        </Section>
      ) : null}

      {loading && results.length === 0 ? (
        <Section>
          <LoadingState message={`正在搜索 #${tag}...`} />
        </Section>
      ) : null}

      {results.length > 0 ? (
        <Section title={`结果 · 已加载 ${page} 页 · ${results.length} 部`}>
          {results.map((result) => (
            <NavigationLink key={result.videoCode} destination={<VideoDetailView video={result} />}>
              <HanimeVideoRow video={result} />
            </NavigationLink>
          ))}
          <Button action={() => { void loadTagResults(page + 1) }} disabled={loading}>
            <Label title={loading ? "加载中" : "加载下一页"} systemImage="arrow.down.circle" />
          </Button>
        </Section>
      ) : null}

      {!loading && !error && results.length === 0 ? (
        <Section>
          <EmptyState
            icon="tag"
            title="没有找到标签结果"
            message="可能暂无该标签内容，或需要先完成官网验证。"
          />
        </Section>
      ) : null}
    </List>
  )
}

function mergeVideoItems(current: HanimeVideoItem[], next: HanimeVideoItem[]): HanimeVideoItem[] {
  const byCode = new Map<string, HanimeVideoItem>()
  for (const item of current) byCode.set(item.videoCode, item)
  for (const item of next) byCode.set(item.videoCode, item)
  return Array.from(byCode.values())
}

function toVideoItem(detail: HanimeVideoDetail): HanimeVideoItem {
  const code = extractVideoCode(detail.watchUrl) || extractVideoCode(detail.videoUrls[0]?.url) || ""
  return {
    title: detail.title,
    coverUrl: detail.coverUrl,
    videoCode: code,
    views: detail.views,
    uploadTime: detail.uploadTime,
    currentArtist: detail.artist?.name,
  }
}
