import { HStack, Image, Spacer, Text, VStack, Widget, ZStack } from "scripting"
import {
  bangumiAccent,
  bangumiAccentSoftBackground,
  bangumiCard,
  bangumiHeroBackground,
  bangumiLink,
  bangumiLinkSoftBackground,
  bangumiMutedCard,
  bangumiScoreBackground,
} from "../page/bangumi/data"
import type { BangumiWidgetData, BangumiWidgetSourceState, BangumiWidgetSubject, BangumiWidgetTopic } from "./types"

export function WidgetShell({
  children,
  openURL,
  padding = 12,
  spacing = 8,
}: {
  children: JSX.Element | JSX.Element[]
  openURL: string
  padding?: number
  spacing?: number
}) {
  const size = Widget.displaySize
  const widgetFill = {
    style: bangumiHeroBackground,
    shape: { type: "rect" as const, cornerRadius: 0 },
  }

  return (
    <ZStack
      frame={{ width: size.width, height: size.height }}
      widgetURL={openURL}
      widgetBackground={widgetFill}
      background={widgetFill}
      ignoresSafeArea={{ edges: "all" }}
      contentMargins={{ edges: "all", insets: 0, placement: "automatic" }}
    >
      <VStack
        alignment="leading"
        spacing={spacing}
        padding={padding}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}
      >
        {children}
      </VStack>
    </ZStack>
  )
}

export function BrandHeader({ data, compact = false }: { data: BangumiWidgetData; compact?: boolean }) {
  return (
    <HStack spacing={7} frame={{ maxWidth: "infinity", alignment: "center" }}>
      <VStack
        alignment="center"
        frame={{ width: compact ? 24 : 26, height: compact ? 24 : 26 }}
        background={bangumiAccent}
        clipShape={{ type: "rect", cornerRadius: compact ? 8 : 9 }}
      >
        <Image systemName="sparkles" font={compact ? 11 : 12} foregroundStyle="white" />
      </VStack>
      <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font={compact ? "caption" : "subheadline"} fontWeight="semibold" lineLimit={1}>Bangumi</Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{data.todayLabel}</Text>
      </VStack>
      <SourceBadge state={data.sourceState} label={data.sourceLabel} compact={compact} />
    </HStack>
  )
}

export function SourceBadge({ state, label, compact = false }: { state: BangumiWidgetSourceState; label: string; compact?: boolean }) {
  const color = state === "remote" ? "#34C759" : state === "partial" ? bangumiLink : state === "empty" ? "secondaryLabel" : "#FF9500"
  const icon = state === "remote" ? "checkmark.circle.fill" : state === "partial" ? "clock.arrow.circlepath" : state === "empty" ? "person.crop.circle.badge.plus" : "exclamationmark.triangle.fill"
  return (
    <HStack
      spacing={3}
      padding={{ horizontal: compact ? 6 : 7, vertical: compact ? 3 : 4 }}
      background={state === "remote" ? "rgba(52,199,89,0.14)" : state === "partial" ? bangumiLinkSoftBackground : bangumiMutedCard}
      clipShape={{ type: "capsule", style: "continuous" }}
    >
      <Image systemName={icon} font={compact ? 8 : 9} foregroundStyle={color as never} />
      <Text font="caption2" fontWeight="medium" foregroundStyle={color as never} lineLimit={1}>{label}</Text>
    </HStack>
  )
}

export function MetricPill({ icon, label, accent }: { icon: string; label: string; accent?: string }) {
  return (
    <HStack
      spacing={4}
      padding={{ horizontal: 7, vertical: 4 }}
      background={accent ? (`${accent}18` as never) : bangumiMutedCard}
      clipShape={{ type: "capsule", style: "continuous" }}
    >
      <Image systemName={icon} font={9} foregroundStyle={(accent ?? "secondaryLabel") as never} />
      <Text font="caption2" fontWeight="medium" foregroundStyle={(accent ?? "secondaryLabel") as never} lineLimit={1}>{label}</Text>
    </HStack>
  )
}

