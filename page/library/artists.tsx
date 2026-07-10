import { List, Section, Button, Label, HStack, VStack, Text, Image, Spacer, Group, useEffect, useState, Menu, Toolbar, ToolbarItem, NavigationLink, useObservable } from "scripting"
import { database, Music } from "../../class/database"
import { player } from "../../class/player"
import { usePlayerState } from "../../class/player_state"
import { fileManager } from "../../class/file_manager"
import { PlaylistPickerContent } from "../components/playlist_picker"
import { LoadingState } from "../components/loading_state"
import { PageSummaryCard } from "../components/page_summary_card"

type SortType = "title" | "added"

function ArtistDetail({ artist, musics: initialMusics }: { artist: string, musics: Music[] }) {
  const state = usePlayerState()
  const [musics, setMusics] = useState<Music[]>(initialMusics)
  const [coverExists, setCoverExists] = useState<Record<string, boolean>>({})
  const [sortType, setSortType] = useState<SortType>("title")
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
    const [selectedMusic, setSelectedMusic] = useState<Music | null>(null)
    const selected = useObservable<string[]>([])
  const editMode = useObservable<EditMode>(() => EditMode.inactive())

  const [searchText, setSearchText] = useState("")
    const isEditing = editMode.value.isEditing
    const filtered = searchText ? musics.filter(m => m.title.toLowerCase().includes(searchText.toLowerCase()) || m.artist.toLowerCase().includes(searchText.toLowerCase())) : musics
    const allIds = filtered.map(m => m.id)
  const hasSelection = selected.value.length > 0
  const isAllSelected = allIds.length > 0 && allIds.every(id => selected.value.includes(id))

  useEffect(() => {
    async function loadCovers() {
      const exists: Record<string, boolean> = {}
      await Promise.all(initialMusics.map(async m => { exists[m.id] = await fileManager.coverExists(m.id) }))
      setCoverExists(exists)
    }
    loadCovers()
  }, [])

  useEffect(() => {
    const sorted = [...initialMusics]
    switch (sortType) {
      case "title": sorted.sort((a, b) => a.title.localeCompare(b.title)); break
      case "added": sorted.sort((a, b) => b.added_at - a.added_at); break}
    setMusics(sorted)
  }, [sortType])

  async function toggleFavorite(music: Music) {
    await database.toggleFavorite(music.id)}

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
    } catch (e) {
      console.error(e)
    }
  }

  async function batchDelete() {
      try {
        await Promise.all(
          musics.filter(m => selected.value.includes(m.id)).map(m => database.deleteMusic(m.id))
        )
        setMusics(prev => prev.filter(m => !selected.value.includes(m.id)))
        exitEditing()
      } catch (e) {
        console.error(e)
      }
    }

  return (
    <List
          navigationTitle={artist}
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
              <Button role="destructive" action={batchDelete} disabled={!hasSelection} frame={{ maxWidth: "infinity" }} padding={{ horizontal: 16, vertical: 10 }} glassEffect={UIGlass.regular()}>
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
              <Button title={isAllSelected ? "反选" : "全选"} action={() => selected.setValue(isAllSelected ? [] : allIds)} />
            </ToolbarItem>
          )}
          <ToolbarItem placement="topBarTrailing">
            <HStack spacing={12}>
              {!isEditing && (
                <Menu label={<Image systemName="arrow.up.arrow.down" />}>
                  <Button title="按歌曲名称" systemImage={sortType === "title" ? "checkmark" : undefined} action={() => setSortType("title")} />
                  <Button title="按添加时间" systemImage={sortType === "added" ? "checkmark" : undefined} action={() => setSortType("added")} />
                </Menu>
              )}
              <Button title={isEditing ? "完成" : "编辑"} action={() => editMode.setValue(isEditing ? EditMode.inactive() : EditMode.active())} />
            </HStack>
          </ToolbarItem>
        </Toolbar>
      }
    >
      {!isEditing && (
        <Section>
          <PageSummaryCard
            title={artist}
            subtitle={searchText ? `当前筛选出 ${filtered.length} 首来自该艺人的歌曲` : "集中浏览这位艺人的所有本地歌曲"}
            metrics={[
              { label: "歌曲", value: `${musics.length} 首` },
              { label: "专辑", value: `${new Set(musics.map(m => m.album)).size} 张` },
              { label: "排序", value: sortType === "title" ? "歌曲名称" : "最近添加" },
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
      )}
      <Section>
              {filtered.map(music => {
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
                <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{music.album}</Text>
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

export function ArtistsView() {
  const [artists, setArtists] = useState<{ artist: string, count: number, musics: Music[] }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState("")

  useEffect(() => {
    database.getMusicByArtist().then(setArtists)
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState message="加载艺人中..." />

  const filtered = searchText
    ? artists.filter(a => a.artist.toLowerCase().includes(searchText.toLowerCase()))
    : artists

  return (
    <List navigationTitle="艺人" searchable={{ value: searchText, onChanged: setSearchText }} listStyle="inset">
      <Section>
        <PageSummaryCard
          title="艺人"
          subtitle={searchText ? `当前筛选出 ${filtered.length} 位艺人` : "按艺人维度整理你的本地资料库"}
          metrics={[
            { label: "艺人", value: `${artists.length} 位` },
            { label: "筛选", value: searchText ? `${filtered.length} 位` : "全部可见" },
            { label: "歌曲", value: `${artists.reduce((sum, item) => sum + item.count, 0)} 首` },
          ]}
        />
      </Section>
      {filtered.map(item => (
        <NavigationLink
          key={item.artist}
          destination={<ArtistDetail artist={item.artist} musics={item.musics} />}>
          <HStack spacing={12} padding={{ vertical: 4 }}>
            <Image systemName="person.circle.fill" frame={{ width: 40, height: 40 }} foregroundStyle="accentColor" />
            <VStack alignment="leading" spacing={2}>
              <Text font="headline" lineLimit={1}>{item.artist}</Text>
              <Text font="subheadline" foregroundStyle="secondaryLabel">{item.count} 首歌曲</Text>
            </VStack>
          </HStack>
        </NavigationLink>
      ))}
    </List>
  )
}