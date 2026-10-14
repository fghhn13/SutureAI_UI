# SutureAI · Training Report Dashboard

快速上手请阅 **[QUICKSTART.md](./QUICKSTART.md)**：本地一条命令 `npm start` 即可同时启动前后端（首次运行会自动安装依赖）。

SutureAI 缝合技能训练平台：学生上传训练录像 → 视频评分 → 生成报告 → 教师查看全班状况并评审 → 学生查看评审、提出疑问。前端是 React（Vite），后端是 FastAPI + SQLite（`server/`）。

## 功能概览

- **开始训练（`/train`）**：选择任务 → 上传录像（拖拽、预览、读取时长、进度条、可取消）→ 实时显示处理进度 → 完成后跳转报告；失败可重试
- **学生主页（`/`）**：当前任务、最近报告、趋势、练习重点、通知、进行中的录像、训练日历与历史，全部由 `GET /api/dashboard` 从数据库聚合
- **报告页（`/report`）**：综合得分、五维评分与雷达图、时间轴（可跳转回放上传的视频）、重点片段、评价与建议
  - 学生：查看教师评审（最终分数、评语、教学重点），**接受反馈**或针对某个片段**请求澄清**，写仅自己可见的个人笔记
  - 教师：确认/调整分数（自动标注与 AI 的一致程度）、写评语、选教学重点，存草稿或完成评审；回复学生的澄清请求；可切换「学生看到的样子」预览
- **教师端（`/instructor`）**
  - **班级总览**：按班级切换；KPI（学生数、本周训练次数、30 天平均分、待评审、待回复问题）；**需要关注**列表（澄清请求、成绩下滑、低分、长期未训练、处理失败，按严重程度排序）；学生 × 五维的**技能热力图**；可排序、可搜索的**学生名单**（最近活跃、训练次数、最新分、趋势小折线、变化、最弱维度、待办）
  - **学生详情**（`/instructor/students/:id`）：总分趋势图（点击打开对应报告）、五个维度的趋势小图、全部训练记录及评审/反馈状态、训练日历
  - **评审队列**（`/instructor/reviews`）：待评审 / 学生提问 / 已评审 三个标签，可按班级筛选，最早的排在前面
- **登录**：服务端会话（httpOnly cookie），密码 scrypt 哈希存储；登录后按角色进入学生主页或教师端

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
| `users` | 账号、角色（student / instructor / admin）、当前任务 |
| `cohorts` | 班级（名称、课程） |
| `cohort_members` | 学生所属班级（一个学生只属于一个班） |
| `cohort_instructors` | 教师所带班级（一个教师可带多个班） |
| `auth_sessions` | 登录会话（只存 token 的 sha256） |
| `tasks` | 训练任务（名称、说明、评分维度） |
| `training_sessions` | 一次训练录像的生命周期与状态 |
| `videos` | 上传的视频元数据（路径、大小、时长、sha256） |
| `scoring_results` | 评分 provider 的原始输出 |
| `reports` | 最终报告 JSON（生成后不再修改） |
| `instructor_reviews` | 教师评审：草稿/已完成、AI 分、最终分、评语、教学重点 |
| `student_feedback` | 学生对报告的回应：接受 / 请求澄清（含引用片段）及教师回复 |
| `student_notes` | 学生的私人笔记（教师不可见） |

评审、反馈和笔记不写进报告 JSON，而是在 `GET /api/reports/:id` 时按查看者合并进去（`services/reviews.py` 的 `report_view`）：学生看不到教师的草稿，教师看不到学生的笔记。

目前用 `create_all` 建表（只会新建缺失的表，不会改已有表）；表结构稳定后建议接入 Alembic 做迁移。

> **从旧版本升级**：本地已有的 `data/app.db` 里没有班级和教师数据，启动时日志会提示。在 `server/` 目录下执行 `.\.venv\Scripts\python -m app.seed --reset` 重建演示数据（会清空本地数据库和已上传的视频）。

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
| GET | `/api/reports` | 我的报告列表；教师可传 `?studentId=` 查看所带学生的 |
| GET | `/api/reports/:sessionId` | 报告内容（按查看者合并评审、反馈、笔记） |
| PUT | `/api/reports/:sessionId/review` | 教师：保存草稿或完成评审 `{ finalScore, comment, teachingFocus, complete }` |
| POST | `/api/reports/:sessionId/feedback` | 学生：`{ kind: "accept" \| "clarify", message, referencedClip }` |
| POST | `/api/reports/:sessionId/feedback/response` | 教师：回复澄清请求 `{ response }` |
| PUT | `/api/reports/:sessionId/note` | 学生：私人笔记 `{ note }` |
| GET | `/api/dashboard` | 学生主页聚合数据 |
| GET | `/api/instructor/cohorts` | 教师所带班级 |
| GET | `/api/instructor/cohorts/:id` | 班级总览：KPI、需要关注、热力图、学生名单 |
| GET | `/api/instructor/students/:id` | 学生详情：统计、分数序列、各维度序列、训练记录、日历 |
| GET | `/api/instructor/reviews` | 评审队列 `?filter=pending\|clarifications\|completed&cohortId=` |

