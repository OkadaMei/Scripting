import { HStack, Image, Text, VStack } from "scripting"

export function MediumWidget() {
  return (
    <HStack spacing={14} padding={16} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <VStack spacing={8} frame={{ width: 82, height: 96 }} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 18 }}>
        <Image systemName="film.stack.fill" font={26} foregroundStyle="systemPink" />
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>ANIME</Text>
      </VStack>
      <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
        <Text font="headline" foregroundStyle="systemPink" lineLimit={1} fontWeight="bold">GiriGiri</Text>
        <Text font="headline" lineLimit={2}>动漫内容浏览器</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>
          首页分区、搜索建议、收藏历史和系统播放。
        </Text>
      </VStack>
    </HStack>
  )
}