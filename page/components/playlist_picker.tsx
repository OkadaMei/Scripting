import {
  useState,
  useEffect,
  List,
  Section,
  NavigationStack,
  Text,
  Button,
  HStack,
  VStack,
  Image,
  Spacer,
  TextField,
  Toolbar,
  ToolbarItem,
  ContentUnavailableView,
} from "scripting"
import { database, Playlist } from "../../class/database"

type Props = {
  onSelect: (playlistId: string) => void
  onDismiss: () => void
}

export type PlaylistPickerSheetProps = Props & { isPresented: boolean }

export function PlaylistPickerContent({ onSelect, onDismiss }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")

  useEffect(() => {
    database.getAllPlaylists().then(setPlaylists)
  }, [])

  async function createAndSelect() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const id = await database.createPlaylist(trimmed)
    setNewName("")
    setShowCreate(false)
    onSelect(id)
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="添加到播放列表"
        toolbar={
          <Toolbar>
            <ToolbarItem placement="topBarLeading">
              <Button title="取消" action={onDismiss} />
            </ToolbarItem>
            <ToolbarItem placement="topBarTrailing">
              <Button action={() => setShowCreate(true)}>
                <Image systemName="plus" />
              </Button>
            </ToolbarItem>
          </Toolbar>
        }
        overlay={playlists.length === 0
          ? <ContentUnavailableView
              title="暂无播放列表"
              systemImage="music.note.list"
              description="点击右上角 + 创建一个播放列表"
            />
          : undefined
        }
        sheet={{
          isPresented: showCreate,
          onChanged: (v: boolean) => { if (!v) { setShowCreate(false); setNewName("") } },
          content: (
            <NavigationStack>
              <List
                navigationTitle="新建播放列表"
                toolbar={
                  <Toolbar>
                    <ToolbarItem placement="topBarLeading">
                      <Button title="取消" action={() => { setShowCreate(false); setNewName("") }} />
                    </ToolbarItem>
                    <ToolbarItem placement="topBarTrailing">
                      <Button title="创建" action={createAndSelect} />
                    </ToolbarItem>
                  </Toolbar>
                }
              >
                <Section>
                  <TextField
                    title="名称"
                    prompt="播放列表名称"
                    value={newName}
                    onChanged={setNewName}
                    submitLabel="done"
                    onSubmit={createAndSelect}
                  />
                </Section>
              </List>
            </NavigationStack>
          )
        }}
      >
        <Section>
          {playlists.map(p => (
                      <Button key={p.id} action={() => onSelect(p.id)}>
                        <HStack spacing={12}>
                          <Image systemName="music.note.list" font="title2" foregroundStyle="secondaryLabel" frame={{ width: 40, height: 40 }} />
                          <VStack alignment="leading" spacing={2}>
                            <Text font="headline" lineLimit={1}>{p.name}</Text>
                            <Text font="caption" foregroundStyle="secondaryLabel">{p.music_count} 首歌曲</Text>
                          </VStack>
                          <Spacer />
                        </HStack>
                      </Button>
                    ))}
        </Section>
      </List>
    </NavigationStack>
  )
}