# SutureAI · Training Report Dashboard

快速上手请阅 **[QUICKSTART.md](./QUICKSTART.md)**。

SutureAI 缝合技能训练平台：学生上传训练录像 → 视频评分 → 生成报告 → 在看板中查看。前端是 React（Vite），后端是 FastAPI + SQLite（`server/`）。

## 功能概览

- **开始训练（`/train`）**：选择任务 → 上传录像（拖拽、预览、读取时长、进度条、可取消）→ 实时显示处理进度 → 完成后跳转报告；失败可重试
- **学生主页（`/`）**：当前任务、最近报告、趋势、练习重点、通知、进行中的录像、训练日历与历史，全部由 `GET /api/dashboard` 从数据库聚合
- **报告页（`/report`）**：综合得分、五维评分与雷达图、时间轴（可跳转回放上传的视频）、重点片段、评价与建议、教官/学员交互占位
- **登录**：服务端会话（httpOnly cookie），密码 scrypt 哈希存储

## 架构

```
浏览器 (Vite/React :5173) ──/api 代理──▶ FastAPI (:8000) ──▶ SQLite  data/app.db
                                              │
                                              ├─ 视频文件   data/videos/<sessionId>.<ext>
                                              └─ 后台 worker（进程内线程）
                                                   ├─ ScoringProvider  评分（现为 mock）
                                                   └─ ReportProvider   报告生成（现为模板；之后接 LLM）
```

### 训练会话状态机

```
created → uploaded → scoring → scored → generating → ready
                        └──────────┴────────────────→ failed（可重试）
```

- 上传完成后接口立即返回，worker 从数据库领取任务处理；前端每 2 秒轮询 `GET /api/sessions/:id`。
- 状态全部存在 `training_sessions` 表里，服务重启后会把中断的 `scoring/generating` 重新排队。
- 评分原始结果（`scoring_results.raw`）与最终报告（`reports.content`）分开存，换 LLM / 改 prompt 后可以只重跑报告步骤。
- 重试会从最后成功的步骤继续（已评分则只重新生成报告）。

### 接入真实评分 API / LLM

两个外部步骤都是可替换的 provider（`server/app/providers/`）：

| 步骤 | 接口 | 当前实现 | 切换方式 |
|------|------|----------|----------|
| 视频评分 | `ScoringProvider.score(ctx) -> dict` | `MockScoringProvider`（按 session id 生成确定性的假数据，不看视频内容） | 新增 provider，在 `providers/__init__.py` 注册，设置 `SUTURE_SCORING_PROVIDER` |
| 报告生成 | `ReportProvider.generate(ctx) -> dict` | `TemplateReportProvider`（规则模板） | 同上，`SUTURE_REPORT_PROVIDER` |

- 评分输出格式（schemaVersion 1）写在 `providers/base.py` 的文档字符串里。真实 API 的 adapter 负责转换成这个格式。
- 报告输出格式就是报告页渲染的 JSON，样例见 `server/seed/reports/*.json`。

## 数据库表

| 表 | 说明 |
|----|------|
| `users` | 账号、角色（student / instructor / admin）、课程与当前任务 |
| `auth_sessions` | 登录会话（只存 token 的 sha256） |
| `tasks` | 训练任务（名称、说明、评分维度） |
| `training_sessions` | 一次训练录像的生命周期与状态 |
| `videos` | 上传的视频元数据（路径、大小、时长、sha256） |
| `scoring_results` | 评分 provider 的原始输出 |
| `reports` | 最终报告 JSON |

目前用 `create_all` 建表；表结构稳定后建议接入 Alembic 做迁移。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` · `/api/auth/logout` | 登录 / 登出 |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/tasks` | 任务列表 |
| POST | `/api/sessions` | 创建训练会话 `{ taskId }` |
| GET | `/api/sessions` · `/api/sessions/:id` | 我的会话 / 单个会话状态 |
| POST | `/api/sessions/:id/video` | 上传视频（multipart：`file`，可选 `durationSeconds`） |
| GET | `/api/sessions/:id/video` | 视频流（支持 Range，可拖动进度） |
| POST | `/api/sessions/:id/retry` | 重试失败的会话 |
| GET | `/api/reports` · `/api/reports/:sessionId` | 我的报告列表 / 报告内容 |
| GET | `/api/dashboard` | 学生主页聚合数据 |

