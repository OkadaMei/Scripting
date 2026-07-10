import { HStack, Image, Picker, Spacer, Text, VStack } from "scripting"
import { bangumiAccent, bangumiAccentSoftBackground, bangumiCard, bangumiHeroBackground, bangumiLink, bangumiLinkSoftBackground, bangumiMutedCard, bangumiScoreBackground, type BangumiSubject } from "./data"

export function ProgressCard({ subject, secondLineMode }: { subject: BangumiSubject; secondLineMode: string }) {
  return (
    <BangumiCard>
      <VStack alignment="leading" spacing={9} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <HStack frame={{ maxWidth: "infinity", alignment: "center" }}>
          <PosterBlock subject={subject} width={110} height={150} />
        </HStack>
        <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font="subheadline" fontWeight="semibold" lineLimit={2} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.title}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{progressSecondaryText(subject, secondLineMode)}</Text>
        </VStack>
        <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
          <ProgressStatusBadge subject={subject} />
          <Spacer />
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{subject.score.toFixed(1)}</Text>
        </HStack>
      </VStack>
    </BangumiCard>
  )
}

export function ProgressListRow({ subject, secondLineMode }: { subject: BangumiSubject; secondLineMode: string }) {
  const originalTitle = subject.originalTitle !== subject.title ? subject.originalTitle : ""
  return (
    <HStack alignment="top" spacing={12} padding={{ vertical: 6 }} frame={{ maxWidth: "infinity", minHeight: 84, alignment: "leading" }}>
      <PosterBlock subject={subject} width={50} height={70} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }} layoutPriority={1}>
        <Text font="headline" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{subject.title}</Text>
        {originalTitle ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{originalTitle}</Text> : null}
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1} multilineTextAlignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>{progressSecondaryText(subject, secondLineMode)}</Text>
        <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
          <ProgressStatusBadge subject={subject} />
          <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{progressKindYear(subject)}</Text>
        </HStack>
      </VStack>
      <ProgressScoreAccessory subject={subject} />
    </HStack>
  )
}

function ProgressStatusBadge({ subject }: { subject: BangumiSubject }) {
  return (
    <Text
      font="caption2"
      foregroundStyle={subject.accent as never}
      padding={{ horizontal: 7, vertical: 3 }}
      background={`${subject.accent}18` as never}
      clipShape={{ type: "rect", cornerRadius: 6 }}
      lineLimit={1}
    >
      {subject.collection}
    </Text>
  )
}

function ProgressScoreAccessory({ subject }: { subject: BangumiSubject }) {
  return (
    <VStack alignment="trailing" spacing={2} frame={{ width: 44, alignment: "trailing" }}>
      <Text font="subheadline" fontWeight="semibold" foregroundStyle={bangumiLink} lineLimit={1}>{subject.score.toFixed(1)}</Text>
      <Text font="caption2" foregroundStyle="secondaryLabel" lineLimit={1}>{formatCompactCount(subject.votes)}</Text>
    </VStack>
  )
}

function progressKindYear(subject: BangumiSubject) {
  return subject.year ? `${subject.kind} / ${subject.year}` : subject.kind
}

