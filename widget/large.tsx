import { HStack, Text, VStack } from "scripting"
import { bangumiAccent } from "../page/bangumi/data"
import { BrandHeader, EmptyLine, EmptyPanel, MetricPill, PrimarySubjectCard, StatGrid, TodayCompactList, TopicRow, WidgetShell } from "./components"
import type { BangumiWidgetData } from "./types"

export function LargeWidget({ data }: { data: BangumiWidgetData }) {
  const topic = data.topics[0]

  return (
    <WidgetShell openURL={data.openURL} padding={12} spacing={8}>
      <BrandHeader data={data} />
      <StatGrid data={data} compact={true} />
      <HStack alignment="top" spacing={9} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>
        <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity", alignment: "topLeading" }}>
          {data.primary ? <PrimarySubjectCard subject={data.primary} compact={true} /> : <EmptyPanel data={data} compact={true} />}
          <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
            <MetricPill icon="bell.fill" label={data.noticeLabel} accent={data.noticeLabel === "无未读" ? undefined : bangumiAccent} />
            <MetricPill icon="person.crop.circle" label={data.accountLabel} />
          </HStack>
        </VStack>
        <VStack alignment="leading" spacing={6} frame={{ width: 138, alignment: "topLeading" }}>
          <Text font="caption2" fontWeight="semibold" foregroundStyle={bangumiAccent} lineLimit={1}>今日放送</Text>
          <TodayCompactList data={data} limit={2} />
        </VStack>
      </HStack>
      <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="caption2" fontWeight="semibold" foregroundStyle={bangumiAccent} lineLimit={1}>社区动态</Text>
        {topic ? <TopicRow topic={topic} /> : <EmptyLine icon="bubble.left.and.bubble.right" text="超展开暂无可展示话题" />}
      </VStack>

    </WidgetShell>
  )
}
