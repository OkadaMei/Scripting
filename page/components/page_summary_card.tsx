import { HStack, Text, VStack } from "scripting"
import { HANIME_THEME } from "../theme"

export type SummaryMetric = {
  label: string
  value: string
}

export function PageSummaryCard({
  title,
  subtitle,
  metrics,
}: {
  title: string
  subtitle: string
  metrics: SummaryMetric[]
}) {
  return (
    <VStack
      alignment="leading"
      spacing={16}
      padding={18}
      background={{
        style: HANIME_THEME.library.softAccentCardBackground,
        shape: { type: "rect", cornerRadius: 24 },
      }}
    >
      <VStack alignment="leading" spacing={5}>
        <Text font="title3" fontWeight="bold" lineLimit={1}>{title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2} multilineTextAlignment="leading">{subtitle}</Text>
      </VStack>

      <HStack spacing={12}>
        {metrics.map((item) => (
          <VStack
            key={item.label}
            alignment="leading"
            spacing={2}
            frame={{ maxWidth: "infinity" }}
            padding={{ horizontal: 12, vertical: 11 }}
            background={HANIME_THEME.library.statCardBackground}
            clipShape={{ type: "rect", cornerRadius: 16 }}
          >
            <Text font="caption" foregroundStyle="secondaryLabel">{item.label}</Text>
            <Text font="headline" lineLimit={1}>{item.value}</Text>
          </VStack>
        ))}
      </HStack>
    </VStack>
  )
}
