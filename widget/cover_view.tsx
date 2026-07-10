import { Image, ZStack, Rectangle } from "scripting"
import { NowPlayingData } from "./types"

export function CoverView({ data, size }: { data: NowPlayingData | null; size: number }) {
  const radius = size * 0.18
  if (data?.cover_path) {
    return (
      <Image
        filePath={data.cover_path}
        resizable
        scaleToFill
        frame={{ width: size, height: size }}
        clipShape={{ type: "rect", cornerRadius: radius }}
      />
    )
  }
  return (
    <ZStack
      frame={{ width: size, height: size }}
      clipShape={{ type: "rect", cornerRadius: radius }}
    >
      <Rectangle fill="systemPink" opacity={0.15} />
      <Image systemName="music.note" font={size * 0.38} foregroundStyle="systemPink" />
    </ZStack>
  )
}