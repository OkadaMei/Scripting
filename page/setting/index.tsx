import {
  Button,
  HStack,
  Image,
  List,
  Script,
  Section,
  Spacer,
  Text,
  VStack,
  useEffect,
  useState,
} from "scripting"
import { HanimeHeroCard } from "../components/hanime_ui"
import { hanimeDatabase, HanimeStats } from "../../class/hanime_database"

const AGE_NOTICE_KEY = "girigiri_notice_accepted"

export function SettingView() {
  const [stats, setStats] = useState<HanimeStats>({ favorites: 0, history: 0, downloads: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadStats()
  }, [])

  async function loadStats() {
    try {
      setLoading(true)
      setStats(await hanimeDatabase.getStats())
    } catch (error) {
      console.error("加载 GiriGiri 设置统计失败:", error)
    } finally {
      setLoading(false)
    }
  }

  async function resetAgeNotice() {
    Storage.remove(AGE_NOTICE_KEY)
    await Dialog.alert({ title: "已重置", message: "下次进入浏览页时会重新显示内容访问提示。" })
  }

  async function clearLocalData() {
    const confirmed = await Dialog.confirm({
      title: "清空本地数据",
      message: "确定清空观看历史与搜索历史吗？收藏会保留。",
      confirmLabel: "清空",
      cancelLabel: "取消",
    })
    if (!confirmed) return
    await hanimeDatabase.clearHistory()
    await hanimeDatabase.clearSearchHistory()
    await loadStats()
  }

  return (
    <List listStyle="inset" onAppear={() => { void loadStats() }}>
      <Section>
        <HanimeHeroCard
          eyebrow="PREFERENCES"
          title="设置与数据"
          subtitle="管理收藏、观看记录、离线剧集与内容访问提示。"
          tone="soft"
          stats={[
            { title: "收藏", value: loading ? "加载中" : `${stats.favorites} 部`, icon: "heart.fill" },
            { title: "历史", value: loading ? "加载中" : `${stats.history} 部`, icon: "clock.fill" },
            { title: "本机文件", value: loading ? "加载中" : `${stats.downloads} 项`, icon: "tray.fill" },
          ]}
        />
      </Section>

      <Section title="数据管理">
        <Button action={clearLocalData}>
          <SettingActionRow icon="trash.circle" title="清空本机历史" subtitle="清除观看与搜索记录，收藏会保留" />
        </Button>
        <Button action={resetAgeNotice}>
          <SettingActionRow icon="exclamationmark.circle" title="重新显示访问提示" subtitle="下次打开浏览页时再次显示内容说明" />
        </Button>
        <Text font="caption" foregroundStyle="secondaryLabel" multilineTextAlignment="leading">
          此操作只清理本机记录，不会影响站点账号、远端收藏或内容。
        </Text>
      </Section>

      <Section title="功能边界">
        <CapabilityTable />
      </Section>

      <Section title="免责声明">
        <Text font="caption" foregroundStyle="secondaryLabel">
          本脚本仅用于整理公开页面信息及用户有权离线使用的内容。离线下载仅处理可识别的直链视频、无 DRM HLS 与符合站点规则的 AES-128 播放清单；会优先封装为 MP4，无法封装时保留 HLS 离线播放包。不处理 DRM、Sample-AES / FairPlay、访问控制规避或内容再分发。请遵守所在地法律、站点规则与版权限制。
        </Text>
      </Section>

      <Section title="关于">
        <SettingInfoRow icon="number" title="版本" value={Script.metadata.version} />
        <SettingInfoRow icon="app.badge" title="脚本" value={Script.metadata.localizedName} />
      </Section>
    </List>
  )
}

function SettingInfoRow({ icon, title, value }: { icon: string; title: string; value: string }) {
  return (
    <HStack spacing={12} padding={{ vertical: 3 }}>
      <Image systemName={icon} frame={{ width: 22, height: 22 }} foregroundStyle="secondaryLabel" />
      <Text font="body">{title}</Text>
      <Spacer />
      <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={1}>{value}</Text>
    </HStack>
  )
}

function CapabilityTable() {
  return (
    <VStack spacing={10} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      <CapabilityCard
        icon="checkmark.circle"
        title="已支持"
        subtitle="公开浏览、分类与搜索、详情与标签、字幕剧集选择、播放地址解析、iOS 系统播放、收藏与历史；支持逐集直链与无 DRM HLS 离线下载，优先无损封装 MP4，并可保留 HLS 离线播放包。"
        tint="label"
      />
      <CapabilityCard
        icon="xmark.circle"
        title="不提供"
        subtitle="账号互动、评论与云端同步、后台批量下载、跨会话断点续传、DRM / Sample-AES / FairPlay 保存、访问控制规避及内容再分发。MP4 封装兼容性受来源与系统环境限制。"
        tint="secondaryLabel"
      />
    </VStack>
  )
}

function CapabilityCard({ icon, title, subtitle, tint }: { icon: string; title: string; subtitle: string; tint: SettingSymbolTint }) {
  return (
    <HStack alignment="top" spacing={12} frame={{ maxWidth: "infinity", alignment: "leading" }} padding={{ vertical: 6 }}>
      <SettingSymbol icon={icon} tint={tint} />
      <VStack alignment="leading" spacing={4} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text font="headline">{title}</Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={5} multilineTextAlignment="leading">
          {subtitle}
        </Text>
      </VStack>
    </HStack>
  )
}

function SettingActionRow({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <HStack spacing={12} padding={{ vertical: 4 }}>
      <SettingSymbol icon={icon} tint="label" />
      <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <Text foregroundStyle="label">{title}</Text>
        {subtitle ? <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={2}>{subtitle}</Text> : null}
      </VStack>
    </HStack>
  )
}

type SettingSymbolTint = "label" | "secondaryLabel"

function SettingSymbol({ icon, tint }: { icon: string; tint: SettingSymbolTint }) {
  return (
    <Image
      systemName={icon}
      font={22}
      frame={{ width: 28, height: 28, alignment: "center" }}
      foregroundStyle={tint}
    />
  )
}
