import {
  Button, Group, HStack, Image, Label, List, Menu, Navigation, NavigationLink,
  Section, Spacer, Text, Toolbar, ToolbarItem, VStack,
  useEffect, useObservable, useState
} from "scripting"
import { database, Music, Playlist } from "../../class/database"
import { player } from "../../class/player"
import { usePlayerState } from "../../class/player_state"
import { fileManager } from "../../class/file_manager"
import { PlaylistPickerContent } from "../components/playlist_picker"
import { PageSummaryCard } from "../components/page_summary_card"

export function PlaylistsView() {
  const playlists = useObservable<Playlist[]>([])

  async function loadPlaylists() {
    playlists.setValue(await database.getAllPlaylists())
  }

  async function createPlaylist() {
    const name = await Dialog.prompt({ title: "新建播放列表", placeholder: "播放列表名称" })
    if (!name) return
    await database.createPlaylist(name)
    await loadPlaylists()
  }

  useEffect(() => { loadPlaylists() }, [])

  return (
    <List navigationTitle="播放列表" listStyle="inset">
      <Section>
        <PageSummaryCard
          title="播放列表"
          subtitle="把不同场景下常听的本地音乐整理成自己的合集"
          metrics={[
            { label: "列表", value: `${playlists.value.length} 个` },
            { label: "歌曲", value: `${playlists.value.reduce((sum, item) => sum + item.music_count, 0)} 首` },
            { label: "管理", value: "支持新建与编辑" },
          ]}
        />
      </Section>
      <Button action={createPlaylist}>
        <HStack spacing={12} padding={{ vertical: 4 }}>
          <Image systemName="plus.circle.fill" frame={{ width: 40, height: 40 }} foregroundStyle="accentColor" />
          <Text font="headline">新建播放列表</Text>
        </HStack>
      </Button>
      {playlists.value.map(playlist => (
        <NavigationLink key={playlist.id} destination={<PlaylistDetail playlistId={playlist.id} onDeleted={loadPlaylists} />}>
          <HStack spacing={12} padding={{ vertical: 4 }}>
            <Image systemName="music.note.list" frame={{ width: 40, height: 40 }} foregroundStyle="accentColor" />
            <VStack alignment="leading" spacing={2}>
              <Text font="headline">{playlist.name}</Text>
              <Text font="subheadline" foregroundStyle="secondaryLabel">{playlist.music_count} 首歌曲</Text>
            </VStack>
          </HStack>
        </NavigationLink>
      ))}
    </List>
  )
}

