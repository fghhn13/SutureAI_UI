# 视频评分 API 需求说明（v1）

> 本文是 SutureAI 平台对外部「视频评分服务」的接口约定，供新仓库设计和实现时参考。
> 平台这边已经按这份约定预留好了接入点（`server/app/providers/base.py`）。服务按本文实现后，平台只需新增一个 `HttpScoringProvider` 并切换配置即可接入，上传、进度页、报告、申诉、PDF 导出都无需改动。
>
> 本文只规定**输入、输出和行为**，不限定实现方案（大模型、跟踪 + 运动学指标、步骤分割、端到端评分都可以）。

---

## 1. 职责边界

```
学生上传视频 ──▶ SutureAI 平台 ──(视频 + 任务信息)──▶ 【视频评分服务】
                     ▲                                        │
                     └──────── 评分结果 / 进度 / 错误 ◀─────────┘
                     │
                     └─▶ 平台用评分结果生成报告（模板，以后接 LLM）、展示、申诉、导出
```

| 评分服务负责 | 平台负责（不属于评分服务） |
|---|---|
| 分析视频画面 | 用户、权限、班级 |
| 输出总分、五个维度的分数、带时间戳的事件、置信度 | 报告文字（总结、优缺点、建议），由报告生成模块完成 |
| 汇报处理进度 | 教师评审、学生申诉、分数调整 |
| 识别不合格视频并给出可展示给学生的原因 | 视频存储、播放、PDF 导出 |

**评分服务不需要、也不应接收学生身份信息**（姓名、邮箱等）。平台只发送会话 ID 和任务信息。

---

## 2. 调用模式：异步任务

一段 2 分钟、1080p 的视频分析通常需要几十秒，所以采用「提交任务 → 查询状态」的异步模式：

```
POST /v1/jobs              提交视频，立即返回 202 + jobId
GET  /v1/jobs/{jobId}      查询状态、进度；完成后返回结果
DELETE /v1/jobs/{jobId}    取消任务，并删除服务端保存的视频
GET  /v1/capabilities      支持的任务、维度、结果格式版本、模型版本
GET  /v1/health            健康检查
```

可选：支持回调（webhook），完成时主动通知平台。平台以轮询为准，回调只是锦上添花。

### 2.1 认证

- 请求头 `Authorization: Bearer <API_KEY>`。
- 平台通过环境变量配置：`SUTURE_SCORING_URL`、`SUTURE_SCORING_API_KEY`。

### 2.2 提交任务 `POST /v1/jobs`

支持两种提交方式，**至少实现 A**：

**A. 直接上传视频（multipart/form-data）**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `video` | file | ✔ | 视频文件 |
| `jobId` | string | ✔ | 由平台生成，等于平台的会话 ID（32 位十六进制）。用于**幂等**：重复提交同一个 `jobId` 时返回已有任务，不重新计算 |
| `taskId` | string | ✔ | 任务类型，见 §4.1 |
| `durationSeconds` | number |  | 浏览器读到的视频时长，仅供参考，以服务端解码结果为准 |
| `sha256` | string |  | 视频文件的哈希，供服务端校验或缓存 |
| `options` | JSON string |  | 预留，比如 `{"fps": 15}` |

**B. 提供视频地址（application/json）**

```json
{ "jobId": "e7bd7c1d...", "taskId": "simple-suturing", "videoUrl": "https://.../video?token=...", "sha256": "..." }
```

`videoUrl` 是平台签发的短期下载链接（支持 Range 请求）。适合评分服务和平台不在同一台机器、视频又很大的情况。

**响应**：`202 Accepted`

```json
{ "jobId": "e7bd7c1d...", "status": "queued", "createdAt": "2026-10-15T08:30:00Z" }
```

请求阶段就能判断的错误，直接用 4xx 返回，见 §6。

### 2.3 查询任务 `GET /v1/jobs/{jobId}`

