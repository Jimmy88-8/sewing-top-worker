# sewing.top — SewingOS + Bloomberg Portal

macOS 风格的网页桌面系统（SewingOS），内置 Bloomberg Terminal 风格的金融终端（Bloomberg Portal），**接入真实行情数据**。运行在 Cloudflare Workers + Static Assets 上。

## 功能

**SewingOS 桌面（Liquid Glass / macOS 27 "Golden Gate" 风格）**
- Liquid Glass 设计语言：窗口/Dock/菜单/Spotlight 全部玻璃材质（backdrop blur + 折射高光边），完全透明菜单栏
- 设置内置 **Liquid Glass 滑杆**（Ultra-clear ↔ Tinted），对应 macOS 27 新增的全局透明度调节，持久化保存
- 窗口管理：拖动 / 缩放 / 最小化到 Dock / 双击标题栏缩放 / 焦点层叠（圆角 14px，对齐 Golden Gate 收紧圆角）
- Dock 鼠标悬停放大（磁性效果）
- Spotlight：`⌘Space`，"Search or Ask…"（Golden Gate 文案）
- 菜单栏：动态应用名、下拉菜单、Wi-Fi / 电池（真实 Battery API）/ 时钟
- 壁纸：七款内置（含 SVG 复刻「Sequoia Grove」红杉林）；把真实照片放到
  `public/wallpapers/sequoia.jpg` 会被自动检测并收录为 "Sequoia (Photo)"

**内置应用**
| 应用 | 说明 |
|---|---|
| Bloomberg Portal | Bloomberg 风终端（见下） |
| Finder | 虚拟文件浏览器，双击启动应用 / 预览文档 |
| Terminal | 仿 zsh shell：`help` `ls` `cat` `open` `quote NVDA` `neofetch` |
| Weather | 真实天气（Open-Meteo），城市搜索，6 日预报 |
| Calculator | macOS 风格计算器，支持键盘 |
| Calendar | 月视图日历 |
| Notes | 便签（localStorage 持久化） |
| System Settings | 壁纸切换 + 系统信息 |

**Bloomberg Portal**
- 16 个标的：美股 7 + 指数 3（SPX/NDX/DJI）+ 外汇 2 + 黄金/原油 + BTC/ETH
- 实时报价 + 迷你走势图（sparkline）+ 涨跌闪烁
- K 线图：1D/5D/1M/6M/1Y 周期、蜡烛/折线切换、成交量副图、十字光标
- 滚动行情跑马灯、52 周高低、交易所信息
- 真实新闻（CNBC / Yahoo Finance RSS），点击打开原文
- 命令行：`NVDA GP`（图表）、`AAPL DES`（详情）、`N`（新闻）、`HELP`
- 每个数据点标注来源徽章：**LIVE**（真实）/ **SIM**（模拟回退）

## 数据架构

```
浏览器 ──> Cloudflare Worker (src/index.js) ──> Yahoo Finance（股票/指数/外汇/期货，延迟行情）
                 │                          ──> Binance（加密货币，实时）
                 │                          ──> CNBC / Yahoo RSS（新闻）
                 │                          ──> Open-Meteo（天气/地理编码）
                 └── 内存 TTL 缓存（并发去重 + 过期兜底 + 负缓存防锤击）
                     上游不可用时回退到确定性模拟，响应标注 src: "live" | "sim"
```

所有上游均免费、无需 API key。静态资源由 Cloudflare 边缘直接返回，不消耗 Worker 配额；只有 `/api/*` 计入调用量，且有 20s~10min 不等的缓存。

## API

| 路径 | 说明 |
|---|---|
| `GET /api/quotes` | 全部标的报价（含 sparkline、52 周高低、来源标注） |
| `GET /api/history?symbol=AAPL&range=1D` | OHLCV K 线（1D/5D/1M/6M/1Y） |
| `GET /api/news` | 实时财经新闻（RSS 聚合去重） |
| `GET /api/weather?lat=31.2&lon=121.5` | 天气（Open-Meteo 代理） |
| `GET /api/geocode?q=Shanghai` | 城市搜索 |
| `GET /api/status` | 边缘节点 + 各上游健康状态 |

## 本地开发

```bash
npm run dev            # 零依赖 Node 服务器（无需 wrangler）→ http://localhost:8787
npm run dev:wrangler   # 或用 wrangler dev（需 npm install）
```

`scripts/dev-server.mjs` 模拟 Cloudflare「静态优先、未命中进 Worker」的请求流程。

## 部署

### 方式 A：GitHub 连接（推荐）

1. 推送本仓库到 GitHub。
2. Cloudflare Dashboard → **Workers & Pages → Create → Import a repository**。
3. 构建配置保持默认（deploy 命令 `npx wrangler deploy`）。
4. 之后每次 push 到 `main` 自动部署。

### 方式 B：命令行

```bash
npx wrangler login && npm run deploy
```

## 绑定 sewing.top

1. 把 `sewing.top` 添加为 Cloudflare 站点（zone）。
2. Worker → **Settings → Domains & Routes → Add → Custom domain** → `sewing.top`（或取消 `wrangler.jsonc` 中 routes 注释后重新部署）。

## 说明

- 股票/指数行情来自 Yahoo Finance 公开端点，**延迟约 15 分钟**；加密货币为 Binance 实时。
- Yahoo 偶发限流（HTTP 429）时自动回退模拟数据并明确标注 SIM，恢复后自动切回。
- 本项目仅作技术演示，不构成投资建议。