function PlaylistDetail({ playlistId, onDeleted }: { playlistId: string, onDeleted: () => void }) {
  const dismiss = Navigation.useDismiss()
  const playlist = useObservable<Playlist | null>(null)
  const [musics, setMusics] = useState<Music[]>([])
  const [coverExists, setCoverExists] = useState<Record<string, boolean>>({})
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
    const [selectedMusic, setSelectedMusic] = useState<Music | null>(null)
    const selected = useObservable<string[]>([])
  const editMode = useObservable<EditMode>(() => EditMode.inactive())
  const state = usePlayerState()
    const [searchText, setSearchText] = useState("")

    const isEditing = editMode.value.isEditing
    const filtered = searchText ? musics.filter(m => m.title.toLowerCase().includes(searchText.toLowerCase()) || m.artist.toLowerCase().includes(searchText.toLowerCase())) : musics
    const allIds = filtered.map(m => m.id)
  const hasSelection = selected.value.length > 0
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.value.includes(id))

  async function load() {
    const p = await database.getPlaylist(playlistId)
    playlist.setValue(p)
    const m = await database.getPlaylistMusic(playlistId)
    setMusics(m)
    const exists: Record<string, boolean> = {}
    await Promise.all(m.map(async music => { exists[music.id] = await fileManager.coverExists(music.id) }))
    setCoverExists(exists)
  }

  useEffect(() => { load() }, [])

  async function deletePlaylist() {
    const confirmed = await Dialog.confirm({ title: "删除播放列表", message: "确定要删除这个播放列表吗？" })
    if (!confirmed) return
    await database.deletePlaylist(playlistId)
        onDeleted()
        dismiss()
  }

  async function removeFromPlaylist(musicId: string) {
    await database.removeMusicFromPlaylist(playlistId, musicId)
    await load()
  }

  function exitEditing() {
    editMode.setValue(EditMode.inactive())
    selected.setValue([])
  }

  async function batchRemove() {
    await Promise.all(selected.value.map(id => database.removeMusicFromPlaylist(playlistId, id)))
    await load()
    exitEditing()
  }

  async function addToPlaylist(targetPlaylistId: string) {
    const ids = selected.value.length > 0 ? selected.value : selectedMusic ? [selectedMusic.id] : []
    await Promise.all(ids.map(id => database.addMusicToPlaylist(targetPlaylistId, id)))
    setShowPlaylistPicker(false)
    setSelectedMusic(null)
    if (selected.value.length > 0) exitEditing()
  }

  if (!playlist.value) return <Text>加载中...</Text>

  return (
    <List
          navigationTitle={playlist.value.name}
          searchable={{ value: searchText, onChanged: setSearchText }}
          navigationBarBackButtonHidden={isEditing}
      environments={{ editMode }}
      selection={selected}
      sheet={{
        isPresented: showPlaylistPicker,
        onChanged: (v: boolean) => { if (!v) { setShowPlaylistPicker(false); setSelectedMusic(null) } },
        content: <PlaylistPickerContent onSelect={addToPlaylist} onDismiss={() => { setShowPlaylistPicker(false); setSelectedMusic(null) }} />
      }}
      safeAreaInset={{
        bottom: isEditing ? {
          spacing: 0,
          content: (
            <HStack padding={{ horizontal: 16, vertical: 12 }} spacing={12}>
              <Button action={() => setShowPlaylistPicker(true)} disabled={!hasSelection} frame={{ maxWidth: "infinity" }} padding={{ horizontal: 16, vertical: 10 }} glassEffect={UIGlass.regular()}>
                <Label title="添加到播放列表" systemImage="music.note.list" />
              </Button>
              <Button role="destructive" action={batchRemove} disabled={!hasSelection} frame={{ maxWidth: "infinity" }} padding={{ horizontal: 16, vertical: 10 }} glassEffect={UIGlass.regular()}>
                <Label title="移除" systemImage="minus.circle" />
              </Button>
            </HStack>
          )
        } : undefined
      }}
      toolbar={
        <Toolbar>
          {isEditing && (
            <ToolbarItem placement="topBarLeading">
              <Button title={isAllSelected ? "反选" : "全选"} action={() => selected.setValue(isAllSelected ? [] : allIds)} />
            </ToolbarItem>
          )}
          <ToolbarItem placement="topBarTrailing">
            <HStack spacing={12}>
              {!isEditing && (
                <Menu label={<Image systemName="ellipsis" />}>
                  <Button title="删除播放列表" role="destructive" action={deletePlaylist} />
                </Menu>
              )}
              <Button title={isEditing ? "完成" : "编辑"} action={() => editMode.setValue(isEditing ? EditMode.inactive() : EditMode.active())} />
            </HStack>
          </ToolbarItem>
        </Toolbar>
      }
    >
      {!isEditing && musics.length > 0 && (
        <Section>
          <PageSummaryCard
            title={playlist.value.name}
            subtitle={searchText ? `当前筛选出 ${filtered.length} 首已加入歌曲` : "管理这个播放列表中的歌曲顺序与内容"}
            metrics={[
              { label: "歌曲", value: `${musics.length} 首` },
              { label: "筛选", value: searchText ? `${filtered.length} 首` : "全部可见" },
              { label: "操作", value: "播放 / 移除" },
            ]}
          />
        </Section>
      )}
      {!isEditing && musics.length > 0 && (
        <Section>
          <Button action={async () => {
            if (filtered.length === 0) return
            player.setQueue(filtered, 0)
            await player.play(filtered[0])
          }}>
                      <Label title="播放全部" systemImage="play.fill" tint="systemPink" />
                    </Button>
                    <Button action={async () => {
                      if (filtered.length === 0) return
                      const s = [...filtered].sort(() => Math.random() - 0.5)
                      player.setQueue(s, 0)
                      await player.play(s[0])
                    }}>
                      <Label title="随机播放" systemImage="shuffle" tint="systemPink" />
                    </Button>
        </Section>
      )}
      <Section>
              {filtered.map(music => {
                const isPlaying = state.currentMusic?.id === music.id
          return (
            <HStack
              key={music.id}
              spacing={12}
              padding={{ vertical: 4 }}
              contextMenu={isEditing ? undefined : {
                menuItems: (
                  <Group>
                    <Button title="添加到播放列表" action={() => { setSelectedMusic(music); setShowPlaylistPicker(true) }} />
                    <Button title="从列表移除" role="destructive" action={() => removeFromPlaylist(music.id)} />
                  </Group>
                )
              }}
              trailingSwipeActions={isEditing ? undefined : {
                actions: [
                  <Button role="destructive" action={() => removeFromPlaylist(music.id)}>
                    <Label title="移除" systemImage="minus.circle" />
                  </Button>
                ]
              }}
              {...(!isEditing && {
                              onTapGesture: async () => {
                                const idx = filtered.findIndex(item => item.id === music.id)
                                if (idx === -1) return
                                player.setQueue(filtered, idx)
                                await player.play(music)
                              }
                            })}
            >
              {coverExists[music.id]
                ? <Image filePath={fileManager.getCoverPath(music.id)} resizable={true} frame={{ width: 40, height: 40 }} clipShape={{ type: "rect", cornerRadius: 6 }} />
                : music.cover_url
                  ? <Image imageUrl={music.cover_url} resizable={true} frame={{ width: 40, height: 40 }} clipShape={{ type: "rect", cornerRadius: 6 }} />
                  : <Image systemName="music.note" frame={{ width: 40, height: 40 }} foregroundStyle={isPlaying ? "accentColor" : "secondaryLabel"} />
              }
              <VStack alignment="leading" spacing={2}>
                <Text font="headline" lineLimit={1} foregroundStyle={isPlaying ? "accentColor" : undefined}>{music.title}</Text>
                <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{music.artist}</Text>
              </VStack>
              <Spacer />
              {isPlaying && !isEditing && <Image systemName="waveform" tint="accentColor" />}
            </HStack>
          )
        })}
      </Section>
    </List>
  )
}