后端运行时可在 http://127.0.0.1:8000/docs 查看自动生成的 OpenAPI 文档。

**权限**：学生只能访问自己的数据；教师只能访问**自己所带班级**里的学生（其他学生的会话一律返回 404）；`admin` 可访问全部。规则集中在 `services/access.py`。

**「需要关注」的判定规则**（`services/instructor.py` 顶部的常量可调）：有未回复的澄清请求（高）；最近 3 次平均分比之前 3 次低 8 分以上（高）；最新分数低于 60（中）；14 天以上没有训练或从未训练（中）；有处理失败的录像（低）。

## 路由

| 路径 | 说明 |
|------|------|
| `/login` | 登录页；已登录时按角色跳转 |
| `/` | 学生主页（仅学生） |
| `/train` | 开始训练；`?task=<taskId>` 预选任务（仅学生） |
| `/train/:sessionId` | 查看某次训练的处理进度（刷新页面不会丢失） |
| `/report?session=<sessionId>` | 单次训练报告（学生看自己的，教师看所带学生的） |
| `/instructor` | 教师端班级总览；`?cohort=<id>` 选班级 |
| `/instructor/students/:studentId` | 教师端学生详情 |
| `/instructor/reviews` | 评审队列；`?filter=clarifications\|completed&cohort=<id>` |

### 演示账号（本地原型，非生产）

首次启动后端时如果数据库为空，会自动写入演示数据（`server/app/seed.py`）：3 个任务、2 个班级、2 名教师、7 名学生。学生的历史记录用真实流水线（mock 评分 + 模板报告）生成，并按设定的成绩曲线分布，让教师端有可看的差异；较早的报告大多已评审，部分已被学生接受，另有几条未回复的澄清请求。

所有账号密码都是 `suture-local-demo`。

| 登录邮箱 | 角色 | 说明 |
|----------|------|------|
| `chen@demo.local` | 教师 | 带 Group A 和 Group B |
| `patel@demo.local` | 教师 | 只带 Group B（用来验证教师只能看到自己的班） |
| `alex@demo.local` | 学生 · A | 稳步提升；含 3 份手写样例报告（其中一份有未回复的澄清请求） |
| `sam@demo.local` | 学生 · A | 进步明显 |
| `priya@demo.local` | 学生 · A | 成绩下滑，最新一份报告有澄清请求 |
| `lee@demo.local` | 学生 · A | 40 多天没有训练 |
| `jordan@demo.local` | 学生 · B | 记录较少 |
| `mia@demo.local` | 学生 · B | 分数偏低，有一条处理失败的录像 |
| `noah@demo.local` | 学生 · B | 还没有任何训练 |

演示密码不用 `demo`，以免 Chrome 将其识别为已泄露的常见密码并反复提示。

开发模式下学生主页和教师端右下角有 **Dev** 下拉框，可以直接切换账号（会跳到对应角色的首页）。

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
│   │   ├── charts/           # 折线图、小折线、热力图、KPI 卡片（无第三方图表库）
│   │   └── report/           # 报告页的评审 / 反馈 / 笔记面板
│   └── pages/
│       ├── LoginPage.jsx
│       ├── StudentDashboardPage.jsx
│       ├── TrainingSessionPage.jsx   # 选任务 / 上传 / 进度
│       ├── TrainingReportPage.jsx
│       └── instructor/               # 班级总览、学生详情、评审队列
├── server/                   # 后端
│   ├── app/
│   │   ├── main.py           # create_app、生命周期、worker 启动
│   │   ├── config.py         # SUTURE_* 环境变量
│   │   ├── models.py         # SQLAlchemy 表
│   │   ├── routers/          # auth / tasks / sessions / reports / dashboard / instructor
│   │   ├── services/         # pipeline、storage、dashboard、access（权限）、reviews、instructor（班级统计）
│   │   ├── providers/        # 评分与报告 provider（mock / template）
│   │   └── seed.py           # 演示数据
│   ├── seed/reports/         # 手写样例报告 JSON
│   └── tests/
├── data/                     # 运行时数据（Git 忽略）
└── public/                   # 静态资源
```

## 许可证

私有学习/项目用途；如需开源请自行补充 `LICENSE` 与说明。
