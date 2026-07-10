import { Image, Rectangle, Text, VStack, ZStack, useEffect, useState } from "scripting"
import { usePlayerState } from "../../class/player_state"
import { fileManager } from "../../class/file_manager"

export function Cover() {
  const { currentMusic } = usePlayerState()
  const [coverError, setCoverError] = useState(false)
  const [localCoverPath, setLocalCoverPath] = useState<string | null>(null)

  useEffect(() => {
    setCoverError(false)
    if (!currentMusic) {
      setLocalCoverPath(null)
      return
    }

    const musicId = currentMusic.id
    let cancelled = false

    async function resolveLocalCover() {
      const exists = await fileManager.coverExists(musicId)
      if (!cancelled) {
        setLocalCoverPath(exists ? fileManager.getCoverPath(musicId) : null)
      }
    }

    resolveLocalCover()
    return () => {
      cancelled = true
    }
  }, [currentMusic?.id])

  const fallback = (
    <ZStack>
      <Rectangle fill={{
        colors: ["rgba(255,255,255,0.12)", "rgba(255,255,255,0.04)"],
        startPoint: "topLeading",
        endPoint: "bottomTrailing",
      }} />
      <VStack spacing={10}>
        <Image
          systemName="music.note"
          font={64}
          foregroundStyle="rgba(255,255,255,0.78)"
          symbolRenderingMode="monochrome"
        />
        <Text font="subheadline" foregroundStyle="rgba(255,255,255,0.58)">
          暂无封面
        </Text>
      </VStack>
    </ZStack>
  )

  if (localCoverPath) {
    return <Image filePath={localCoverPath} resizable={true} scaleToFill={true} />
  }

  if (currentMusic?.cover_url && !coverError) {
    return (
      <Image
        imageUrl={currentMusic.cover_url}
        resizable={true}
        scaleToFill={true}
        onError={() => setCoverError(true)}
        placeholder={fallback}
      />
    )
  }

  return fallback
}
