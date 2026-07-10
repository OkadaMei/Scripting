# Bangumi Beta 开发规则

## 文档管理

- `plan.md`：记录 Bangumi Beta 当前阶段、已完成能力与后续计划
- `rules.md`：记录开发规范、交互规则、API 适配约束
- `FINAL_DELIVERY_SUMMARY.md`：记录当前交付能力与关键文件说明
- 若新增阶段性长文档，优先放在项目根目录或专门的 `docs/` 目录，并避免继续沿用 Music Player 术语

---

## 当前主线

本项目当前主线是 **Bangumi 在线客户端**，不是 Music Player。

新增或修改功能时应优先围绕：

- Bangumi 发现页、每日放送、热门条目
- 条目 / 角色 / 人物 / 用户详情
- OAuth 登录、会话恢复、token 刷新
- 收藏状态、章节进度、通知、时间线
- Bangumi 风格 UI 与 Scripting 生命周期适配

旧音乐播放器代码仍在项目中，但除非任务明确要求清理/迁移，不应继续扩展其功能。

---

## 代码规范

### 命名约定

- **文件名**：`kebab-case` 或既有项目文件命名；修改旧文件时保持原名
- **变量/函数**：`camelCase`
- **组件/类型**：`PascalCase`
- **常量**：语义清晰即可，已有 `UPPER_SNAKE_CASE` 可保留

### 代码风格

- 优先使用 `const`
- 尽量显式类型，避免新增不必要的 `any`
- 两空格缩进
- 只编写完成当前需求所需的最少代码
- 保持改动集中，不混入旧音乐播放器无关重构

### 文件职责

- `page/bangumi/client.ts`
  - 只放 API 请求、OAuth、token、客户端配置、调试信息
- `page/bangumi/store.ts`
  - 负责真实响应适配、mock fallback、页面数据组装、写操作后的本地同步
- `page/bangumi/types.ts`
  - 负责 Bangumi 数据结构类型
- `page/bangumi/ui.tsx`
  - 负责通用展示组件，不直接写 API 逻辑
- `page/bangumi/pages-core.tsx`
  - 放已拆出的核心页面
- `page/bangumi/index.tsx`
  - 仅保留顶层壳层与尚未拆分的页面；后续应逐步瘦身

---

## API 与数据适配规则

- 真实 Bangumi API 响应优先，mock 只做兜底
- 不允许用 mock 默认收藏状态覆盖真实远程条目
- 图片字段在 `store.ts` 统一规范化，UI 层只消费 `imageUrl` / `avatarUrl`
- 私有请求需要先走 `ensureBangumiAuth()`，401 后最多刷新并重试一次
- OAuth 回调必须同时支持：
  - `Script.queryParameters`
  - `Script.onResume(details.queryParameters)`
- OAuth 调试信息要可复制、可清空，避免把错误隐藏在控制台里
- 写操作失败时必须保留当前 UI 状态，并提供可读错误提示

---

## 交互设计规则

### 导航

- 列表内跳转优先使用 `NavigationLink value` + `NavigationDestination`
- 避免在长列表按钮 action 中捕获当前项后直接 push；Scripting 中可能出现复用导致打开最后一项
- 详情页应提供返回链路，不要重复堆叠无意义页面

### 状态展示

- 加载中、空列表、错误状态都要有明确文案
- 未登录状态要说明需要 OAuth，并提供进入客户端配置的路径
- 单机/隔离模式下隐藏或禁用需要私有接口的入口
- 真实数据为空和网络失败 fallback 要在文案上区分清楚

### 布局

- 发现页避免双列海报过密；优先使用紧凑主推行 + 小列表行
- 日历选择器保持紧凑，不显示容易误解的数量数字
- 条目、角色、人物卡片优先显示真实图片；图片失败时使用稳定占位
- 深浅色下都要检查卡片背景、说明文字、按钮颜色的对比度

---

## OAuth 与会话规则

- 登录状态以本地 token 快照为准，不再使用模拟登录开关
- 客户端配置页必须保留：
  - clientId / clientSecret 编辑
  - authDomain 编辑
  - 打开授权页
  - 手动粘贴 code 兜底
  - 清空 token
  - 查看/复制/清空 OAuth 调试信息
- token、clientSecret 等敏感信息不要写入文档或日志摘要
- 复制调试信息时应尽量避免泄露完整 token；如需调试，优先记录状态码和错误消息

---

## 测试与验证

修改后至少做以下之一：

- 运行 TypeScript 诊断或 Scripting 预览
- 读取关键文件确认文档/配置已落盘
- 对 API 适配改动增加轻量测试入口

功能验证重点：

- 未登录公开浏览
- OAuth 登录与恢复
- 进度页真实收藏读取
- 条目收藏状态写入
- 章节进度写入
- 发现页导航不会打开错误条目

---

**最后更新**：2026/06/07
