import { Button, HStack, Image, Spacer, Text, useState, VStack } from "scripting"
import { usePlayerState } from "../../class/player_state"
import { player } from "../../class/player"
import { PlayMode } from "../../class/player"
import { QueueSheet } from "./queue"

const PLAY_MODE_ICONS: Record<PlayMode, string> = {
  "sequential": "arrow.right",
  "repeat-all": "repeat",
  "repeat-one": "repeat.1",
  "shuffle": "shuffle",
}

const PLAY_MODE_ORDER: PlayMode[] = ["sequential", "repeat-all", "repeat-one", "shuffle"]

export function Control() {
  const { isPlaying, playMode, queue, currentIndex } = usePlayerState()
  const [showQueue, setShowQueue] = useState(false)
  const loops = playMode === "repeat-all" || playMode === "shuffle"
  const hasPrev = loops || currentIndex > 0
  const hasNext = loops || currentIndex < queue.length - 1

  function cyclePlayMode() {
    const idx = PLAY_MODE_ORDER.indexOf(playMode)
    player.setPlayMode(PLAY_MODE_ORDER[(idx + 1) % PLAY_MODE_ORDER.length])
  }

  return (
    <VStack
      spacing={18}
      padding={18}
      background={{
        style: {
          colors: ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.06)"],
          startPoint: "topLeading",
          endPoint: "bottomTrailing",
        },
        shape: { type: "rect", cornerRadius: 28 },
      }}
      sheet={{
        isPresented: showQueue,
        onChanged: setShowQueue,
        content: <QueueSheet />,
      }}
    >
      <HStack>
        <Button action={cyclePlayMode} tint={playMode === "sequential" ? "rgba(255,255,255,0.55)" : "systemPink"}>
          <HStack spacing={8} padding={{ horizontal: 12, vertical: 8 }} background="rgba(255,255,255,0.08)" clipShape="capsule">
            <Image systemName={PLAY_MODE_ICONS[playMode]} font="footnote" />
            <Text font="footnote" foregroundStyle="white">{playModeLabel(playMode)}</Text>
          </HStack>
        </Button>
        <Spacer />
        <Button action={() => setShowQueue(true)} tint="white">
          <HStack spacing={8} padding={{ horizontal: 12, vertical: 8 }} background="rgba(255,255,255,0.08)" clipShape="capsule">
            <Image systemName="list.bullet" font="footnote" />
            <Text font="footnote" foregroundStyle="white">队列</Text>
          </HStack>
        </Button>
      </HStack>

      <HStack spacing={18} frame={{ maxWidth: "infinity" }}>
        <Button action={() => player.previous()} disabled={!hasPrev} frame={{ maxWidth: "infinity" }}>
          <HStack padding={{ vertical: 12 }} background="rgba(255,255,255,0.08)" clipShape="capsule">
            <Spacer />
            <Image systemName="backward.fill" font="title3" tint="white" />
            <Spacer />
          </HStack>
        </Button>

        <Button action={() => { isPlaying ? player.pause() : player.play() }}>
          <HStack
            frame={{ width: 84, height: 84 }}
            background={{
              colors: ["#ff5fa2", "#ff2d55"],
              startPoint: "topLeading",
              endPoint: "bottomTrailing",
            }}
            clipShape="circle"
            shadow={{ color: "rgba(255,45,85,0.42)", radius: 16, y: 8 }}
          >
            <Spacer />
            <Image systemName={isPlaying ? "pause.fill" : "play.fill"} font={30} tint="white" />
            <Spacer />
          </HStack>
        </Button>

        <Button action={() => player.next()} disabled={!hasNext} frame={{ maxWidth: "infinity" }}>
          <HStack padding={{ vertical: 12 }} background="rgba(255,255,255,0.08)" clipShape="capsule">
            <Spacer />
            <Image systemName="forward.fill" font="title3" tint="white" />
            <Spacer />
          </HStack>
        </Button>
      </HStack>
    </VStack>
  )
}

function playModeLabel(playMode: PlayMode): string {
  switch (playMode) {
    case "repeat-all": return "循环"
    case "repeat-one": return "单曲"
    case "shuffle": return "随机"
    default: return "顺序"
  }
}
