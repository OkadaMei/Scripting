import {
  Button, Color, Group, HStack, Image, Label, List, Menu,
  Section, Spacer, Text, Toolbar, ToolbarItem, VStack, useEffect, useState
} from "scripting"
import { database, Music } from "../../class/database"
import { player } from "../../class/player"
import { usePlayerState } from "../../class/player_state"
import { EmptyState } from "../components/empty_state"
import { LoadingState } from "../components/loading_state"
import { fileManager } from "../../class/file_manager"
import { PlaylistPickerContent } from "../components/playlist_picker"
import { PageSummaryCard } from "../components/page_summary_card"

type SmartSortType = "recent" | "title" | "artist"

function MusicRow({
  music,
  musics,
  coverExists,
  placeholderIcon,
  placeholderTint,
  onToggleFavorite,
  onDelete,
  onAddToPlaylist,
}: {
  music: Music
  musics: Music[]
  coverExists: Record<string, boolean>
  placeholderIcon: string
  placeholderTint: string
  onToggleFavorite: (m: Music) => void
  onDelete: (m: Music) => void
  onAddToPlaylist: (m: Music) => void
}) {
  const state = usePlayerState()
  const isPlaying = state.currentMusic?.id === music.id

  return (
    <HStack
      key={music.id}
      spacing={12}
      padding={{ vertical: 4 }}
      contextMenu={{
        menuItems: (
          <Group>
            <Button title={music.is_favorite ? "取消收藏" : "收藏"} action={() => onToggleFavorite(music)} />
            <Button title="添加到播放列表" action={() => onAddToPlaylist(music)} />
            <Button title="删除" role="destructive" action={() => onDelete(music)} />
          </Group>
        )
      }}
      leadingSwipeActions={{
        actions: [
          <Button tint="systemPink" action={() => onToggleFavorite(music)}>
            <Label title={music.is_favorite ? "取消" : "收藏"} systemImage="heart.fill" />
          </Button>
        ]
      }}
      trailingSwipeActions={{
        actions: [
          <Button role="destructive" action={() => onDelete(music)}>
            <Label title="删除" systemImage="trash" />
          </Button>
        ]
      }}
      onTapGesture={async () => {
        const idx = musics.indexOf(music)
        player.setQueue(musics, idx)
        await player.play(music)
      }}
    >
      {coverExists[music.id]
        ? <Image filePath={fileManager.getCoverPath(music.id)} frame={{ width: 40, height: 40 }} resizable={true} clipShape={{ type: "rect", cornerRadius: 6 }} />
        : <Image systemName={placeholderIcon} frame={{ width: 40, height: 40 }} foregroundStyle={isPlaying ? "accentColor" as Color : placeholderTint as Color} />
      }
      <VStack alignment="leading" spacing={2}>
        <Text font="headline" lineLimit={1} foregroundStyle={isPlaying ? "accentColor" : undefined}>{music.title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{music.artist}</Text>
      </VStack>
      <Spacer />
      {isPlaying && <Image systemName="waveform" tint="accentColor" />}
    </HStack>
  )
}

export function RecentlyPlayedView() {
  const [musics, setMusics] = useState<Music[]>([])
  const [coverExists, setCoverExists] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const [selectedMusic, setSelectedMusic] = useState<Music | null>(null)
  const [sortType, setSortType] = useState<SmartSortType>(Storage.get<SmartSortType>("recently_played_sort") ?? "recent")
    const [searchText, setSearchText] = useState("")

    const filtered = searchText ? musics.filter(m => m.title.toLowerCase().includes(searchText.toLowerCase()) || m.artist.toLowerCase().includes(searchText.toLowerCase())) : musics

    useEffect(() => { loadMusics() }, [])

  async function loadMusics() {
    try {
      const data = await database.getRecentlyPlayed(50)
      setMusics(sortMusics(data, sortType))
      const exists: Record<string, boolean> = {}
      await Promise.all(data.map(async m => { exists[m.id] = await fileManager.coverExists(m.id) }))
      setCoverExists(exists)
    } catch (error) {
      console.error("加载最近播放失败:", error)
    } finally {
      setLoading(false)
    }
  }

  function sortMusics(data: Music[], type: SmartSortType): Music[] {
    const sorted = [...data]
    switch (type) {
      case "title": return sorted.sort((a, b) => a.title.localeCompare(b.title))
      case "artist": return sorted.sort((a, b) => a.artist.localeCompare(b.artist))
      default: return sorted.sort((a, b) => (b.last_played_at || 0) - (a.last_played_at || 0))
    }
  }

  useEffect(() => {
    setMusics(prev => sortMusics(prev, sortType))
        Storage.set("recently_played_sort", sortType)
  }, [sortType])

  async function toggleFavorite(music: Music) {
    await database.toggleFavorite(music.id)
    await loadMusics()
  }

  async function deleteMusic(music: Music) {
    try {
      if (music.is_downloaded) await FileManager.remove(fileManager.getAudioPath(music.id))
      await database.deleteMusic(music.id)
      await loadMusics()
    } catch (error) {
      console.error("删除音乐失败:", error)
    }
  }

  async function addToPlaylist(playlistId: string) {
    if (!selectedMusic) return
    try {
      await database.addMusicToPlaylist(playlistId, selectedMusic.id)
      setShowPlaylistPicker(false)
      setSelectedMusic(null)
    } catch (error) {
      console.error("添加到播放列表失败:", error)
    }
  }

  if (loading) return <LoadingState message="加载最近播放中..." />
  if (musics.length === 0) return <EmptyState icon="clock" title="暂无播放记录" message="播放音乐后会显示在这里" />

  return (
    <List
    >
      <Section>
        <PageSummaryCard
          title="最近播放"
          subtitle={searchText ? `当前筛选出 ${filtered.length} 首最近播放歌曲` : "回到你刚刚听过的音乐，延续当前的聆听状态"}
          metrics={[
            { label: "记录", value: `${musics.length} 首` },
            { label: "筛选", value: searchText ? `${filtered.length} 首` : "全部可见" },
            { label: "排序", value: sortType === "recent" ? "播放时间" : sortType === "title" ? "歌曲名称" : "艺人名称" },
          ]}
        />
      </Section>
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
      <Section>
              {filtered.map(music => (
                <MusicRow
                  key={music.id}
                  music={music}
                  musics={filtered}
            coverExists={coverExists}
            placeholderIcon="clock.fill"
            placeholderTint="secondaryLabel"
            onToggleFavorite={toggleFavorite}
            onDelete={deleteMusic}
            onAddToPlaylist={m => { setSelectedMusic(m); setShowPlaylistPicker(true) }}
          />
        ))}
      </Section>
    </List>
  )
}

export function TopPlayedView() {
  const [musics, setMusics] = useState<Music[]>([])
  const [coverExists, setCoverExists] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false)
  const [selectedMusic, setSelectedMusic] = useState<Music | null>(null)
  const [sortType, setSortType] = useState<SmartSortType>(Storage.get<SmartSortType>("top_played_sort") ?? "recent")
    const [searchText, setSearchText] = useState("")

    const filtered = searchText ? musics.filter(m => m.title.toLowerCase().includes(searchText.toLowerCase()) || m.artist.toLowerCase().includes(searchText.toLowerCase())) : musics

    useEffect(() => { loadMusics() }, [])

  async function loadMusics() {
    try {
      const all = await database.getAllMusic()
      const data = all.filter(m => m.play_count > 0).slice(0, 50)
      setMusics(sortMusics(data, sortType))
      const exists: Record<string, boolean> = {}
      await Promise.all(data.map(async m => { exists[m.id] = await fileManager.coverExists(m.id) }))
      setCoverExists(exists)
    } catch (error) {
      console.error("加载最爱精选失败:", error)
    } finally {
      setLoading(false)
    }
  }

  function sortMusics(data: Music[], type: SmartSortType): Music[] {
    const sorted = [...data]
    switch (type) {
      case "title": return sorted.sort((a, b) => a.title.localeCompare(b.title))
      case "artist": return sorted.sort((a, b) => a.artist.localeCompare(b.artist))
      default: return sorted.sort((a, b) => b.play_count - a.play_count)
    }
  }

  useEffect(() => {
    setMusics(prev => sortMusics(prev, sortType))
    Storage.set("top_played_sort", sortType)
  }, [sortType])

  async function toggleFavorite(music: Music) {
    await database.toggleFavorite(music.id)
    await loadMusics()
  }

  async function deleteMusic(music: Music) {
    try {
      if (music.is_downloaded) await FileManager.remove(fileManager.getAudioPath(music.id))
      await database.deleteMusic(music.id)
      await loadMusics()
    } catch (error) {
      console.error("删除音乐失败:", error)
    }
  }

  async function addToPlaylist(playlistId: string) {
    if (!selectedMusic) return
    try {
      await database.addMusicToPlaylist(playlistId, selectedMusic.id)
      setShowPlaylistPicker(false)
      setSelectedMusic(null)
    } catch (error) {
      console.error("添加到播放列表失败:", error)
    }
  }

  if (loading) return <LoadingState message="加载最爱精选中..." />
  if (musics.length === 0) return <EmptyState icon="star" title="暂无播放记录" message="多听几首歌曲后会显示在这里" />

  return (
    <List
          navigationTitle="最爱精选"
          searchable={{ value: searchText, onChanged: setSearchText }}
                    sheet={{
        isPresented: showPlaylistPicker,
        onChanged: (v: boolean) => { if (!v) { setShowPlaylistPicker(false); setSelectedMusic(null) } },
        content: <PlaylistPickerContent onSelect={addToPlaylist} onDismiss={() => { setShowPlaylistPicker(false); setSelectedMusic(null) }} />
      }}
      toolbar={
        <Toolbar>
          <ToolbarItem placement="topBarTrailing">
            <Menu label={<Image systemName="arrow.up.arrow.down" />}>
              <Button title="按播放次数" systemImage={sortType === "recent" ? "checkmark" : undefined} action={() => setSortType("recent")} />
              <Button title="按歌曲名称" systemImage={sortType === "title" ? "checkmark" : undefined} action={() => setSortType("title")} />
              <Button title="按艺人名称" systemImage={sortType === "artist" ? "checkmark" : undefined} action={() => setSortType("artist")} />
            </Menu>
          </ToolbarItem>
        </Toolbar>
      }
    >
      <Section>
        <PageSummaryCard
          title="最爱精选"
          subtitle={searchText ? `当前筛选出 ${filtered.length} 首高频播放歌曲` : "把你最常播放的歌曲整理成一组更稳定的常听精选"}
          metrics={[
            { label: "精选", value: `${musics.length} 首` },
            { label: "筛选", value: searchText ? `${filtered.length} 首` : "全部可见" },
            { label: "排序", value: sortType === "recent" ? "播放次数" : sortType === "title" ? "歌曲名称" : "艺人名称" },
          ]}
        />
      </Section>
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
      <Section>
              {filtered.map(music => (
                <MusicRow
                  key={music.id}
                  music={music}
                  musics={filtered}
            coverExists={coverExists}
            placeholderIcon="star.fill"
            placeholderTint="systemYellow"
            onToggleFavorite={toggleFavorite}
            onDelete={deleteMusic}
            onAddToPlaylist={m => { setSelectedMusic(m); setShowPlaylistPicker(true) }}
          />
        ))}
      </Section>
    </List>
  )
}