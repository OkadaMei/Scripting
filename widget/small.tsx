import { HStack, Image, Spacer, Text, VStack } from "scripting"
import { bangumiAccent, bangumiCard, bangumiMutedCard } from "../page/bangumi/data"
import { WidgetShell } from "./components"
import type { BangumiWidgetData } from "./types"

export function SmallWidget({ data }: { data: BangumiWidgetData }) {
  const title = data.primary?.title ?? data.emptyTitle
  const subtitle = data.primary?.progress ?? data.sourceLabel

  return (
    <WidgetShell openURL={data.openURL} padding={10} spacing={5}>
      <HStack spacing={6} frame={{ maxWidth: "infinity", alignment: "center" }}>
        <VStack
          alignment="center"
          frame={{ width: 22, height: 22 }}
          background={bangumiAccent}
          clipShape={{ type: "rect", cornerRadius: 8 }}
        >
          <Image systemName="sparkles" font={10} foregroundStyle="white" />
        </VStack>
        <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="caption" fontWeight="semibold" lineLimit={1}>Bangumi</Text>
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{data.updatedAtLabel}</Text>
        </VStack>
        <Text font="caption2" fontWeight="semibold" foregroundStyle={data.sourceState === "remote" ? "#34C759" : (bangumiAccent as never)} lineLimit={1}>{data.sourceState === "remote" ? "同步" : data.sourceLabel}</Text>
      </HStack>

      <HStack spacing={7} frame={{ maxWidth: "infinity", alignment: "center" }}>
        <Text font="title" fontWeight="bold" lineLimit={1}>{data.watchingCount}</Text>
        <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="caption" fontWeight="semibold" lineLimit={1}>在看 / 在读</Text>
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>今日 {data.todayCount}</Text>
        </VStack>
        <Spacer />
      </HStack>

      <VStack
        alignment="leading"
        spacing={2}
        padding={{ horizontal: 8, vertical: 7 }}
        background={data.primary ? bangumiCard : bangumiMutedCard}
        clipShape={{ type: "rect", cornerRadius: 13 }}
        frame={{ maxWidth: "infinity", alignment: "leading" }}
      >
        <Text font="caption2" fontWeight="semibold" foregroundStyle={bangumiAccent} lineLimit={1}>{data.primary ? "继续追踪" : data.sourceLabel}</Text>
        <Text font="caption" fontWeight="bold" lineLimit={1}>{title}</Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{subtitle}</Text>
      </VStack>
    </WidgetShell>
  )
}
