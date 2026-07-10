import { HStack, Image, Text, VStack, useState, useEffect } from "scripting"
import { usePlayerState } from "../../class/player_state"
import { fileManager } from "../../class/file_manager"

export function PlayerInfo() {
  const { currentMusic } = usePlayerState()
  const [localCover, setLocalCover] = useState<UIImage | null>(null)
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    if (!currentMusic) {
      setLocalCover(null)
      setResolved(false)
      return
    }
    setLocalCover(null)
    setResolved(false)
    let cancelled = false
    async function resolve() {
      if (currentMusic!.is_downloaded) {
        const path = fileManager.getCoverPath(currentMusic!.id)
        const img = UIImage.fromFile(path)
        if (!cancelled) {
          setLocalCover(img)
          setResolved(true)
        }
      } else {
        if (!cancelled) setResolved(true)
      }
    }
    resolve()
    return () => { cancelled = true }
  }, [currentMusic?.id])

  if (!currentMusic) return (
    <HStack spacing={10}>
      <Image
        systemName="music.note"
        frame={{ width: 42, height: 42 }}
        foregroundStyle="secondaryLabel"
        background="secondarySystemFill"
        clipShape={{ type: "rect", cornerRadius: 10 }}
      />
      <VStack alignment="leading" spacing={2}>
        <Text font="subheadline" bold={true}>未在播放</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">选择一首歌曲开始</Text>
      </VStack>
    </HStack>
  )

  const placeholder = (
    <Image
      systemName="music.note"
      frame={{ width: 42, height: 42 }}
      foregroundStyle="secondaryLabel"
      background="secondarySystemFill"
      clipShape={{ type: "rect", cornerRadius: 10 }}
    />
  )

  let coverView: JSX.Element
  if (!resolved) {
    coverView = placeholder
  } else if (localCover) {
    coverView = (
      <Image
        image={localCover}
        resizable={true}
        frame={{ width: 42, height: 42 }}
        clipShape={{ type: "rect", cornerRadius: 10 }}
      />
    )
  } else if (currentMusic.cover_url) {
    coverView = (
      <Image
        key={currentMusic.cover_url}
        imageUrl={currentMusic.cover_url}
        resizable={true}
        frame={{ width: 42, height: 42 }}
        clipShape={{ type: "rect", cornerRadius: 10 }}
        onError={() => setResolved(false)}
        placeholder={placeholder}
      />
    )
  } else {
    coverView = placeholder
  }

  return (
    <HStack spacing={10}>
      {coverView}
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: 150 }}>
        <Text font="subheadline" bold={true} lineLimit={1}>{currentMusic.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{currentMusic.artist}</Text>
      </VStack>
    </HStack>
  )
}
