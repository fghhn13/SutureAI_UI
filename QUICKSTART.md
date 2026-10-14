# Quickstart · SutureAI

用最短路径把前后端跑起来，并完成一次上传训练录像的流程。

## 环境

- [Node.js](https://nodejs.org/) **18+**（建议 LTS）
- [Python](https://www.python.org/) **3.11+**

## 克隆与安装

```bash
git clone git@github.com:fghhn13/SutureAI_UI.git
cd SutureAI_UI
npm install
```

后端依赖装在 `server/.venv`：

```bash
python -m venv server/.venv
```

```bash
# Windows
server\.venv\Scripts\python -m pip install -r server/requirements-dev.txt
# macOS / Linux
server/.venv/bin/python -m pip install -r server/requirements-dev.txt
```

## 启动

开两个终端。

**后端**（端口 8000；数据库为空时会自动写入演示数据）：

在仓库根目录执行（Windows PowerShell 5.1 不支持 `&&`，所以不用 `cd server && ...`）：

```bash
# Windows (PowerShell)
.\server\.venv\Scripts\python -m uvicorn app.main:app --app-dir server --reload --reload-dir server --port 8000
# macOS / Linux
server/.venv/bin/python -m uvicorn app.main:app --app-dir server --reload --reload-dir server --port 8000
```

**前端**（端口 5173，`/api` 会代理到后端）：

```bash
npm run dev
```

浏览器打开 **http://localhost:5173**。

## 登录（演示）

| 邮箱 | 密码 |
|------|------|
| `alex@demo.local` | `suture-local-demo` |
| `jordan@demo.local` | `suture-local-demo` |

请勿在浏览器中保存上述账号；若曾保存过旧密码 `demo`，请在 Chrome **设置 → 密码管理器** 中删除本站点记录。

## 试一次训练流程

1. 在学生主页点 **Start training**
2. 选择任务，拖入任意一段视频（MP4 / WebM / MOV / MKV）
3. 点 **Upload & analyse**，页面会依次显示上传、评分、生成报告三个步骤（mock 大约 6 秒）
4. 点 **View report** 查看报告；时间轴和重点片段可以跳转到上传视频的对应位置

目前评分是 mock，分数与视频内容无关，见 README 的「接入真实评分 API / LLM」。

## 常用命令

| 命令 | 说明 |
|------|------|
| `.\server\.venv\Scripts\python -m pytest server` | 后端测试 |
| `.\.venv\Scripts\python -m app.seed --reset`（在 `server/` 目录下执行） | 清空数据库和上传的视频，重新写入演示数据 |
| `npm run build` | 前端生产构建，输出到 `dist/` |

API 文档：后端运行时访问 http://127.0.0.1:8000/docs 。

## 常用路径

| 路径 | 说明 |
|------|------|
| `/login` | 登录 |
| `/` | 学生主页 |
| `/train` | 开始训练 / 上传录像 |
| `/report?session=<id>` | 单次训练报告 |

更完整的说明（架构、数据库表、API、配置）见 **[README.md](./README.md)**。