function formatCompactCount(count: number) {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}万`
  }
  if (count >= 1000) {
    return `${Math.round(count / 1000)}k`
  }
  return `${count}`
}

export function FeatureSubjectCard({ subject }: { subject: BangumiSubject }) {
  return (
    <BangumiCard>
      <HStack alignment="top" spacing={14}>
        <PosterBlock subject={subject} width={96} height={128} />
        <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity" }}>
          <Text font="headline" lineLimit={2}>{subject.title}</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2}>{subject.summary}</Text>
          <HStack spacing={8}>
            <ScorePill score={subject.score} votes={subject.votes} />
            <MetaBadge label={subject.kind} tint={subject.accent} subdued={true} />
          </HStack>
        </VStack>
      </HStack>
    </BangumiCard>
  )
}

export function CompactSubjectCard({ subject }: { subject: BangumiSubject }) {
  return (
    <BangumiCard>
      <VStack alignment="leading" spacing={10} frame={{ width: 160 }}>
        <PosterBlock subject={subject} width={136} height={184} />
        <Text font="subheadline" fontWeight="medium" lineLimit={2}>{subject.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">{subject.kind} · {subject.year}</Text>
      </VStack>
    </BangumiCard>
  )
}

export function DiscoverCompactRow({ subject }: { subject: BangumiSubject }) {
  return (
    <HStack spacing={10}>
      <PosterBlock subject={subject} width={42} height={58} />
      <VStack alignment="leading" spacing={3} frame={{ maxWidth: "infinity" }}>
        <Text font="subheadline" fontWeight="medium" lineLimit={1}>{subject.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{subject.kind} · {subject.progressLabel}</Text>
      </VStack>
    </HStack>
  )
}

export function BangumiSubjectSnippet({ subject }: { subject: BangumiSubject }) {
  return (
    <HStack
      alignment="top"
      spacing={10}
      padding={10}
      background={bangumiMutedCard}
      clipShape={{ type: "rect", cornerRadius: 10 }}
    >
      <PosterBlock subject={subject} width={46} height={64} />
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity" }}>
        <Text font="subheadline" fontWeight="medium" lineLimit={1}>{subject.title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>{subject.summary}</Text>
      </VStack>
    </HStack>
  )
}

export function RakuenTopicRow({
  title,
  group,
  author,
  replies,
  heat,
  time,
  summary,
}: {
  title: string
  group: string
  author: string
  replies: number
  heat: string
  time?: string
  summary?: string
}) {
  return (
    <VStack alignment="leading" spacing={6} padding={{ vertical: 6 }}>
      <Text font="headline" lineLimit={2}>{title}</Text>
      <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{group} · {author}{time ? ` · ${time}` : ""}</Text>
      {summary ? <Text font="footnote" foregroundStyle="secondaryLabel" lineLimit={2}>{summary}</Text> : null}
      <HStack>
        <MetaBadge label={heat} tint={bangumiAccent} subdued={true} />
        <Spacer />
        <Text font="caption" foregroundStyle="secondaryLabel">{replies} 回复</Text>
      </HStack>
    </VStack>
  )
}

export function BangumiToggleRow({
  title,
  subtitle,
  value,
  onChanged,
  icon,
}: {
  title: string
  subtitle: string
  value: boolean
  onChanged: (value: boolean) => void
  icon?: string
}) {
  return (
    <HStack spacing={12}>
      {icon ? <Image systemName={icon} frame={{ width: 20 }} tint={bangumiAccent} /> : null}
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
        <Text>{title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel">{subtitle}</Text>
      </VStack>
      <Picker title={title} value={value ? "on" : "off"} onChanged={(next: string) => onChanged(next === "on")}>
        <Text tag="off">关闭</Text>
        <Text tag="on">开启</Text>
      </Picker>
    </HStack>
  )
}

export function BangumiPickerRow({
  title,
  value,
  options,
  onChanged,
}: {
  title: string
  value: string
  options: string[]
  onChanged: (value: string) => void
  icon?: string
  subtitle?: string
}) {
  return (
    <Picker title={title} value={value} onChanged={onChanged}>
      {options.map((option) => (
        <Text key={option} tag={option}>{option}</Text>
      ))}
    </Picker>
  )
}

export function BangumiInlineRow({ title, value, icon }: { title: string; value: string; icon: string; subtitle?: string }) {
  return (
    <HStack spacing={12} padding={{ vertical: 4 }}>
      <Image systemName={icon} frame={{ width: 20 }} tint={bangumiAccent} />
      <Text>{title}</Text>
      <Spacer />
      <Text font="subheadline" foregroundStyle="secondaryLabel">{value}</Text>
    </HStack>
  )
}

export function HeroCard({ title, subtitle, accessory }: { title: string; subtitle: string; accessory?: JSX.Element }) {
  return (
    <VStack
      alignment="leading"
      spacing={14}
      padding={20}
      background={{
        style: bangumiHeroBackground,
        shape: { type: "rect", cornerRadius: 24 },
      }}
    >
      <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="title2" fontWeight="bold" lineLimit={2}>{title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={3}>{subtitle}</Text>
      </VStack>
      {accessory ?? null}
    </VStack>
  )
}

export function BangumiCard({ children }: { children: JSX.Element | JSX.Element[] }) {
  return (
    <VStack
      alignment="leading"
      spacing={0}
      padding={14}
      background={bangumiCard}
      clipShape={{ type: "rect", cornerRadius: 18 }}
    >
      {children}
    </VStack>
  )
}

export function InfoSection({ title, children }: { title: string; children: JSX.Element | JSX.Element[] }) {
  return (
    <VStack alignment="leading" spacing={12}>
      <Text font="title3" fontWeight="bold" padding={{ horizontal: 4 }}>{title}</Text>
      <BangumiCard>
        <VStack alignment="leading" spacing={10}>
          {children}
        </VStack>
      </BangumiCard>
    </VStack>
  )
}

export function PosterBlock({ subject, width, height }: { subject: BangumiSubject; width: number; height: number }) {
  if (subject.imageUrl) {
    return (
      <Image
        imageUrl={subject.imageUrl}
        resizable={true}
        frame={{ width, height }}
        clipped={true}
        clipShape={{ type: "rect", cornerRadius: 12 }}
        placeholder={<PosterPlaceholder subject={subject} width={width} height={height} />}
      />
    )
  }

  return <PosterPlaceholder subject={subject} width={width} height={height} />
}

function PosterPlaceholder({ subject, width, height }: { subject: BangumiSubject; width: number; height: number }) {
  return (
    <VStack
      frame={{ width, height }}
      alignment="leading"
      spacing={0}
      padding={12}
      background={subject.accent as never}
      clipShape={{ type: "rect", cornerRadius: 12 }}
    >
      <Spacer />
      <Text font="caption" foregroundStyle="white">{subject.kind}</Text>
      <Text font="headline" foregroundStyle="white" lineLimit={3}>{subject.title}</Text>
    </VStack>
  )
}

export function MetaBadge({ label, tint, subdued }: { label: string; tint: string; subdued?: boolean }) {
  return (
    <Text
      font="caption"
      foregroundStyle={subdued ? (tint as never) : "white"}
      padding={{ horizontal: 8, vertical: 4 }}
      background={subdued ? (`${tint}22` as never) : (tint as never)}
      clipShape={{ type: "capsule", style: "continuous" }}
    >
      {label}
    </Text>
  )
}

export function ScorePill({ score, votes }: { score: number; votes: number }) {
  return (
    <HStack
      spacing={6}
      padding={{ horizontal: 10, vertical: 6 }}
      background={bangumiScoreBackground}
      clipShape={{ type: "capsule", style: "continuous" }}
    >
      <Image systemName="star.fill" tint="#FFB74D" />
      <Text font="caption">{score.toFixed(1)}</Text>
      <Text font="caption" foregroundStyle="secondaryLabel">{votes}</Text>
    </HStack>
  )
}

export function RankPill({ rank }: { rank: number }) {
  return (
    <Text
      font="caption"
      foregroundStyle={bangumiLink}
      padding={{ horizontal: 10, vertical: 6 }}
      background={bangumiLinkSoftBackground}
      clipShape={{ type: "capsule", style: "continuous" }}
    >
      Rank {rank}
    </Text>
  )
}

export function AvatarCircle({ label, size, imageUrl }: { label: string; size: number; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <Image
        imageUrl={imageUrl}
        resizable={true}
        frame={{ width: size, height: size }}
        clipped={true}
        clipShape={{ type: "rect", cornerRadius: size / 2 }}
        placeholder={<AvatarPlaceholder label={label} size={size} />}
      />
    )
  }

  return <AvatarPlaceholder label={label} size={size} />
}

function AvatarPlaceholder({ label, size }: { label: string; size: number }) {
  return (
    <VStack
      frame={{ width: size, height: size }}
      alignment="center"
      background={bangumiAccent}
      clipShape={{ type: "rect", cornerRadius: size / 2 }}
    >
      <Text font="headline" foregroundStyle="white">{label}</Text>
    </VStack>
  )
}

export function BangumiEmptyState({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) {
  return (
    <VStack alignment="center" spacing={9} padding={{ vertical: 22, horizontal: 16 }} frame={{ maxWidth: "infinity" }} background={bangumiMutedCard} clipShape={{ type: "rect", cornerRadius: 18 }}>
      <Image systemName={icon} tint="secondaryLabel" />
      <Text font="headline" multilineTextAlignment="center">{title}</Text>
      <Text font="subheadline" foregroundStyle="secondaryLabel" multilineTextAlignment="center">{subtitle}</Text>
    </VStack>
  )
}

export function AuthHeroCard() {
  return (
    <HeroCard
      title="登录后同步你的收藏进度"
      subtitle="连接 Bangumi 账号后，可在这里集中查看在看、想看、看过与章节进度。"
      accessory={
        <HStack
          spacing={7}
          padding={{ horizontal: 11, vertical: 7 }}
          background={bangumiAccentSoftBackground}
          clipShape={{ type: "capsule", style: "continuous" }}
        >
          <Image systemName="person.crop.circle.badge.checkmark" font="caption" foregroundStyle={bangumiAccent} />
          <Text font="caption" fontWeight="medium" foregroundStyle={bangumiAccent}>前往设置页完成 OAuth 登录</Text>
        </HStack>
      }
    />
  )
}

export function progressSecondaryText(subject: BangumiSubject, secondLineMode: string) {
  if (secondLineMode === "观看进度") {
    return subject.progressLabel
  }
  if (secondLineMode === "收藏状态") {
    return subject.collection
  }
  return subject.meta
}
