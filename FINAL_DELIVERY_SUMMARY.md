# Bangumi Beta 交付总结

## 1. 项目定位

Bangumi Beta 现在是一个运行在 Scripting App 内的 **Bangumi 在线客户端原型**。项目已从原先保留的本地音乐播放器壳层，转向以 Bangumi 番组数据、OAuth 会话、发现/搜索/进度/时间线/超展开为核心的内容型应用。

当前目标：

- 用 Scripting 的 SwiftUI-like 组件还原接近 Bangumi-iOS 的多 Tab 浏览体验
- 优先接入 Bangumi 真实 API，网络失败或未配置 OAuth 时使用本地 mock 兜底
- 支持 OAuth 登录、会话恢复、通知、收藏状态与章节进度操作
- 已清理旧本地音乐播放器页面、类、测试与 Widget 残留，入口、Intent 与桌面小组件均收口为 Bangumi 能力

---

## 2. 已交付能力

### 2.1 主界面与导航

- `page/index.tsx` 挂载 `BangumiHomePage`
- `page/bangumi/index.tsx` 提供 Tab 壳层与顶层状态编排
- Tab 条件：
  - 时间线 `Timeline`
  - 进度 `Progress`（登录后）
  - 超展开 `Rakuen`（非单机模式）
  - 设置 `Settings`
  - 发现 `Discover`
- 支持最小化恢复：关闭按钮调用 `Script.minimize()`，OAuth 回调会在恢复后继续消费

### 2.2 Bangumi API 客户端

核心文件：`page/bangumi/client.ts`

已支持：

- 公共接口与私有接口封装
- OAuth 客户端配置本地存储
- 授权 URL 生成与回调地址生成
- 手动粘贴 code 兑换 token
- `Script.queryParameters` / `Script.onResume` 自动消费 OAuth 回调
- access token 过期前刷新
- 私有请求 401 后刷新重试
- OAuth 调试信息记录、复制、清空

当前客户端命名线索沿用 Bangumi-iOS / Chii：

- `Chii`
- `https://api.bgm.tv`
- `https://next.bgm.tv`
- `loadCalendar`
- `loadTrendingSubjects`
- `loadSubjectDetails`
- `loadUser`
- `getSubjectCollection(s)`
- `getTimeline`
- `searchSubjects / searchCharacters / searchPersons`

### 2.3 发现页与搜索

核心文件：`page/bangumi/pages-core.tsx`、`page/bangumi/store.ts`

已支持：

- 七日每日放送选择器，默认选中今天
- 每日放送优先接入真实 `/calendar` / `p1/calendar` / `v0/calendar`
- 热门条目按动画、书籍、音乐、游戏、三次元分组加载
- 每组使用“紧凑主推行 + 小列表行”，减少双列海报拥挤
- 条目搜索支持类型筛选
- 角色/人物搜索支持远程接口与详情跳转
- 搜索默认远程模式，保留本地索引模式作为回退
- 使用 selected id/key + 单一 presentation 型 `navigationDestination`，避免多 `NavigationLink destination/value` 与列表按钮复用导致连续入栈或总是打开最后一条

### 2.4 条目、角色/人物、用户详情

已支持：

- 条目详情加载真实条目基础信息、章节、短评、讨论版
- 条目图片优先显示 Bangumi API 的 `images.common/grid/large/medium/small` 等字段
- 角色/人物详情加载 casts / works / relations，并可回链条目详情
- 用户详情加载真实用户摘要、签名、收藏概览
- 未登录或请求失败时保留 mock 数据兜底

### 2.5 收藏与章节进度

已支持：

- 查询当前账号对单条目的真实收藏状态
- 条目详情提供“想看 / 在看 / 看过 / 搁置 / 抛弃”快速操作
- 收藏写入优先使用授权公开 API，next 私有接口作为候选兜底
- 章节列表支持：
  - 标记看过
  - 看到这里
  - 取消看过
- 章节进度写入已修正为携带 `subjectId`：单话使用 `PUT v0/users/-/collections/-/episodes/{episodeId}`，批量“看到这里”使用 `PATCH v0/users/-/collections/{subjectId}/episodes`
- 每话可进入评论详情，讨论主题可进入讨论详情