后端运行时可在 http://127.0.0.1:8000/docs 查看自动生成的 OpenAPI 文档。学生只能访问自己的会话；`instructor` / `admin` 角色可查看任意会话（教官端界面尚未实现）。

## 路由

| 路径 | 说明 |
|------|------|
| `/login` | 登录页；已登录时重定向到 `/` |
| `/` | 学生主页 |
| `/train` | 开始训练；`?task=<taskId>` 预选任务 |
| `/train/:sessionId` | 查看某次训练的处理进度（刷新页面不会丢失） |
| `/report?session=<sessionId>` | 单次训练报告 |

### 演示账号（本地原型，非生产）

首次启动后端时如果数据库为空，会自动写入演示数据（`server/app/seed.py`）：3 个任务、2 个学生账号，以及用真实流水线（mock 评分 + 模板报告）生成的历史训练记录，外加 `server/seed/reports/` 里的 3 份手写样例报告。

| 登录邮箱 | 密码 | 说明 |
|----------|------|------|
| `alex@demo.local` | `suture-local-demo` | 17 条历史记录（含视频时间戳样例报告） |
| `jordan@demo.local` | `suture-local-demo` | 5 条历史记录 |

演示密码不用 `demo`，以免 Chrome 将其识别为已泄露的常见密码并反复提示。

开发模式下学生主页右下角有 **Dev** 下拉框，可以直接切换到另一个演示账号。

## 配置（环境变量）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SUTURE_DATA_DIR` | `<repo>/data` | `app.db` 与 `videos/` 所在目录 |
| `SUTURE_MAX_UPLOAD_MB` | `1024` | 单个视频上限 |
| `SUTURE_SESSION_TTL_HOURS` | `168` | 登录有效期 |
| `SUTURE_COOKIE_SECURE` | `0` | HTTPS 部署时设为 `1` |
| `SUTURE_SCORING_PROVIDER` / `SUTURE_REPORT_PROVIDER` | `mock` / `template` | provider 选择 |
| `SUTURE_MOCK_SCORING_DELAY_S` / `SUTURE_MOCK_REPORT_DELAY_S` | `4` / `2` | mock 的模拟耗时，方便观察进度界面 |
| `SUTURE_WORKER_ENABLED` | `1` | 是否在 API 进程内启动 worker |

前端开发服务器把 `/api` 代理到 `SUTURE_API_URL`（默认 `http://127.0.0.1:8000`），见 `vite.config.js`。

## Git 与本地素材

`data/`（数据库与上传的视频）、`public/picture/`、`public/video/` 下的实际文件都不纳入 Git。样例报告 `report-video-demo.json` 引用的是静态文件 `/video/suture_1.mp4`，需要自己放到 `public/video/`；新上传的视频由后端提供，不需要手动放置。

报告没有 `evidencePreviewUrl` 时，证据区会回退到 `public/picture/` 里的默认预览图。

## 技术栈

| 类型 | 选用 |
|------|------|
| 前端 | React 18、React Router 6、Vite 5、Tailwind CSS 3 |
| 后端 | FastAPI、SQLAlchemy 2、SQLite（WAL）、Uvicorn |
| 测试 | pytest（`server/tests/`） |

## 项目结构（简要）

```
.
├── src/                      # 前端
│   ├── api/                  # fetch 封装、上传进度、会话状态常量
│   ├── auth/                 # AuthProvider（调用 /api/auth）、演示账号列表
│   ├── components/
│   └── pages/
│       ├── LoginPage.jsx
│       ├── StudentDashboardPage.jsx
│       ├── TrainingSessionPage.jsx   # 选任务 / 上传 / 进度
│       └── TrainingReportPage.jsx
├── server/                   # 后端
│   ├── app/
│   │   ├── main.py           # create_app、生命周期、worker 启动
│   │   ├── config.py         # SUTURE_* 环境变量
│   │   ├── models.py         # SQLAlchemy 表
│   │   ├── routers/          # auth / tasks / sessions / reports / dashboard
│   │   ├── services/         # pipeline（状态机 + worker）、storage、dashboard 聚合
│   │   ├── providers/        # 评分与报告 provider（mock / template）
│   │   └── seed.py           # 演示数据
│   ├── seed/reports/         # 手写样例报告 JSON
│   └── tests/
├── data/                     # 运行时数据（Git 忽略）
└── public/                   # 静态资源
```

## 许可证

私有学习/项目用途；如需开源请自行补充 `LICENSE` 与说明。
