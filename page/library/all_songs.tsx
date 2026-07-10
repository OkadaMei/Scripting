import { List, Section, Button, Label, HStack, VStack, Text, Image, Spacer, Group, useEffect, useState, Menu, Toolbar, ToolbarItem, ForEach, useObservable } from "scripting"
import { database, Music } from "../../class/database"
import { player } from "../../class/player"
import { usePlayerState } from "../../class/player_state"
import { EmptyState } from "../components/empty_state"
import { LoadingState } from "../components/loading_state"
import { fileManager } from "../../class/file_manager"
import { PlaylistPickerContent } from "../components/playlist_picker"
import { PageSummaryCard } from "../components/page_summary_card"

type SortType = "added" | "title" | "artist"

export function AllSongsView() {
  const [musics, setMusics] = useState<Music[]>([])
  const [coverExists, setCoverExists] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const [selectedMusic, setSelectedMusic] = useState<Music | null>(null)
  const [sortType, setSortType] = useState<SortType>(Storage.get<SortType>("all_songs_sort") ?? "added")
  const selected = useObservable<string[]>([])
  const musicItems = useObservable<{ id: string }[]>([])
  const editMode = useObservable<EditMode>(() => EditMode.inactive())
  const state = usePlayerState()
    const [searchText, setSearchText] = useState("")

    const isEditing = editMode.value.isEditing
    const filtered = searchText ? musics.filter(m => m.title.toLowerCase().includes(searchText.toLowerCase()) || m.artist.toLowerCase().includes(searchText.toLowerCase())) : musics
      const filteredItems = useObservable<{ id: string }[]>(filtered.map(m => ({ id: m.id })))
      useEffect(() => { filteredItems.setValue(filtered.map(m => ({ id: m.id }))) }, [searchText, musics])
      const allIds = filtered.map(m => m.id)
  const hasSelection = selected.value.length > 0
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.value.includes(id))
  const localCount = musics.filter(m => m.is_downloaded).length
  const favoriteCount = musics.filter(m => m.is_favorite).length

  useEffect(() => { loadMusics() }, [])

  async function loadMusics() {
    try {
      const data = await database.getAllMusic()
      const sorted = sortMusics(data, sortType)
      setMusics(sorted)
      musicItems.setValue(sorted.map(m => ({ id: m.id })))
      const exists: Record<string, boolean> = {}
      await Promise.all(data.map(async m => { exists[m.id] = await fileManager.coverExists(m.id) }))
      setCoverExists(exists)
    } catch (error) {
      console.error("加载音乐失败:", error)
    } finally {
      setLoading(false)
    }
  }

  function sortMusics(data: Music[], type: SortType): Music[] {
    const sorted = [...data]
    switch (type) {
      case "title": return sorted.sort((a, b) => a.title.localeCompare(b.title))
      case "artist": return sorted.sort((a, b) => a.artist.localeCompare(b.artist))
      default: return sorted.sort((a, b) => b.added_at - a.added_at)
    }
  }

  useEffect(() => {
    const sorted = sortMusics(musics, sortType)
    setMusics(sorted)
    musicItems.setValue(sorted.map(m => ({ id: m.id })))
    Storage.set("all_songs_sort", sortType)
  }, [sortType])

  async function toggleFavorite(music: Music) {
    await database.toggleFavorite(music.id)
    await loadMusics()
  }

  async function deleteMusic(music: Music) {
      try {
        await database.deleteMusic(music.id)
        await loadMusics()
      } catch (error) {
        console.error("删除音乐失败:", error)
      }
    }

  function exitEditing() {
    editMode.setValue(EditMode.inactive())
    selected.setValue([])
  }

  async function addToPlaylist(playlistId: string) {
    const ids = selected.value.length > 0 ? selected.value : selectedMusic ? [selectedMusic.id] : []
    try {
      await Promise.all(ids.map(id => database.addMusicToPlaylist(playlistId, id)))
      setShowPlaylistPicker(false)
      setSelectedMusic(null)
            if (selected.value.length > 0) exitEditing()
    } catch (error) {
      console.error("添加到播放列表失败:", error)
    }
  }

  async function batchDelete() {
    try {
      const toDelete = musics.filter(m => selected.value.includes(m.id))
      await Promise.all(toDelete.map(m => deleteMusic(m)))
      exitEditing()
    } catch (error) {
      console.error("批量删除失败:", error)
    }
  }

  if (loading) return <LoadingState message="加载音乐中..." />
  if (musics.length === 0) return <EmptyState icon="music.note" title="暂无音乐" message="去搜索页面添加你喜欢的音乐吧" />

  return (
    <List
          navigationTitle="所有歌曲"
          searchable={{ value: searchText, onChanged: setSearchText }}
          navigationBarBackButtonHidden={isEditing}
      tabBarVisibility={isEditing ? "hidden" : "automatic"}
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
              <Button
                action={() => setShowPlaylistPicker(true)}
                disabled={!hasSelection}
                frame={{ maxWidth: "infinity" }}
                padding={{ horizontal: 16, vertical: 10 }}
                glassEffect={UIGlass.regular()}
              >
                <Label title="添加到播放列表" systemImage="music.note.list" />
              </Button>
              <Button
                role="destructive"
                action={batchDelete}
                disabled={!hasSelection}
                frame={{ maxWidth: "infinity" }}
                padding={{ horizontal: 16, vertical: 10 }}
                glassEffect={UIGlass.regular()}
              >
                <Label title="删除" systemImage="trash" />
              </Button>
            </HStack>
          )
        } : undefined
      }}
      toolbar={
        <Toolbar>
          {isEditing && (
            <ToolbarItem placement="topBarLeading">
              <Button
                title={isAllSelected ? "反选" : "全选"}
                action={() => selected.setValue(isAllSelected ? [] : allIds)} />
            </ToolbarItem>
          )}
          <ToolbarItem placement="topBarTrailing">
            <HStack spacing={12}>
              {!isEditing && (
                <Menu label={<Image systemName="arrow.up.arrow.down" />}>
                  <Button title="按添加时间" systemImage={sortType === "added" ? "checkmark" : undefined} action={() => setSortType("added")} />
                  <Button title="按歌曲名称" systemImage={sortType === "title" ? "checkmark" : undefined} action={() => setSortType("title")} />
                  <Button title="按艺人名称" systemImage={sortType === "artist" ? "checkmark" : undefined} action={() => setSortType("artist")} />
                </Menu>
              )}
              <Button
                title={isEditing ? "完成" : "编辑"}
                action={() => editMode.setValue(isEditing ? EditMode.inactive() : EditMode.active())}
              />
            </HStack>
          </ToolbarItem>
        </Toolbar>
      }
    >
      {!isEditing && (
        <Section>
          <PageSummaryCard
            title="所有歌曲"
            subtitle={searchText ? `当前筛选出 ${filtered.length} 首歌曲` : "在一个页面里浏览和管理你的完整资料库"}
            metrics={[
              { label: "全部", value: `${musics.length} 首` },
              { label: "本地", value: `${localCount} 首` },
              { label: "喜欢", value: `${favoriteCount} 首` },
            ]}
          />
        </Section>
      )}
      {!isEditing && (
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
      )}<Section>
        <ForEach
          data={filteredItems}
          builder={(item) => {
            const music = filtered.find(m => m.id === item.id)
            if (!music) return <Text key={item.id}>{""}</Text>
            const isPlaying = state.currentMusic?.id === music.id
            return (
              <HStack
                key={music.id}
                spacing={12}
                padding={{ vertical: 4 }}
                {...(!isEditing && {
                                  contextMenu: {
                                    menuItems: (
                                      <Group>
                                        <Button title={music.is_favorite ? "取消收藏" : "收藏"} action={() => toggleFavorite(music)} />
                                        <Button title="添加到播放列表" action={() => { setSelectedMusic(music); setShowPlaylistPicker(true) }} />
                                        <Button title="删除" role="destructive" action={() => deleteMusic(music)} />
                                      </Group>
                                    )
                                  }
                                })}
                leadingSwipeActions={isEditing ? undefined : {
                  actions: [
                    <Button tint="systemPink" action={() => toggleFavorite(music)}>
                      <Label title={music.is_favorite ? "取消" : "收藏"} systemImage="heart.fill" />
                    </Button>
                  ]
                }}
                trailingSwipeActions={isEditing ? undefined : {
                  actions: [
                    <Button role="destructive" action={() => deleteMusic(music)}>
                      <Label title="删除" systemImage="trash" />
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
                  ? <Image filePath={fileManager.getCoverPath(music.id)} frame={{ width: 40, height: 40 }} resizable={true} clipShape={{ type: "rect", cornerRadius: 6 }} />
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
          }}
        />
      </Section>
    </List>
  )
}