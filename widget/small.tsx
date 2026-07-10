import { Image, Spacer, Text, VStack } from "scripting"

export function SmallWidget() {
  return (
    <VStack alignment="leading" spacing={10} padding={14} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <Image systemName="play.rectangle.fill" font={24} foregroundStyle="systemPink" />
      <Spacer />
      <Text font="headline" fontWeight="bold" lineLimit={2}>GiriGiri</Text>
      <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>
        浏览、搜索、收藏与系统播放。
      </Text>
    </VStack>
  )
}