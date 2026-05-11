# Quickstart · SutureAI UI

最短路径把前端跑起来并登录演示账号。

## 环境

- [Node.js](https://nodejs.org/) **18+**（建议 LTS）
- npm（随 Node 安装）

## 克隆与安装

```bash
git clone git@github.com:fghhn13/SutureAI_UI.git
cd SutureAI_UI
npm install
```

## 启动开发服务器

```bash
npm run dev
```

浏览器打开终端里显示的地址（一般为 **http://localhost:5173**）。

## 登录（演示）

未登录访问 `/` 会跳到 **`/login`**。可使用：

| 邮箱 | 密码 | 说明 |
|------|------|------|
| `alex@demo.local` | `demo` | 完整仪表盘 mock；报告含 `report-video-demo` |
| `jordan@demo.local` | `demo` | 精简数据；报告列表不含视频 demo 报告 |

登录后可访问 **`/`**（学生主页）与 **`/report`**（单次训练报告）。

开发模式下学生主页右下角 **Dev** 可切换用户而无需重新登录。

## 可选：证据图片 / 视频

报告 JSON（`public/reports/*.json`）可引用 **`/picture/…`**、**`/video/…`**。若克隆后未放置对应文件，证据区可能空白；本地将素材放到：

- `public/picture/`（与 JSON 中文件名一致）
- `public/video/`

头像占位始终可用：**`public/picture/avatar-placeholder.svg`**（已随仓库提供）。

## 生产构建与预览

```bash
npm run build
npm run preview
```

产物在 **`dist/`**，可部署到任意静态托管。

## 常用路径

| 路径 | 说明 |
|------|------|
| `/login` | 登录 |
| `/` | 学生主页（需登录） |
| `/report` | 报告页；可选 `?report=report-default` 等（见 `public/reports/catalog.json`） |

## 开发提示

- 源码别名 **`@/`** → **`src/`**（见 `vite.config.js`、`jsconfig.json`）。
- 学生仪表盘 mock：**`src/data/studentDashboard.js`** / **`getStudentDashboard(userId)`**。
- 更完整的说明见 **[README.md](./README.md)**。
