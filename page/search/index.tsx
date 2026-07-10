import {
  Button,
  HStack,
  Image,
  Label,
  List,
  NavigationLink,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
  useEffect,
  useState,
} from "scripting"
import {
  hanimeClient,
  HANIME_GENRE_OPTIONS,
  HANIME_SORT_OPTIONS,
  HanimeVideoItem,
} from "../../class/hanime"
import { hanimeDatabase } from "../../class/hanime_database"
import { EmptyState } from "../components/empty_state"
import { ErrorState } from "../components/error_state"
import { LoadingState } from "../components/loading_state"
import { VideoDetailView } from "../hanime/video_detail"
import { HanimeVideoRow } from "../hanime/video_components"
import { HanimeActionPill, HanimeHeroCard } from "../components/hanime_ui"
import { HANIME_THEME } from "../theme"

export function SearchView() {
  const [keyword, setKeyword] = useState("")
  const [sort, setSort] = useState("time")
  const [genre, setGenre] = useState("2")
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<HanimeVideoItem[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadHistory()
  }, [])

  async function loadHistory() {
    try {
      setHistory(await hanimeDatabase.getSearchHistory())
    } catch (historyError) {
      console.error("加载 GiriGiri 搜索历史失败:", historyError)
    }
  }

  async function runSearch(nextPage: number = 1, nextKeyword: string = keyword, nextSort: string = sort, nextGenre: string = genre) {
    try {
      setLoading(true)
      setError(null)
      setSort(nextSort)
      setGenre(nextGenre)
      setPage(nextPage)
      const normalizedKeyword = nextKeyword.trim()
      setKeyword(normalizedKeyword)
      if (normalizedKeyword) {
        await hanimeDatabase.addSearchHistory(normalizedKeyword)
      }
      const data = await hanimeClient.searchVideos({
        query: normalizedKeyword || undefined,
        page: nextPage,
        sort: nextSort || undefined,
        genre: nextGenre || undefined,
      })
      setResults(nextPage === 1 ? data : mergeResults(results, data))
      await loadHistory()
    } catch (searchError) {
      console.error("GiriGiri 搜索失败:", searchError)
      setError(`${searchError}`)
    } finally {
      setLoading(false)
    }
  }

  async function clearSearchHistory() {
    await hanimeDatabase.clearSearchHistory()
    await loadHistory()
  }

  const selectedSort = HANIME_SORT_OPTIONS.find((option) => option.value === sort)?.label || "相关"
  const selectedGenre = HANIME_GENRE_OPTIONS.find((option) => option.value === genre)?.label || "日番"

  return (
    <List listStyle="inset">
      <Section>
        <HanimeHeroCard
          eyebrow="GIRIGIRI · SEARCH"
          title="发现你想看的内容"
          subtitle="输入标题、作者或标签；也可以直接按分类与排序探索公开列表。"
          stats={[
            { title: "排序", value: selectedSort, icon: "arrow.up.arrow.down.circle.fill" },
            { title: "分类", value: selectedGenre, icon: "square.grid.2x2.fill" },
            { title: "结果", value: `${results.length} 部`, icon: "film.stack.fill" },
          ]}
          actions={[
            <HanimeActionPill key="search" title={loading ? "搜索中" : "开始搜索"} systemImage="magnifyingglass" action={() => { void runSearch(1) }} disabled={loading} />,
            <HanimeActionPill key="browse" title="分类浏览" systemImage="sparkles" action={() => { setKeyword(""); void runSearch(1, "", sort, genre) }} disabled={loading} tone="secondary" />,
          ]}
        />
      </Section>

      <Section>
        <VStack
          alignment="leading"
          spacing={10}
          padding={HANIME_THEME.layout.section}
          frame={{ maxWidth: "infinity", alignment: "leading" }}
          background={{
            style: HANIME_THEME.library.softAccentCardBackground,
            shape: { type: "rect", cornerRadius: HANIME_THEME.layout.heroRadius },
          }}
        >
          <HStack spacing={8}>
            <Image systemName="magnifyingglass" font="subheadline" foregroundStyle="systemPink" />
            <Text font="headline" fontWeight="semibold">关键词搜索</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">标题 · 作者 · 标签</Text>
          </HStack>
          <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
            <HStack spacing={8} padding={{ horizontal: 12, vertical: 2 }} frame={{ maxWidth: "infinity", minHeight: 46 }} background={HANIME_THEME.library.statCardBackground} clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.controlRadius }}>
              <Image systemName="text.cursor" font="caption" foregroundStyle="tertiaryLabel" />
              <TextField
                title="关键词"
                value={keyword}
                onChanged={setKeyword}
                prompt="输入想看的内容"
                onSubmit={() => { void runSearch(1) }}
                frame={{ maxWidth: "infinity" }}
              />
            </HStack>
            <Button action={() => { void runSearch(1) }} disabled={loading || !keyword.trim()} buttonStyle="plain">
              <HStack spacing={6} padding={{ horizontal: 14, vertical: 10 }} frame={{ minHeight: 46 }} background="systemPink" clipShape={{ type: "rect", cornerRadius: HANIME_THEME.layout.controlRadius }}>
                <Image systemName="arrow.right" font="caption" foregroundStyle="white" />
                <Text font="subheadline" fontWeight="semibold" foregroundStyle="white">搜索</Text>
              </HStack>
            </Button>
          </HStack>
          <Text font="caption" foregroundStyle="secondaryLabel">输入关键词后点搜索，或直接使用键盘搜索键提交。</Text>
        </VStack>
      </Section>

      <Section title={`排序 · 当前 ${selectedSort}`}>
        {HANIME_SORT_OPTIONS.map((option) => (
          <Button key={option.value || "relevance"} action={() => { void runSearch(1, keyword, option.value, genre) }}>
            <OptionRow title={option.label} selected={sort === option.value} />
          </Button>
        ))}
      </Section>

      <Section title="分类">
        {HANIME_GENRE_OPTIONS.map((option) => (
          <Button key={option.value || "all"} action={() => { void runSearch(1, keyword, sort, option.value) }}>
            <OptionRow title={option.label} selected={genre === option.value} />
          </Button>
        ))}
      </Section>

      {history.length > 0 ? (
        <Section title="搜索历史">
          {history.map((item) => (
            <Button key={item} action={() => { setKeyword(item); void runSearch(1, item) }}>
              <HStack spacing={12}>
                <Image systemName="clock.arrow.circlepath" frame={{ width: 22 }} foregroundStyle="secondaryLabel" />
                <Text>{item}</Text>
                <Spacer />
                <Image systemName="arrow.up.left" foregroundStyle="tertiaryLabel" />
              </HStack>
            </Button>
          ))}
          <Button role="destructive" action={() => { void clearSearchHistory() }}>
            <Label title="清空搜索历史" systemImage="trash" />
          </Button>
        </Section>
      ) : null}

      {error ? (
        <Section>
          <ErrorState message={error} onRetry={() => { void runSearch(page) }} />
        </Section>
      ) : null}

      {loading && results.length === 0 ? (
        <Section>
          <LoadingState message="正在搜索..." />
        </Section>
      ) : null}

      {results.length > 0 ? (
        <Section title={`搜索结果 · 已加载 ${page} 页 · ${results.length} 部`}>
          {results.map((video) => (
            <NavigationLink key={video.videoCode} destination={<VideoDetailView video={video} />}>
              <HanimeVideoRow video={video} />
            </NavigationLink>
          ))}
          <Button action={() => { void runSearch(page + 1) }} disabled={loading}>
            <Label title={loading ? "加载中" : "加载下一页"} systemImage="arrow.down.circle" />
          </Button>
        </Section>
      ) : null}

      {!loading && !error && results.length === 0 ? (
        <Section>
          <EmptyState
            icon="magnifyingglass"
            title="输入关键词开始搜索"
            message="输入关键词，或直接查看日番最新列表。"
            actionTitle="查看日番最新"
            action={() => { void runSearch(1, "", "time", "2") }}
          />
        </Section>
      ) : null}
    </List>
  )
}

function OptionRow({ title, selected }: { title: string; selected: boolean }) {
  return (
    <HStack spacing={12}>
      <Text>{title}</Text>
      <Spacer />
      {selected ? <Image systemName="checkmark.circle.fill" tint="systemPink" /> : null}
    </HStack>
  )
}

function mergeResults(current: HanimeVideoItem[], next: HanimeVideoItem[]): HanimeVideoItem[] {
  const byCode = new Map<string, HanimeVideoItem>()
  for (const item of current) byCode.set(item.videoCode, item)
  for (const item of next) byCode.set(item.videoCode, item)
  return Array.from(byCode.values())
}
