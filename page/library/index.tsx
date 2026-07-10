import {
  HStack,
  List,
  NavigationLink,
  Script,
  Section,
  Spacer,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { hanimeClient, HanimeHomePage, HanimeVideoItem, HANIME_BASE_URL } from "../../class/hanime"
import { hanimeDatabase, HanimeStats } from "../../class/hanime_database"
import { EmptyState } from "../components/empty_state"
import { ErrorState } from "../components/error_state"
import { LoadingState } from "../components/loading_state"
import { VideoDetailView } from "../hanime/video_detail"
import { HanimeVideoRow, VideoCover } from "../hanime/video_components"
import { HanimeActionPill, HanimeHeroCard } from "../components/hanime_ui"

const AGE_NOTICE_KEY = "girigiri_notice_accepted"

export function LibraryView() {
  const [home, setHome] = useState<HanimeHomePage | null>(null)
  const [stats, setStats] = useState<HanimeStats>({ favorites: 0, history: 0, downloads: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadHome()
  }, [])

  async function ensureAgeNotice(): Promise<boolean> {
    if (Storage.get(AGE_NOTICE_KEY) === true) return true
    const confirmed = await Dialog.confirm({
      title: "内容访问提示",
      message: "本脚本会读取 GiriGiri 公开页面信息；点选播放时会解析公开播放页中的视频直链，并交给 iOS 系统播放器。能否加载与播放取决于站点当前可访问状态，请遵守站点规则与版权限制。",
      confirmLabel: "我已知晓",
      cancelLabel: "退出",
    })
    if (confirmed) {
      Storage.set(AGE_NOTICE_KEY, true)
      return true
    }
    Script.minimize()
    return false
  }

  async function loadHome() {
    try {
      if (!(await ensureAgeNotice())) return
      setLoading(true)
      setError(null)
      const [homePage, currentStats] = await Promise.all([
        hanimeClient.getHomePage(),
        hanimeDatabase.getStats(),
      ])
      setHome(homePage)
      setStats(currentStats)
    } catch (loadError) {
      console.error("加载 GiriGiri 首页失败:", loadError)
      setError(`${loadError}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !home) {
    return (
      <List listStyle="inset">
        <Section>
          <LoadingState message="正在加载首页..." />
        </Section>
      </List>
    )
  }

  if (error && !home) {
    return (
      <List listStyle="inset">
        <Section>
          <ErrorState message={error} onRetry={() => { void loadHome() }} />
        </Section>
      </List>
    )
  }

  return (
    <List listStyle="inset" onAppear={() => { void hanimeDatabase.getStats().then(setStats) }}>
      <Section>
        <HanimeHeroCard
          eyebrow="GIRIGIRI · HOME"
          title="今日推荐"
          subtitle="从首页推荐与分类列表发现内容；播放将直接交给 iOS 系统播放器。"
          stats={[
            { title: "收藏", value: `${stats.favorites} 部`, icon: "heart.fill" },
            { title: "历史", value: `${stats.history} 部`, icon: "clock.fill" },
            { title: "本机文件", value: `${stats.downloads} 项`, icon: "tray.fill" },
          ]}
          actions={[
            <HanimeActionPill key="refresh" title="刷新" systemImage="arrow.clockwise" action={() => { void loadHome() }} />,
            <HanimeActionPill key="site" title="打开官网" systemImage="safari" action={() => { void Safari.present(HANIME_BASE_URL, true) }} tone="secondary" />,
          ]}
        />
      </Section>

      {home?.banner ? (
        <Section title="编辑推荐">
          <NavigationLink destination={<VideoDetailView video={bannerToVideo(home.banner)} />}>
            <BannerRow banner={home.banner} />
          </NavigationLink>
        </Section>
      ) : null}

      {home && home.sections.length > 0 ? home.sections.map((section) => (
        <Section key={section.id} title={section.title}>
          {section.items.map((item) => (
            <NavigationLink key={item.videoCode} destination={<VideoDetailView video={item} />}>
              <HanimeVideoRow video={item} />
            </NavigationLink>
          ))}
        </Section>
      )) : null}

      {!loading && home && home.sections.length === 0 ? (
        <Section>
          <EmptyState
            icon="film.stack"
            title="暂无首页内容"
            message="可能需要先完成站点验证，或稍后返回刷新。"
            actionTitle="打开官网"
            action={() => { void Safari.present(HANIME_BASE_URL, true) }}
          />
        </Section>
      ) : null}
    </List>
  )
}

function BannerRow({ banner }: { banner: NonNullable<HanimeHomePage["banner"]> }) {
  return (
    <HStack spacing={12} padding={{ vertical: 4 }} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <VideoCover url={banner.picUrl} size={96} />
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity" }}>
        <Text font="headline" lineLimit={2}>{banner.title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={2}>
          {banner.description || "首页推荐"}
        </Text>
      </VStack>
      <Spacer />
    </HStack>
  )
}

function bannerToVideo(banner: NonNullable<HanimeHomePage["banner"]>): HanimeVideoItem {
  return {
    title: banner.title,
    coverUrl: banner.picUrl,
    videoCode: banner.videoCode || "",
    itemType: "simplified",
  }
}