export function PrimarySubjectCard({ subject, compact = false }: { subject: BangumiWidgetSubject; compact?: boolean }) {
  return (
    <HStack
      alignment="top"
      spacing={compact ? 8 : 10}
      padding={compact ? 9 : 10}
      background={bangumiCard}
      clipShape={{ type: "rect", cornerRadius: compact ? 15 : 17 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
    >
      <WidgetPoster subject={subject} width={compact ? 38 : 46} height={compact ? 52 : 62} />
      <VStack alignment="leading" spacing={compact ? 3 : 4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="caption2" fontWeight="semibold" foregroundStyle={bangumiAccent} lineLimit={1}>继续追踪</Text>
        <Text font={compact ? "subheadline" : "headline"} fontWeight="bold" lineLimit={compact ? 1 : 2}>{subject.title}</Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{subject.progress}</Text>
        <HStack spacing={5}>
          <ScoreChip score={subject.score} />
          <Text font="caption2" foregroundStyle={subject.accent as never} lineLimit={1}>{subject.kind}</Text>
        </HStack>
      </VStack>
    </HStack>
  )
}

export function SubjectRow({ subject, showKind = false }: { subject: BangumiWidgetSubject; showKind?: boolean }) {
  return (
    <HStack
      spacing={8}
      padding={{ horizontal: 8, vertical: 7 }}
      background={bangumiMutedCard}
      clipShape={{ type: "rect", cornerRadius: 13 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
    >
      <WidgetPoster subject={subject} width={26} height={34} />
      <VStack alignment="leading" spacing={1} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="caption" fontWeight="semibold" lineLimit={1}>{subject.title}</Text>
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{showKind ? `${subject.kind} · ${subject.progress}` : subject.progress}</Text>
      </VStack>
    </HStack>
  )
}

export function TodayCompactList({ data, limit = 2 }: { data: BangumiWidgetData; limit?: number }) {
  const items = data.todaySubjects.slice(0, limit)
  if (!items.length) {
    return <EmptyLine icon="calendar" text={data.todayCount ? `${data.todayCount} 部今日放送` : "今日放送暂无数据"} />
  }
  return (
    <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      {items.map((subject) => <SubjectRow key={subject.id} subject={subject} showKind={true} />)}
    </VStack>
  )
}

export function TopicRow({ topic }: { topic: BangumiWidgetTopic }) {
  return (
    <VStack
      alignment="leading"
      spacing={3}
      padding={9}
      background={bangumiCard}
      clipShape={{ type: "rect", cornerRadius: 15 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
    >
      <HStack spacing={5}>
        <Image systemName="bubble.left.and.bubble.right.fill" font={10} foregroundStyle={bangumiLink as never} />
        <Text font="caption2" fontWeight="semibold" foregroundStyle={bangumiLink as never} lineLimit={1}>超展开</Text>
        <Spacer />
        <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{topic.heat}</Text>
      </HStack>
      <Text font="caption" fontWeight="semibold" lineLimit={2}>{topic.title}</Text>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{topic.meta}</Text>
    </VStack>
  )
}

export function StatGrid({ data, compact = false }: { data: BangumiWidgetData; compact?: boolean }) {
  return (
    <HStack spacing={compact ? 6 : 8} frame={{ maxWidth: "infinity" }}>
      <StatTile title="在看" value={`${data.watchingCount}`} icon="play.rectangle.fill" compact={compact} />
      <StatTile title="看过" value={`${data.completedCount}`} icon="checkmark.seal.fill" compact={compact} />
      <StatTile title="今日" value={`${data.todayCount}`} icon="calendar" compact={compact} />
    </HStack>
  )
}

export function MiniStatusGrid({ data }: { data: BangumiWidgetData }) {
  return (
    <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
        <MiniStat value={`${data.watchingCount}`} title="在看" />
        <MiniStat value={`${data.todayCount}`} title="今日" />
      </HStack>
      <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
        <MiniStat value={`${data.completedCount}`} title="看过" />
        <MiniStat value={data.noticeLabel} title="提醒" textValue={true} />
      </HStack>
    </VStack>
  )
}

export function EmptyPanel({ data, compact = false }: { data: BangumiWidgetData; compact?: boolean }) {
  return (
    <VStack
      alignment="leading"
      spacing={compact ? 5 : 7}
      padding={compact ? 10 : 12}
      background={bangumiCard}
      clipShape={{ type: "rect", cornerRadius: compact ? 15 : 18 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
    >
      <Image systemName={data.sourceState === "error" ? "wifi.exclamationmark" : "person.crop.circle.badge.plus"} font={compact ? 18 : 22} foregroundStyle={bangumiAccent} />
      <Text font={compact ? "subheadline" : "headline"} fontWeight="bold" lineLimit={1}>{data.emptyTitle}</Text>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={compact ? 2 : 3}>{data.emptySubtitle}</Text>
    </VStack>
  )
}

export function EmptyLine({ icon, text }: { icon: string; text: string }) {
  return (
    <HStack
      spacing={6}
      padding={{ horizontal: 9, vertical: 7 }}
      background={bangumiMutedCard}
      clipShape={{ type: "rect", cornerRadius: 13 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
    >
      <Image systemName={icon} font={11} foregroundStyle="secondaryLabel" />
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{text}</Text>
    </HStack>
  )
}

export function WidgetPoster({ subject, width, height }: { subject: BangumiWidgetSubject; width: number; height: number }) {
  if (subject.imageUrl) {
    return (
      <Image
        imageUrl={subject.imageUrl}
        resizable={true}
        frame={{ width, height }}
        clipped={true}
        clipShape={{ type: "rect", cornerRadius: Math.min(10, Math.floor(width / 3)) }}
        placeholder={<WidgetPosterPlaceholder subject={subject} width={width} height={height} />}
      />
    )
  }
  return <WidgetPosterPlaceholder subject={subject} width={width} height={height} />
}

function WidgetPosterPlaceholder({ subject, width, height }: { subject: BangumiWidgetSubject; width: number; height: number }) {
  return (
    <VStack
      alignment="leading"
      spacing={0}
      padding={width > 32 ? 6 : 4}
      frame={{ width, height }}
      background={subject.accent as never}
      clipShape={{ type: "rect", cornerRadius: Math.min(10, Math.floor(width / 3)) }}
    >
      <Spacer />
      <Text font="caption2" fontWeight="bold" foregroundStyle="white" lineLimit={width > 34 ? 2 : 1}>{subject.title}</Text>
    </VStack>
  )
}

function ScoreChip({ score }: { score: string }) {
  return (
    <HStack spacing={3} padding={{ horizontal: 6, vertical: 3 }} background={bangumiScoreBackground} clipShape={{ type: "capsule", style: "continuous" }}>
      <Image systemName="star.fill" font={8} foregroundStyle="#FFB74D" />
      <Text font="caption2" fontWeight="semibold" foregroundStyle="#B26B00" lineLimit={1}>{score}</Text>
    </HStack>
  )
}

function StatTile({ title, value, icon, compact = false }: { title: string; value: string; icon: string; compact?: boolean }) {
  return (
    <VStack
      alignment="leading"
      spacing={compact ? 2 : 3}
      padding={compact ? 7 : 8}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={bangumiCard}
      clipShape={{ type: "rect", cornerRadius: compact ? 13 : 14 }}
    >
      <Image systemName={icon} font={compact ? 10 : 11} foregroundStyle={bangumiAccent} />
      <Text font={compact ? "subheadline" : "headline"} fontWeight="bold" lineLimit={1}>{value}</Text>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{title}</Text>
    </VStack>
  )
}

function MiniStat({ value, title, textValue = false }: { value: string; title: string; textValue?: boolean }) {
  return (
    <VStack
      alignment="leading"
      spacing={1}
      padding={{ horizontal: 8, vertical: 6 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      background={bangumiCard}
      clipShape={{ type: "rect", cornerRadius: 13 }}
    >
      <Text font={textValue ? "caption" : "title3"} fontWeight="bold" lineLimit={1}>{value}</Text>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{title}</Text>
    </VStack>
  )
}