```json
{
  "jobId": "e7bd7c1d...",
  "status": "running",
  "progress": 0.42,
  "stage": "track_hands",
  "stageMessage": "Tracking hands in frame 1,284 / 3,480",
  "createdAt": "2026-10-15T08:30:00Z",
  "updatedAt": "2026-10-15T08:30:21Z",
  "result": null,
  "error": null
}
```

| 字段 | 说明 |
|---|---|
| `status` | `queued` → `running` → `succeeded` \| `failed` \| `cancelled` |
| `progress` | 0 到 1，**单调不减**。平台会把它映射到进度条的「分析」区间（约 2%～80%） |
| `stage` | 当前阶段，取值见 §5。可以跳过某些阶段，但不能乱序 |
| `stageMessage` | 可选，一句描述当前在做什么的英文，平台可以在「Activity」面板里显示 |
| `result` | `status = succeeded` 时返回，格式见 §3 |
| `error` | `status = failed` 时返回，格式见 §6 |

平台轮询间隔约 1 秒，**每次查询的响应时间应小于 200 ms**。

---

## 3. 评分结果格式（schemaVersion 1）

这是平台现在使用的格式（`providers/base.py`），**字段名和含义必须保持一致**，平台会原样保存这份数据，用来生成报告。

```json
{
  "schemaVersion": 1,
  "overallScore": 66,
  "confidence": 0.68,
  "completed": false,
  "durationSeconds": 116.0,
  "dimensions": [
    { "key": "efficiency",      "score": 62, "metrics": { "idleRatio": 0.21, "pathLengthCm": 254 } },
    { "key": "accuracy",        "score": 64, "metrics": { "threadingAttempts": 2, "entryDeviationMm": 1.8 } },
    { "key": "procedural_flow", "score": 68, "metrics": { "stepsCompleted": 9, "stepsTotal": 11, "reworkCount": 2 } },
    { "key": "safety",          "score": 72, "metrics": { "wrongToolEvents": 1, "needleDrops": 0 } },
    { "key": "product_quality", "score": 64, "metrics": { "knotThrows": 3 } }
  ],
  "events": [
    { "t": 3.0,  "severity": "error",   "code": "wrong_tool",       "label": "Wrong tool in left hand",
      "detail": "Observed tool: scissors. Expected tool: forceps.", "clip": true,
      "endT": 5.0, "confidence": 0.91 },
    { "t": 26.0, "severity": "warning", "code": "threading_failed", "label": "Threading failed",
      "detail": "First pass did not go through.", "clip": true }
  ],
  "notes": [
    "The recording ends before the task was completed; later steps could not be scored."
  ],
  "model": { "name": "suture-scorer", "version": "0.3.1" },
  "processingMs": 41250
}
```

### 3.1 顶层字段

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `schemaVersion` | int | ✔ | 固定为 `1`。格式有不兼容的改动时加 1 |
| `overallScore` | int | ✔ | 0～100。建议取各维度分数的加权平均，**权重写进文档** |
| `confidence` | float | ✔ | 0～1，表示对本次评分的把握程度。平台的显示规则：≥0.8 显示 High，≥0.6 显示 Medium，其余显示 Low。低于 0.6 时报告会提示「结论仅供参考」 |
| `completed` | bool | ✔ | 视频里是否完成了整个任务 |
| `durationSeconds` | float | ✔ | 服务端解码得到的实际时长 |
| `dimensions` | array | ✔ | 见 §3.2 |
| `events` | array | ✔ | 见 §3.3，按 `t` 升序排列，可以为空 |
| `notes` | string[] | ✔ | 影响结论可靠性的说明（英文、完整的句子），比如遮挡、光线、视频中断。没有就传空数组 |
| `model` | object | ✔ | 模型名和版本，用于追溯和复现 |
| `processingMs` | int |  | 处理耗时 |

**不要返回 `narrative` 字段**，它只给人工标注的演示视频使用；报告文字由平台的报告生成模块负责。

### 3.2 维度 `dimensions`