### 2.6 通知、时间线与进度页

已支持：

- 时间线右上角通知入口
- 通知页读取 `notify` 响应，展示未读数、总数、提醒列表
- 进度页优先使用真实收藏数据
- 进度页支持分类、收藏状态筛选，以及收藏时间/最后更新/评分/名称排序
- 设置页展示真实登录状态、账号摘要、客户端配置与 OAuth 调试信息

### 2.7 发布级 UI 与桌面小组件收尾

已支持：

- 根入口与 App Intents 全面脱离旧本地音乐播放器
- 桌面小组件入口已改为 `widget/loader.ts` 在 `Widget.present()` 前异步读取真实 Bangumi 数据：收藏进度、每日放送、通知与超展开；不再从 `page/bangumi/data.ts` 读取本地 mock 列表
- 小组件数据状态显式区分 `实时同步 / 部分同步 / 未登录 / 同步失败 / 上次同步`，失败时展示空态或上次真实快照，不把 mock 伪装成真实内容
- 小组件按 `systemSmall` / `systemMedium` / `systemLarge` 重新设定信息层级：小尺寸只保留核心 KPI 与一个主进度/空态卡，中尺寸为主进度 + 统计双栏，大尺寸限制为统计、主进度、今日放送与一个社区动态，避免内容溢出
- 小组件根容器使用 `Widget.displaySize` 精确铺满、`widgetBackground` + `background` 双重背景、`contentMargins` 归零与 `ignoresSafeArea`，并将 widget frame 的 `Infinity` 改为 Scripting 支持的 `"infinity"`，修复中/大尺寸两侧白边
- 小组件不再暴露播放/上一首/下一首控制，整卡点击回到 Bangumi Beta
- `page/bangumi/ui.tsx` 通用 Hero、Card、InfoSection、空状态与未登录提示文案已做发布级收口
- `script.json` 已统一 Bangumi 粉色品牌色与 `sparkles` 图标

---

## 3. 当前项目结构

```text
/
├── index.tsx                 # Scripting 运行入口，直接展示 HomePage
├── page/index.tsx            # 当前主入口：挂载 BangumiHomePage，关闭时最小化
├── page/bangumi/
│   ├── index.tsx             # Bangumi 顶层 Tab、设置页、部分详情页
│   ├── pages-core.tsx        # Timeline / Progress / Discover / Notice 等核心页面
│   ├── client.ts             # Bangumi API、OAuth、会话、调试信息
│   ├── store.ts              # 数据加载、真实响应适配、mock 回退
│   ├── types.ts              # Bangumi 数据类型
│   ├── ui.tsx                # 通用展示组件
│   └── data.ts               # mock / fallback 数据
├── widget.tsx                # Bangumi 桌面小组件入口，按尺寸展示今日/进度/社区摘要
├── widget/                   # Bangumi 小组件组件与数据类型
├── app_intents.tsx           # Bangumi 小组件交互 Intent：主题跟随系统 / 专注模式
├── plan.md                   # Bangumi Beta 后续开发计划
├── rules.md                  # Bangumi Beta 开发规范
└── script.json               # 脚本元数据
```

---

## 4. 关键实现约束

- 真实接口优先，mock 只作为失败兜底，不应覆盖真实响应
- OAuth 登录状态以本地 token 快照为准，不再使用模拟登录开关
- 写操作必须在 UI 上给出明确反馈，失败时保留当前本地状态
- 列表内跳转优先使用 selected id/key + 单一 presentation 型 `navigationDestination`，避免多 `NavigationLink destination/value` 或列表按钮 action 复用导致连续入栈
- 图片 URL 需在 `store.ts` 中统一规范化，UI 只负责展示
- 新页面优先拆到 `pages-core.tsx` 或新的页面文件，避免继续膨胀 `page/bangumi/index.tsx`

---

## 5. 未完成/待推进

- 将 `Rakuen / Settings / Subject / User / Mono / Episode / Topic` 等仍在 `index.tsx` 的页面继续拆分
- 持续校准 Bangumi API 候选路径与字段适配
- 补充更稳定的 UI 预览与测试入口

---

**最后更新**：2026/06/28
