import { HStack, Image, Text, VStack } from "scripting"

export function LargeWidget() {
  return (
    <VStack alignment="leading" spacing={16} padding={18} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <HStack spacing={8}>
        <Image systemName="play.rectangle.fill" font={24} foregroundStyle="systemPink" />
        <Text font="headline" fontWeight="bold" foregroundStyle="systemPink">GiriGiri</Text>
      </HStack>
      <VStack spacing={8} frame={{ maxWidth: "infinity", height: 120 }} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 20 }}>
        <Image systemName="film.stack.fill" font={36} foregroundStyle="systemPink" />
        <Text font="caption" foregroundStyle="secondaryLabel">ANIME BROWSER</Text>
      </VStack>
      <VStack alignment="leading" spacing={6}>
        <Text font="title3" fontWeight="bold" lineLimit={2}>公开分区、搜索与观看记录</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={3}>
          打开脚本继续浏览番剧、管理收藏历史并调用 iOS 系统播放器观看。
        </Text>
      </VStack>
    </VStack>
  )
}