| key | 显示名 | 衡量什么 | 建议的指标（`metrics`） |
|---|---|---|---|
| `efficiency` | Efficiency | 用时、器械移动路径、步骤之间的停顿 | `idleRatio`、`pathLengthCm`、`durationSeconds` |
| `accuracy` | Accuracy | 进针和出针点、重复进针、针距 | `entryDeviationMm`、`insertionAttempts`、`threadingAttempts` |
| `procedural_flow` | Procedural Flow | 步骤是否完整、顺序是否正确、有没有返工 | `stepsCompleted`、`stepsTotal`、`reworkCount` |
| `safety` | Safety | 掉针、拿错器械、器械离开操作区 | `needleDrops`、`wrongToolEvents`、`outOfRegionSeconds` |
| `product_quality` | Product Quality | 缝线一致性、打结是否牢固 | `stitchSpacingCvPct`、`knotThrows` |

- `score`：0～100 的整数。
- 只返回该任务适用的维度（见 §4.1）。不适用的维度直接不返回，**不要用 0 占位**。
- `metrics`：键名用 camelCase，值为数字，**单位写在键名里**（`Mm`、`Cm`、`Pct`、`Seconds`）。不同任务可以有不同的指标，平台会原样保存，将来用于展示和分析。

### 3.3 事件 `events`

| 字段 | 类型 | 必填 | 规则 |
|---|---|---|---|
| `t` | float | ✔ | 事件**开始**时刻，从视频开头算起的秒数。精度要求见 §7 |
| `endT` | float |  | 事件结束时刻（如果是一段区间） |
| `severity` | enum | ✔ | `normal` 正常步骤；`warning` 需要注意；`error` 明确的问题 |
| `code` | string | ✔ | 机器可读的事件类型，见下表；新类型请先登记 |
| `label` | string | ✔ | 简短的英文标题，直接显示在时间轴上，不超过 60 个字符 |
| `detail` | string | ✔ | 一句英文说明，展开时显示，可以为空字符串 |
| `clip` | bool | ✔ | 是否值得作为「重点片段」单独列出。建议所有 `error`、`warning` 和关键步骤设为 true，每个视频 3～8 个 |
| `confidence` | float |  | 0～1，这个事件判断的置信度 |

**事件类型 `code`（v1）**，平台现有的模拟评分和演示标注都使用这些类型：

| code | severity | 含义 |
|---|---|---|
| `task_start` | normal | 任务开始（多段视频每段都会出现一次） |
| `segment_complete` / `task_complete` | normal | 一段结束 / 整个任务完成 |
| `wrong_tool` | error | 拿错器械（detail 中写明看到的器械和应该用的器械） |
| `tool_corrected` | normal | 换成了正确的器械 |
| `needle_pickup` / `needle_positioning` | normal | 夹针 / 调整针的位置和角度 |
| `threading_attempt` / `threading_failed` / `threading_success` | normal / warning / normal | 穿针尝试 / 穿针失败 / 穿针成功 |
| `insertion_retry` / `insertion_success` | warning / normal | 重复进针 / 进针成功 |
| `needle_drop` | error | 掉针 |
| `long_pause` | warning | 停顿超过基准时长（detail 中写明超出多少秒） |
| `knot_start`、`knot_throw_1..n` | normal | 开始打结、第 n 个结完成 |
| `knot_loose` | warning | 结不够紧或不是方结 |
| `recording_interrupted` | error | 视频在任务完成前中断 |

> **注意**：学生可以对 `warning` 和 `error` 事件提出申诉，老师采纳后系统会自动加分（问题 +4、警告 +2）。所以 **`severity` 要判得保守**：拿不准的事件宁可标 `warning`，或者给出较低的 `confidence`。

---

## 4. 任务与视频

### 4.1 任务（`taskId`）

| taskId | 名称 | 适用维度 |
|---|---|---|
| `simple-suturing` | Simple Suturing Practice | 全部 5 个 |
| `knot-tying` | Knot Tying Basics | accuracy、procedural_flow、safety、product_quality |
| `needle-handling` | Needle Handling | efficiency、accuracy、safety |

`GET /v1/capabilities` 返回服务实际支持的任务和维度。遇到不支持的 `taskId`，返回 422 `unsupported_task`。

