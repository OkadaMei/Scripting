import { HStack, Image, Text, VStack } from "scripting"
import { usePlayerState } from "../../class/player_state"

export function Title() {
  const { currentMusic, queue, currentIndex } = usePlayerState()
  const upcomingCount = queue.length === 0 ? 0 : Math.max(queue.length - Math.max(currentIndex, 0) - 1, 0)

  return (
    <VStack
      alignment="leading"
      spacing={10}
      padding={18}
      background={{
        style: {
          colors: ["rgba(255,255,255,0.14)", "rgba(255,255,255,0.05)"],
          startPoint: "topLeading",
          endPoint: "bottomTrailing",
        },
        shape: { type: "rect", cornerRadius: 24 },
      }}
      overlay={{
        alignment: "topLeading",
        content: (
          <HStack spacing={8} padding={{ top: 14, leading: 14 }}>
            <Image systemName="waveform.badge.music.note" font="caption" tint="rgba(255,255,255,0.7)" />
            <Text font="caption" foregroundStyle="rgba(255,255,255,0.7)">
              NOW PLAYING
            </Text>
          </HStack>
        ),
      }}
    >
      <VStack alignment="leading" spacing={6} padding={{ top: 22 }}>
        <Text font={28} fontWeight="bold" lineLimit={2} foregroundStyle="white">
          {currentMusic?.title ?? "未在播放"}
        </Text>
        <Text font="headline" foregroundStyle="rgba(255,255,255,0.72)" lineLimit={1}>
          {currentMusic?.artist ?? "导入一首音乐开始体验"}
        </Text>
        <Text font="footnote" foregroundStyle="rgba(255,255,255,0.5)" lineLimit={1}>
          {currentMusic?.album ?? "本地音乐播放器"}
        </Text>
      </VStack>

      <HStack spacing={8}>
        <MetaChip
          icon="music.note"
          label={currentMusic?.album?.trim() ? currentMusic.album : "本地音乐"}
        />
        <MetaChip
          icon="list.bullet"
          label={upcomingCount > 0 ? `待播 ${upcomingCount} 首` : "队列已到底"}
        />
      </HStack>
    </VStack>
  )
}

function MetaChip({ icon, label }: { icon: string; label: string }) {
  return (
    <HStack
      spacing={6}
      padding={{ horizontal: 10, vertical: 7 }}
      background="rgba(255,255,255,0.08)"
      clipShape="capsule"
    >
      <Image systemName={icon} font="caption" tint="rgba(255,255,255,0.72)" />
      <Text font="caption" foregroundStyle="rgba(255,255,255,0.72)" lineLimit={1}>
        {label}
      </Text>
    </HStack>
  )
}
