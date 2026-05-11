# SutureAI · Training Report Dashboard

快速上手请阅 **[QUICKSTART.md](./QUICKSTART.md)**。

SutureAI 缝合技能训练的一页式报告看板，用于展示单次训练的综合得分、多维度能力分析、时间轴事件与重点片段，并预留教官评审与学员反馈等界面区域。

## 功能概览

- **总览**：产品/任务信息、综合得分环、与基准对比的增量、训练时长与完成状态
- **五维评分**：效率、精准度、流程、安全、质量等维度的分数与说明，附雷达图
- **时间轴**：按时间线展示关键事件（正常 / 警告 / 问题），可展开查看详情
- **重点片段**：与训练相关的证据预览（图片或视频）；可选 **`evidenceVideoUrl`** 时用内置播放器；时间轴 / Key Clips 可 **跳转回放**（见 `timeSeconds`）
- **评价与建议**：优势、待改进、练习建议、AI 摘要、不确定性说明
- **教官与学员**：教官评语/终评、学员接受或澄清等交互占位
- **学生主页（摘要）**：课程与任务概览、最近报告摘要、趋势、练习重点、通知与历史；每用户数据由 `getStudentDashboard(userId)` 解析，源数据在 `src/data/studentDashboard.js`（`studentDashboardMock.js` 为兼容 re-export）
- **登录（原型）**：本地 mock 账号 + `sessionStorage` 会话；后续可替换为同一套 `AuthProvider` 下的 API 登录

## 路由

| 路径 | 说明 |
|------|------|
| `/login` | 登录页（演示账号见下表）；已登录时访问会重定向到 `/` |
| `/` | 学生主页（需登录；仪表盘摘要，非完整单次报告） |
| `/report` | 单次训练报告完整页（需登录）；可选 `?report=<id>`。会话用户若在 ACL 中无权访问某报告，目录会自动过滤（见 `src/data/reportAcl.js`） |

### 演示账号（本地原型，非生产）

| 登录邮箱 | 密码 | 说明 |
|----------|------|------|
| `alex@demo.local` | `demo` | 完整示例数据；报告目录含 `report-default`、`report-alt`、`report-video-demo` |
| `jordan@demo.local` | `demo` | 稀疏示例数据；报告目录仅 `report-default`、`report-alt` |

开发模式下学生主页右下角有 **Dev** 下拉框，可在不重新登录的情况下切换上述用户以验证数据差异。

## 报告数据（JSON + 运行时加载）

单次训练报告的载荷放在 **`public/reports/`**，开发或预览时修改 JSON 后**刷新页面**即可生效（无需改 React 代码）。

| 文件 | 说明 |
|------|------|
| `public/reports/catalog.json` | 报告索引：`id`、`label`（下拉展示）、`path`（相对站点根的路径，如 `/reports/report-default.json`） |
| `public/reports/report-default.json` | 默认示例报告 |
| `public/reports/report-alt.json` | 第二份示例（用于验证切换） |
| `public/reports/report-video-demo.json` | Demo report aligned with `docs/视频戳.md` timestamps; includes **`evidenceVideoUrl`** and **`timeSeconds`** |

每条报告 JSON 内需包含 **`evidencePreviewUrl`**（证据预览图 URL，如 `/picture/xxx.png`，可作视频 **poster**）。大尺寸预览图放在 **`public/picture/`**（默认不纳入 Git，见下文），构建后会拷贝到 `dist/`。

可选 **`evidenceVideoUrl`**（如 `/video/suture_1.mp4`）：视频放在 **`public/video/`**（默认不纳入 Git）。若设置了该字段，证据区显示 `<video controls>`；时间轴每条事件与每个 clip 可使用 **`timeSeconds`**（秒）以便跳转；未提供时尝试解析 **`time`** 字符串（如 `0:02`、`1:23`）。

### Git 与本地素材（视频 / 大图）

仓库根目录 **`.gitignore`** 已忽略常见视频后缀，以及 **`public/picture/`**、**`public/video/`** 下的实际文件（仅保留 `.gitkeep` 占位目录）。克隆后请在本地自行放入与 `public/reports/*.json` 中路径一致的图片与录像，否则证据区可能无法显示。

学生主页头像使用 **`public/picture/avatar-placeholder.svg`**（小 SVG，随仓库提交）；`<img>` 通过 `import.meta.env.BASE_URL` 拼接路径，部署在子路径（`base`）下也能加载。

页面顶部 **Session** 下拉框用于切换报告。也可通过 URL 指定初始报告：`?report=report-alt`（`report` 的值对应 `catalog.json` 里的 `id`）。

## 技术栈

| 类型     | 选用 |
|----------|------|
| 框架     | [React 18](https://react.dev/) |
| 路由     | [React Router 6](https://reactrouter.com/) |
| 构建     | [Vite 5](https://vitejs.dev/)（`@` → `src/`，见 `vite.config.js` + `jsconfig.json`） |
| 样式     | [Tailwind CSS 3](https://tailwindcss.com/) |

## 环境要求

- [Node.js](https://nodejs.org/) 18+（建议 LTS）

## 安装与运行

```bash
npm install
npm run dev
```

浏览器访问终端里提示的本地地址（一般为 `http://localhost:5173`）。

## 其他脚本

| 命令 | 说明 |
|------|------|
| `npm run build` | 生产构建，输出到 `dist/` |
| `npm run preview` | 本地预览构建结果 |

## 项目结构（简要）

```
.
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── reports/         # 报告 catalog + 各次会话 JSON（运行时 fetch）
│   ├── picture/         # 证据大图（本地放置；Git 忽略除 .gitkeep）
│   └── video/           # 证据录像（本地放置；Git 忽略除 .gitkeep）
├── src/
│   ├── main.jsx
│   ├── index.css
│   ├── assets/          # 可选：打包用静态资源（头像占位在 public/picture）
│   ├── App.jsx          # 路由：/login、受保护的 / 与 /report
│   ├── auth/            # AuthProvider、mock 登录（可换 API）
│   ├── data/
│   │   ├── studentDashboard.js   # 按 userId 的学生仪表盘 mock
│   │   ├── studentDashboardMock.js
│   │   └── reportAcl.js          # 每用户可见的报告 id（过滤 catalog）
│   └── pages/
│       ├── StudentDashboardPage.jsx
│       └── TrainingReportPage.jsx   # 读取 public/reports JSON
├── jsconfig.json        # 路径别名 @/* → src/*（与 Vite 一致）
```

## 许可证

私有学习/项目用途；如需开源请自行补充 `LICENSE` 与说明。
