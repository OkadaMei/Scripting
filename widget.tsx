import { HStack, Image, Spacer, Text, VStack, Widget } from "scripting"
import { hanimeDatabase, HanimeStats } from "./class/hanime_database"

const EMPTY_STATS: HanimeStats = { favorites: 0, history: 0, downloads: 0 }

async function main() {
  const stats = await loadStats()
  Widget.present(<WidgetView stats={stats} />)
}

async function loadStats(): Promise<HanimeStats> {
  try {
    await hanimeDatabase.init()
    return await hanimeDatabase.getStats()
  } catch (error) {
    console.error("GiriGiri widget stats failed:", error)
    return EMPTY_STATS
  }
}

function WidgetView({ stats }: { stats: HanimeStats }) {
  if (Widget.family === "systemSmall") return <SmallHanimeWidget stats={stats} />
  if (Widget.family === "systemLarge") return <LargeHanimeWidget stats={stats} />
  return <MediumHanimeWidget stats={stats} />
}

function SmallHanimeWidget({ stats }: { stats: HanimeStats }) {
  return (
    <VStack alignment="leading" spacing={10} padding={14} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <BrandHeader compact />
      <Spacer />
      <Text font="headline" fontWeight="bold" lineLimit={2}>GiriGiri 片库</Text>
      <VStack alignment="leading" spacing={4}>
        <Text font="caption" foregroundStyle="secondaryLabel">收藏 {stats.favorites} 部</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">历史 {stats.history} 部</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">记录 {stats.downloads} 项</Text>
      </VStack>
    </VStack>
  )
}

function MediumHanimeWidget({ stats }: { stats: HanimeStats }) {
  return (
    <HStack spacing={14} padding={16} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <PosterMark />
      <VStack alignment="leading" spacing={10} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
        <BrandHeader />
        <Text font="headline" fontWeight="bold" lineLimit={2}>浏览、搜索、收藏与系统播放</Text>
        <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
          <WidgetStat title="收藏" value={stats.favorites} />
          <WidgetStat title="历史" value={stats.history} />
          <WidgetStat title="记录" value={stats.downloads} />
        </HStack>
      </VStack>
    </HStack>
  )
}

function LargeHanimeWidget({ stats }: { stats: HanimeStats }) {
  return (
    <VStack alignment="leading" spacing={16} padding={18} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "leading" }}>
      <BrandHeader />
      <PosterMark large />
      <VStack alignment="leading" spacing={6}>
        <Text font="title3" fontWeight="bold" lineLimit={2}>GiriGiri 动漫片库</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2}>
          打开脚本继续浏览公开分区、搜索标签、管理收藏和观看历史。
        </Text>
      </VStack>
      <HStack spacing={10} frame={{ maxWidth: "infinity" }}>
        <WidgetStat title="收藏" value={stats.favorites} />
        <WidgetStat title="历史" value={stats.history} />
        <WidgetStat title="记录" value={stats.downloads} />
      </HStack>
    </VStack>
  )
}

function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <HStack spacing={8}>
      <Image systemName="play.rectangle.fill" font={compact ? 18 : 22} foregroundStyle="systemPink" />
      <Text font={compact ? "caption" : "headline"} fontWeight="bold" foregroundStyle="systemPink" lineLimit={1}>GiriGiri</Text>
      <Spacer />
    </HStack>
  )
}

function PosterMark({ large = false }: { large?: boolean }) {
  return (
    <VStack spacing={8} frame={{ width: large ? 120 : 82, height: large ? 92 : 96 }} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 18 }}>
      <Image systemName="film.stack.fill" font={large ? 30 : 26} foregroundStyle="systemPink" />
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>ANIME</Text>
    </VStack>
  )
}

function WidgetStat({ title, value }: { title: string; value: number }) {
  return (
    <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }} padding={{ horizontal: 10, vertical: 8 }} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 14 }}>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{title}</Text>
      <Text font="headline" fontWeight="bold" lineLimit={1}>{value}</Text>
    </VStack>
  )
}

main()
