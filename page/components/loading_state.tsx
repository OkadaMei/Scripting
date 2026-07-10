import { ProgressView, Text, VStack } from "scripting"
import { HANIME_THEME } from "../theme"

type LoadingStateProps = {
  message?: string
}

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <VStack
      spacing={12}
      padding={{ horizontal: 24, vertical: 24 }}
      frame={{ maxWidth: "infinity", minHeight: 152 }}
      background={HANIME_THEME.library.stateCardBackground}
      clipShape={{ type: "rect", cornerRadius: 22 }}
    >
      <ProgressView />
      <Text font="caption" foregroundStyle="secondaryLabel" multilineTextAlignment="center">
        {message || "加载中..."}
      </Text>
    </VStack>
  )
}