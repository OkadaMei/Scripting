import { HStack, Image, Text, VStack } from "scripting"
import { HanimeVideoItem } from "../../class/hanime"

const ROW_COVER_WIDTH = 76
const ROW_COVER_HEIGHT = 48

export function HanimeVideoRow({ video, accessory }: { video: HanimeVideoItem; accessory?: JSX.Element }) {
  const title = normalizeVideoTitle(video.title) || "未命名视频"
  const meta = formatVideoMeta(video)
  const stats = formatVideoStats(video)

  return (
    <HStack alignment="top" spacing={12} padding={{ vertical: 8 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <VideoCover url={video.coverUrl} width={ROW_COVER_WIDTH} height={ROW_COVER_HEIGHT} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="subheadline" fontWeight="semibold" lineLimit={2} multilineTextAlignment="leading">{title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading">
          {meta}
        </Text>
        {stats ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel" lineLimit={1} multilineTextAlignment="leading">{stats}</Text>
        ) : null}
      </VStack>
      {accessory ? (
        <VStack alignment="trailing" spacing={4} frame={{ minWidth: 44 }}>
          {accessory}
        </VStack>
      ) : null}
    </HStack>
  )
}

export function VideoCover({ url, size = 64, width, height }: { url?: string; size?: number; width?: number; height?: number }) {
  const coverWidth = width ?? size
  const coverHeight = height ?? Math.round(size * 0.66)

  return url ? (
    <Image
      imageUrl={url}
      resizable={true}
      scaleToFill={true}
      frame={{ width: coverWidth, height: coverHeight }}
      clipShape={{ type: "rect", cornerRadius: 10 }}
    />
  ) : (
    <Image
      systemName="play.rectangle.fill"
      frame={{ width: coverWidth, height: coverHeight }}
      foregroundStyle="secondaryLabel"
      background="secondarySystemBackground"
      clipShape={{ type: "rect", cornerRadius: 10 }}
    />
  )
}

export function normalizeVideoTitle(value?: string): string {
  return cleanVideoText(value)
    .replace(/([\u3040-\u30ff\u3400-\u9fff])\s+([\u3040-\u30ff\u3400-\u9fff])/g, "$1$2")
    .replace(/\s+([、。，．！？!?：；])/g, "$1")
    .replace(/([（「『【［《([{])\s+/g, "$1")
    .replace(/\s+([）」』】］》)\]}])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/ ([([{])/g, "\u00A0$1")
    .trim()
}

export function formatVideoMeta(video: HanimeVideoItem): string {
  const meta = [video.currentArtist, video.duration, video.uploadTime]
    .map(cleanVideoText)
    .filter(Boolean)
  return meta.length > 0 ? meta.join(" · ") : "GiriGiri"
}

function formatVideoStats(video: HanimeVideoItem): string {
  return [formatViews(video.views), formatReviews(video.reviews)].filter(Boolean).join(" · ")
}

function formatViews(value?: string): string {
  const text = cleanVideoText(value)
  return text.replace(/^(觀看次數|观看次数)[:：]?\s*/, "")
}

function formatReviews(value?: string): string {
  const text = cleanVideoText(value)
  const percent = text.match(/\d+(?:\.\d+)?%/)
  return percent ? `好评 ${percent[0]}` : text
}

function cleanVideoText(value?: string): string {
  if (!value) return ""
  const text = value
    .replace(/\b(?:play_arrow|thumb_up|visibility|favorite|favorite_border|schedule|access_time)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return /^(播放|觀看|观看|更多|GiriGiri)$/i.test(text) ? "" : text
}