```json
{
  "schemaVersions": [1],
  "model": { "name": "suture-scorer", "version": "0.3.1" },
  "tasks": [{ "taskId": "simple-suturing", "dimensions": ["efficiency", "accuracy", "procedural_flow", "safety", "product_quality"] }],
  "maxVideoBytes": 1073741824,
  "maxDurationSeconds": 1200
}
```

### 4.2 视频输入

| 项 | 要求 |
|---|---|
| 容器 / 编码 | 至少支持 MP4（H.264），以及 WebM（VP8/VP9）、MOV、MKV（平台允许上传这四种） |
| 大小 / 时长 | 不超过 1 GB，不超过 20 分钟 |
| 分辨率 | 不低于 720p；需要能处理 1080p@30fps（演示视频是 1920×1080） |
| 拍摄条件 | 固定俯拍、整个练习垫在画面内、蓝色手套。**如果改用 AR 眼镜的第一视角视频，必须提前说明**，它对追踪方案影响很大 |
| 多段视频 | 一个文件里可能有多次尝试（演示视频就有两段，第二段中断），需要分别识别，每段都输出 `task_start` |

---

## 5. 处理阶段（进度）

`stage` 取值和平台进度页上显示的阶段一致。只需要实现评分相关的前 5 个，后面「写报告」「关联片段」两步由平台自己完成：

| stage | 平台显示 | 说明 |
|---|---|---|
| `verify` | Verify recording | 解码、检查视频完整性、确认机位 |
| `detect_instruments` | Detect instruments | 检测器械、针、线 |
| `track_hands` | Track hands | 追踪手部关键点和轨迹 |
| `segment_steps` | Segment procedure steps | 切分步骤、识别事件 |
| `score_dimensions` | Score dimensions | 计算各维度分数和置信度 |

方案里没有的阶段可以跳过（比如纯大模型方案可以只汇报 `verify` → `score_dimensions`），但 `progress` 不能倒退。

---

## 6. 错误

### 6.1 HTTP 层（提交任务时）

| 状态码 | code | 场景 |
|---|---|---|
| 400 | `bad_request` | 缺少字段、`jobId` 格式不对 |
| 401 / 403 | `unauthorized` | API key 无效 |
| 413 | `video_too_large` | 超过大小上限 |
| 415 | `unsupported_format` | 无法解码 |
| 422 | `unsupported_task` | 不支持的 `taskId` |
| 429 | `rate_limited` | 排队已满，响应带 `Retry-After` 头 |
| 5xx | `internal_error` | 服务内部故障 |

响应体：`{ "error": { "code": "...", "message": "...", "retryable": false } }`

### 6.2 任务失败（`status = failed`）

```json
{
  "error": {
    "code": "no_instruments_detected",
    "userMessage": "We couldn't see any instruments. Film from above with the whole practice pad in frame.",
    "message": "detector found 0 tools in 3480 frames",
    "retryable": false
  }
}
```

- `userMessage`：**原样显示给学生**的英文，要告诉学生下一步怎么做。平台会把它当作「可以直接展示给学生的错误」处理（对应 `UserFacingError`）。
- `message`：写给开发者的技术细节，只记录在日志里。
- `retryable`：为 true 时，平台允许学生点 Retry 用同一个视频重试。

建议支持的业务错误码：`video_too_short`、`video_too_dark`、`camera_angle_unsupported`、`no_instruments_detected`、`no_hands_detected`、`wrong_task`（看起来做的是另一个任务）、`unsupported_format`、`internal_error`（retryable）。

---

## 7. 质量与非功能要求

| 项 | 要求 |
|---|---|
| **时间戳精度** | 事件 `t` 与人工标注的偏差 ≤ 1.0 秒（p90）。时间轴上的跳转依赖这一点 |
| **可复现** | 同一个视频、同一个模型版本，必须得到**完全相同**的结果（固定随机种子，推理时关闭 dropout）。申诉和复核都要求结果不会变 |
| **处理时长** | 2 分钟、1080p 的视频，p95 不超过 60 秒（单张 GPU）；排队时间另算，但要能通过 `progress` 看到 |
| **并发** | 至少能同时处理 2 个任务；超出的排队，不能直接拒绝 |
| **幂等** | 同一个 `jobId` 重复提交，返回同一个任务 |
| **数据保留** | 视频和中间结果在任务完成后最多保留 7 天（可以配置）；`DELETE` 后立即删除。日志里不记录视频内容 |
| **版本** | 结果中必须包含 `model.version`；不兼容的格式改动必须升级 `schemaVersion` |
| **可观测** | `/v1/health` 返回模型是否已加载、队列长度 |

