import { Button, HStack, Image, List, Navigation, NavigationStack, Section, Spacer, Text, Toolbar, ToolbarItem, VStack } from "scripting"
import { usePlayerState } from "../../class/player_state"
import { player, PlayMode } from "../../class/player"
import { Music } from "../../class/database"
import { EmptyState } from "../components/empty_state"

const PLAY_MODE_ICONS: Record<PlayMode, string> = {
  "sequential": "arrow.right",
  "repeat-all": "repeat",
  "repeat-one": "repeat.1",
  "shuffle": "shuffle",
}

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  "sequential": "顺序播放",
  "repeat-all": "列表循环",
  "repeat-one": "单曲循环",
  "shuffle": "随机播放",
}

const PLAY_MODE_ORDER: PlayMode[] = ["sequential", "repeat-all", "repeat-one", "shuffle"]

export function QueueSheet() {
  const { queue, currentIndex, currentMusic, playMode } = usePlayerState()
  const dismiss = Navigation.useDismiss()

  function cyclePlayMode() {
    const idx = PLAY_MODE_ORDER.indexOf(playMode)
    player.setPlayMode(PLAY_MODE_ORDER[(idx + 1) % PLAY_MODE_ORDER.length])
  }

  const safeCurrentIndex = currentIndex < 0 ? 0 : currentIndex
  const currentQueue = currentMusic ? queue[safeCurrentIndex] ?? currentMusic : null
  const upcomingQueue = queue.slice(currentMusic ? safeCurrentIndex + 1 : 0)

  return (
    <NavigationStack>
      <List
        listStyle="inset"
        navigationTitle="待播列表"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button action={() => dismiss()}>
                <Image systemName="xmark" />
              </Button>
            </ToolbarItem>
          </Toolbar>
        }
      >
        <Section>
          <Button action={cyclePlayMode}>
            <HStack>
              <Image systemName={PLAY_MODE_ICONS[playMode]} tint="accentColor" />
              <Text foregroundStyle="accentColor">{PLAY_MODE_LABELS[playMode]}</Text>
              <Spacer />
              <Text font="caption" foregroundStyle="secondaryLabel">{queue.length} 首</Text>
            </HStack>
          </Button>
        </Section>

        {currentQueue ? (
          <Section title="正在播放">
            <QueueRow music={currentQueue} isCurrent={true} onPress={async () => {
              player.setQueue(queue, safeCurrentIndex)
              await player.play(currentQueue)
            }} />
          </Section>
        ) : null}

        {upcomingQueue.length > 0 ? (
          <Section title="接下来">
            {upcomingQueue.map((music, i) => {
              const idx = (currentMusic ? safeCurrentIndex + 1 : 0) + i
              return (
                <QueueRow
                  key={music.id}
                  music={music}
                  isCurrent={false}
                  onPress={async () => {
                    player.setQueue(queue, idx)
                    await player.play(music)
                  }}
                />
              )
            })}
          </Section>
        ) : null}

        {queue.length === 0 ? (
          <Section>
            <EmptyState
              icon="music.note.list"
              title="队列还是空的"
              message="从资料库中播放一首歌曲后，这里会显示当前播放与接下来的内容。"
            />
          </Section>
        ) : null}
      </List>
    </NavigationStack>
  )
}

function QueueRow({
  music,
  isCurrent,
  onPress,
}: {
  music: Pick<Music, "id" | "title" | "artist">
  isCurrent: boolean
  onPress: () => void | Promise<void>
}) {
  return (
    <Button action={onPress}>
      <HStack spacing={12} padding={{ vertical: 4 }}>
        <VStack
          frame={{ width: 40, height: 40 }}
          background={isCurrent ? "rgba(255,45,85,0.14)" : "secondarySystemFill"}
          clipShape={{ type: "rect", cornerRadius: 10 }}
        >
          <Spacer />
          <Image systemName={isCurrent ? "waveform" : "music.note"} tint={isCurrent ? "systemPink" : "secondaryLabel"} />
          <Spacer />
        </VStack>
        <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity" }}>
          <Text font="headline" lineLimit={1} foregroundStyle={isCurrent ? "systemPink" : "label"}>
            {music.title}
          </Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>
            {music.artist}
          </Text>
        </VStack>
        <Spacer />
        {isCurrent ? <Text font="caption" foregroundStyle="systemPink">当前</Text> : null}
      </HStack>
    </Button>
  )
}
