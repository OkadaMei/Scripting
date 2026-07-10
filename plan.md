# Bangumi Beta 开发计划

## 总体状态

- **当前定位**：Scripting App 内的 Bangumi 在线客户端原型
- **主入口**：`page/index.tsx` → `page/bangumi/index.tsx`
- **数据策略**：真实 Bangumi API 优先，失败时 mock 兜底
- **最后更新**：2026/06/07

---

## 已完成阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 从原 Music Player 主界面切换为 Bangumi Tab 壳层 | ✅ |
| Phase 2 | 建立 Bangumi 数据类型、mock 数据、通用 UI 组件 | ✅ |
| Phase 3 | 新增客户端骨架：公共/私有接口、状态存储、基础数据加载 | ✅ |
| Phase 4 | OAuth 客户端配置、授权 URL、code 兑换、本地 token 存储 | ✅ |
| Phase 5 | OAuth 自动恢复、`Script.onResume` 回调消费、token refresh、401 重试 | ✅ |
| Phase 6 | 设置页真实会话状态、账号摘要、OAuth 调试面板 | ✅ |
| Phase 7 | 通知入口与通知页，读取真实 `notify` 数据 | ✅ |
| Phase 8 | 进度页真实收藏优先、分类/状态筛选、排序 | ✅ |
| Phase 9 | 发现页条目/角色/人物搜索，支持远程与本地索引回退 | ✅ |
| Phase 10 | 角色/人物详情页，casts / works / relations 与条目回链 | ✅ |
| Phase 11 | 真实图片字段适配，封面与头像优先使用远程 URL | ✅ |
| Phase 12 | 条目详情真实章节、短评、讨论版 | ✅ |
| Phase 13 | 收藏状态写入与章节进度写入 | ✅ |
| Phase 14 | 每话评论详情、讨论详情与回复列表 | ✅ |
| Phase 15 | 每日放送真实化、热门分类扩展、发现页布局优化 | ✅ |
| Phase 16 | 修复发现页连续入栈/按钮复用问题，改用 `NavigationLink value` | ✅ |
| Phase 17 | 条目详情优先查询当前账号单条收藏，避免远程条目误显示“在看” | ✅ |

---

## 当前项目结构

```text
/
├── index.tsx                 # Scripting 运行入口；仍初始化旧 player，再展示 HomePage
├── page/index.tsx            # Bangumi 主入口包装；关闭按钮执行 Script.minimize()
├── page/bangumi/
│   ├── index.tsx             # 顶层 Tab、设置页、部分详情页
│   ├── pages-core.tsx        # Timeline / Progress / Discover / Notice 等核心页面
│   ├── client.ts             # Bangumi API、OAuth、token、调试信息
│   ├── store.ts              # 数据加载、适配真实响应、mock fallback
│   ├── types.ts              # Bangumi 类型定义
│   ├── ui.tsx                # Bangumi 通用 UI 组件
│   └── data.ts               # mock 与兜底数据
├── class/                    # 原 Music Player 类，当前不是主功能
├── page/library|player|search|setting/
│   └──                       # 原 Music Player 页面，当前不是主功能
├── widget.tsx                # 旧音乐 Widget，待改造或移除
├── app_intents.tsx           # 旧音乐 Intent，待改造或移除
├── FINAL_DELIVERY_SUMMARY.md # 当前交付摘要
├── plan.md                   # 当前计划
└── rules.md                  # 当前开发规则
```

---

## 近期待办

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | 拆分 `page/bangumi/index.tsx` | 将 Rakuen / Settings / Subject / User / Mono / Episode / Topic 等页面继续迁出，降低单文件复杂度 |
| P0 | 清理旧 Music Player 主入口副作用 | `index.tsx` 仍初始化 `player`，需要评估是否移除或隔离 |
| P1 | Bangumi Widget 规划 | 将旧音乐 Widget 改为“今日放送 / 在看进度 / 通知”之一，或删除 widget 能力 |
| P1 | Bangumi AppIntent 规划 | 将旧播放控制 Intent 改为打开今日放送、搜索条目、查看进度等能力，或删除旧 Intent |
| P1 | API 字段适配稳定化 | 继续收集真实响应，收敛 `store.ts` 中的候选字段与 fallback 逻辑 |
| P2 | UI 细节统一 | 继续优化深浅色、间距、列表行、状态卡片、错误/空状态 |
| P2 | 测试与预览 | 增加轻量测试入口或 mock 预览，避免真实 API 不稳定影响开发 |

---

## 不再作为当前主线的内容

以下内容属于旧 Music Player，不应再写入 Bangumi Beta 的新计划，除非明确要清理或迁移：

- 本地音频导入与播放
- 播放队列、睡眠定时器、Now Playing
- 音乐下载器与搜索下载
- 音乐播放 Widget / AppIntent

---

## 验收重点

- 未配置 OAuth 时：发现页、搜索、本地 mock、公开数据仍可访问
- 配置 OAuth 后：设置页显示真实会话，进度、通知、收藏状态、章节进度能读写
- OAuth 回调后：脚本从最小化或重新运行恢复时能自动消费 code
- 发现页点击任意条目/更多分类不会再全部打开最后一项
- 真实图片可显示；失败时占位 UI 不崩溃