### 7.1 验收标准（第一版）

1. **黄金样例**：演示视频 `suture_1.mp4`（`F:\learning\AR\resource\07_媒体素材\`）及其人工标注 [`server/demo/suture-demo-1.json`](../server/demo/suture-demo-1.json)（时间点来自 [`docs/视频戳.md`](视频戳.md)）：
   - 15 个标注事件中，`error`/`warning` 事件（0:03 拿错器械、0:26 穿针失败、1:54 视频中断）**全部检出**，且时间偏差 ≤ 1 秒；
   - 正常步骤事件的召回率 ≥ 80%；
   - `completed = false`，并且 `notes` 里说明视频中断。
2. **格式**：结果符合 §3 的格式，平台用它生成的报告能正常显示和导出。（平台侧计划补一份 JSON Schema 和契约测试，目前还没有。）
3. **一致性**：拿到一批有教师评分的视频后，`overallScore` 与教师最终分的相关系数 ≥ 0.6。平台的 `instructor_reviews` 表（AI 分 vs 教师最终分）和 `appeals` 表（被采纳的申诉 = 误判）可以导出作为评估集和训练数据。

---

## 8. 平台侧的接入方式（供参考）

服务做好后，平台新增一个 provider 即可，不需要改其他代码（`HttpScoringProvider` 目前还没有实现，下面是计划中的配置和流程）：

```
SUTURE_SCORING_PROVIDER=http
SUTURE_SCORING_URL=http://scoring-host:9000
SUTURE_SCORING_API_KEY=...
SUTURE_SCORING_TIMEOUT_S=600
```

`HttpScoringProvider.score(ctx)` 的工作流程：
1. 用 `ctx.session_id` 作为 `jobId`，连同 `ctx.task_id` 和视频文件一起 `POST /v1/jobs`；
2. 每秒 `GET` 一次，把 `progress` 和 `stage` 交给 `ctx.progress(fraction, stage)`，进度页随之更新；
3. `succeeded` 时校验 `schemaVersion == 1`，返回 `result`；
4. `failed` 时，用 `userMessage` 抛出 `UserFacingError`（学生能看到），技术细节记录到日志；
5. 超时或网络错误时让会话失败，学生可以重试；因为 `jobId` 幂等，重试不会重复计算。

演示用的 `DemoScoringProvider` 可以继续保留：登记过的演示视频走人工标注，其他视频走真实服务。只要把 `SUTURE_DEMO_FALLBACK` 改成指向 http 服务即可（需要加一个配置项，改动很小）。

---

## 附录：实现方案与输出字段的对应关系

| 输出 | 大模型（视频输入） | 跟踪 + 运动学指标 | 步骤分割 | 端到端评分 |
|---|---|---|---|---|
| `events`（带时间戳） | 能输出，但精度一般 | 停顿、拿错器械、掉针 | ✔ 主要来源 | ✘ |
| efficiency / safety | 粗略 | ✔ 主要来源 | 部分 | 只有总分 |
| procedural_flow | 粗略 | ✘ | ✔ | 只有总分 |
| accuracy / product_quality | 粗略 | 部分（需要标定画面比例） | 部分 | 只有总分 |
| `confidence` | 难以校准 | 检测置信度、遮挡比例 | 分割置信度 | 模型输出 |
| 可复现 | 需要 temperature=0，且仍有波动 | ✔ | ✔ | ✔ |

公开数据可以参考 AIxSuture（开放缝合、俯拍、带 OSATS 评分）和 JIGSAWS（机器人缝合、打结、穿针）。
