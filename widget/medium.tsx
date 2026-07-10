import { HStack, VStack } from "scripting"
import { bangumiAccent } from "../page/bangumi/data"
import { BrandHeader, EmptyPanel, MetricPill, MiniStatusGrid, PrimarySubjectCard, WidgetShell } from "./components"
import type { BangumiWidgetData } from "./types"

export function MediumWidget({ data }: { data: BangumiWidgetData }) {
  return (
    <WidgetShell openURL={data.openURL} padding={11} spacing={7}>
      <BrandHeader data={data} compact={true} />
      <HStack alignment="top" spacing={8} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>
        <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>
          {data.primary ? <PrimarySubjectCard subject={data.primary} compact={true} /> : <EmptyPanel data={data} compact={true} />}
          <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
            <MetricPill icon="arrow.triangle.2.circlepath" label={data.updatedAtLabel} />
            <MetricPill icon="bell.fill" label={data.noticeLabel} accent={data.noticeLabel === "无未读" ? undefined : bangumiAccent} />
          </HStack>
        </VStack>
        <VStack alignment="leading" spacing={6} frame={{ width: 118, alignment: "topLeading" }}>
          <MiniStatusGrid data={data} />
        </VStack>
      </HStack>
    </WidgetShell>
  )
}
