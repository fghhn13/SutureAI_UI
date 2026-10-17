# Quickstart · SutureAI

用最短路径把前后端跑起来，并完成一次上传训练录像的流程。

## 环境

- [Node.js](https://nodejs.org/) **18+**（建议 LTS）
- [Python](https://www.python.org/) **3.11+**

## 一键启动

```bash
git clone git@github.com:fghhn13/SutureAI_UI.git
cd SutureAI_UI
npm start
```

`npm start`（[scripts/dev.mjs](scripts/dev.mjs)）会：

1. 首次运行时自动创建 `server/.venv` 并安装后端依赖，缺 `node_modules` 时执行 `npm install`
2. 启动后端（:8000，代码改动自动重载；数据库为空时自动写入演示数据）
3. 等后端就绪后启动前端（:5173，`/api` 代理到后端）
4. 两边日志加 `[api]` / `[web]` 前缀输出到同一个终端；**Ctrl+C** 同时停止两者，任一方退出时另一方也会停止

浏览器打开 **http://localhost:5173**。

只安装、不启动：`npm run setup`。

可选环境变量：`API_PORT`（默认 8000）、`WEB_PORT`（默认 5173）、`PYTHON`（创建 venv 用的解释器，默认 Windows 为 `python`，其他系统为 `python3`）。

### 手动分别启动

需要单独调试某一端时，在仓库根目录开两个终端（Windows PowerShell 5.1 不支持 `&&`，所以不用 `cd server && ...`）：

```bash
# 后端 — Windows (PowerShell)
.\server\.venv\Scripts\python -m uvicorn app.main:app --app-dir server --reload --reload-dir server --port 8000
# 后端 — macOS / Linux
server/.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --reload-dir server --port 8000
```

```bash
# 前端
npm run dev
```

## 登录（演示）

所有演示账号的密码都是 `suture-local-demo`：

| 邮箱 | 角色 |
|------|------|
| `chen@demo.local` | 教师（带 Group A、B） |
| `patel@demo.local` | 教师（只带 Group B） |
| `alex@demo.local` | 学生 |
| `priya@demo.local` | 学生（成绩下滑、有待回复的问题） |

完整账号列表见 README。

> **之前已经运行过本项目？** 旧的 `data/app.db` 里没有班级和教师数据。请在 `server/` 目录下执行 `.\.venv\Scripts\python -m app.seed --reset` 重建演示数据（会清空本地数据库和已上传的视频）。

请勿在浏览器中保存上述账号；若曾保存过旧密码 `demo`，请在 Chrome **设置 → 密码管理器** 中删除本站点记录。

## 试一次训练流程

1. 在学生主页点 **Start training**
2. 选择任务，拖入任意一段视频（MP4 / WebM / MOV / MKV）
3. 点 **Upload & analyse**，页面会依次显示上传、评分、生成报告三个步骤（mock 大约 6 秒）
4. 点 **View report** 查看报告；时间轴和重点片段可以跳转到上传视频的对应位置

目前评分是 mock，分数与视频内容无关，见 README 的「接入真实评分 API / LLM」。

## 试一次教师流程

1. 用 `chen@demo.local` 登录，进入**班级总览**：看「需要关注」列表、技能热力图和学生名单
2. 点 Priya Shah 进入学生详情，看分数下滑的趋势和各维度小图
3. 在训练记录里点 **Review** 打开她的报告：裁决她的申诉（Accept / Reject），调整分数、写评语，点 **Complete review**
4. 右下角 Dev 切换到 Priya，打开同一份报告，能看到教师评审和回复

## 常用命令

| 命令 | 说明 |
|------|------|
| `.\server\.venv\Scripts\python -m pytest server` | 后端测试 |
| `npm run demo:reset` | 清空数据库和上传的视频，重新写入演示数据 |
| `npm run demo:register -- <视频>` | 把一个视频文件登记为演示视频（见 [docs/demo-script.md](docs/demo-script.md)） |
| `npm run build` | 前端生产构建，输出到 `dist/` |

API 文档：后端运行时访问 http://127.0.0.1:8000/docs 。

## 常用路径

| 路径 | 说明 |
|------|------|
| `/login` | 登录 |
| `/` | 学生主页 |
| `/instructor` | 教师端：班级总览 / 学生详情 / 评审队列 |
| `/train` | 开始训练 / 上传录像 |
| `/report?session=<id>` | 单次训练报告 |

更完整的说明（架构、数据库表、API、配置）见 **[README.md](./README.md)**。
