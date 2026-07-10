import { Button, HStack, Image, Text, VStack } from "scripting"
import { HANIME_THEME } from "../theme"

type EmptyStateProps = {
  icon: string
  title: string
  message: string
  actionTitle?: string
  action?: () => void
}

export function EmptyState({ icon, title, message, actionTitle, action }: EmptyStateProps) {
  return (
    <VStack
      spacing={12}
      padding={{ horizontal: 24, vertical: 24 }}
      frame={{ maxWidth: "infinity", minHeight: 176 }}
      background={HANIME_THEME.library.stateCardBackground}
      clipShape={{ type: "rect", cornerRadius: 22 }}
    >
      <Image
        systemName={icon}
        font={28}
        foregroundStyle="systemPink"
        frame={{ width: 52, height: 52 }}
      />
      <VStack spacing={5}>
        <Text font="subheadline" fontWeight="semibold" multilineTextAlignment="center">{title}</Text>
        <Text font="caption" foregroundStyle="secondaryLabel" multilineTextAlignment="center" lineLimit={4}>
          {message}
        </Text>
      </VStack>
      {action && actionTitle ? (
        <Button action={action} buttonStyle="plain">
          <HStack spacing={6} padding={{ horizontal: 14, vertical: 10 }} background={HANIME_THEME.library.actionPillBackground} clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.controlRadius }}>
            <Text font="subheadline" fontWeight="semibold" foregroundStyle="systemPink">{actionTitle}</Text>
          </HStack>
        </Button>
      ) : null}
    </VStack>
  )
}
