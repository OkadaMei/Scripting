import { Button, HStack, Image, Text, VStack } from "scripting"
import { HANIME_THEME } from "../theme"

type ErrorStateProps = {
  message: string
  onRetry: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <VStack
      spacing={12}
      padding={{ horizontal: 24, vertical: 24 }}
      frame={{ maxWidth: "infinity", minHeight: 176 }}
      background={HANIME_THEME.library.stateCardBackground}
      clipShape={{ type: "rect", cornerRadius: 22 }}
    >
      <Image systemName="exclamationmark.triangle.fill" font={32} foregroundStyle="systemRed" />
      <VStack spacing={5}>
        <Text font="subheadline" fontWeight="semibold" multilineTextAlignment="center">暂时无法加载</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={3}>
          可能是网络波动、站点验证或内容暂时不可访问，请稍后重试。
        </Text>
        <Text font="caption" foregroundStyle="tertiaryLabel" multilineTextAlignment="center" lineLimit={2}>
          {message}
        </Text>
      </VStack>
      <Button action={onRetry} buttonStyle="plain">
        <HStack spacing={6} padding={{ horizontal: 14, vertical: 10 }} background={HANIME_THEME.library.actionPillBackground} clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.controlRadius }}>
          <Image systemName="arrow.clockwise" font="caption" foregroundStyle="systemPink" />
          <Text font="subheadline" fontWeight="semibold" foregroundStyle="systemPink">重试</Text>
        </HStack>
      </Button>
    </VStack>
  )
}