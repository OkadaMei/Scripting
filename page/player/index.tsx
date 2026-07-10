import { Capsule, HStack, Image, Spacer, Text, VStack, ZStack, modifiers } from "scripting"
import { Cover } from "./cover"
import { Title } from "./title"
import { ProgressSlider } from "./slider"
import { Control } from "./control"
import { Lyric } from "./lyric"
import { PlayerProgressProvider, usePlayerState } from "../../class/player_state"

export function PlayerView() {
  return <PlayerProgressProvider><PlayerPage /></PlayerProgressProvider>
}

function PlayerPage() {
  const { currentMusic } = usePlayerState()

  return (
    <ZStack>
      <BackgroundAura />
      <VStack modifiers={modifiers().padding({ leading: true, trailing: true })}>
        <Capsule
          fill="rgba(255,255,255,0.35)"
          frame={{ width: 42, height: 5 }}
          padding={{ top: 10, bottom: 18 }}
        />

        <HStack padding={{ bottom: 14 }}>
          <VStack alignment="leading" spacing={4}>
            <Text font="largeTitle" fontWeight="bold" foregroundStyle="white">正在播放</Text>
            <Text font="subheadline" foregroundStyle="rgba(255,255,255,0.62)">
              {currentMusic ? "沉浸式本地聆听体验" : "选择一首本地音乐开始播放"}
            </Text>
          </VStack>
          <Spacer />
          <VStack
            frame={{ width: 40, height: 40 }}
            background="rgba(255,255,255,0.08)"
            clipShape="circle"
          >
            <Spacer />
            <Image systemName="sparkles" font="title3" tint="rgba(255,255,255,0.7)" />
            <Spacer />
          </VStack>
        </HStack>

        <Cover
          frame={{ maxWidth: "infinity", maxHeight: 320 }}
          clipShape={{ type: "rect", cornerRadius: 28 }}
          shadow={{ color: "rgba(0,0,0,0.28)", radius: 18, y: 10 }}
          padding={{ bottom: 22 }}
        />

        <Title padding={{ bottom: 18 }} />

        <VStack spacing={16}>
          <ProgressSlider />
          <Lyric padding={{ top: 2, bottom: 2 }} />
          <Control padding={{ bottom: 8 }} />
        </VStack>

        <Spacer minLength={10} />
      </VStack>
    </ZStack>
  )
}

function BackgroundAura() {
  return (
    <ZStack>
      <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={{
        colors: ["#120714", "#24112c", "#0a0a12"],
        startPoint: "topLeading",
        endPoint: "bottomTrailing",
      }} />
      <VStack
        frame={{ width: 320, height: 320 }}
        background={{
          colors: ["rgba(255,45,85,0.46)", "rgba(255,45,85,0.02)"],
          startPoint: "top",
          endPoint: "bottom",
        }}
        blur={48}
        clipShape="circle"
        offset={{ x: -90, y: -220 }}
      />
      <VStack
        frame={{ width: 280, height: 280 }}
        background={{
          colors: ["rgba(158,108,255,0.36)", "rgba(158,108,255,0.02)"],
          startPoint: "top",
          endPoint: "bottom",
        }}
        blur={42}
        clipShape="circle"
        offset={{ x: 120, y: -30 }}
      />
    </ZStack>
  )
}
