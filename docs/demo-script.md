# 演示脚本：上传视频 → 分析 → 报告 → 申诉 → 教师裁决

评分 API 和报告生成 API 还没接入前，用**预先标注的演示视频**完整演示整个流程。上传的视频如果是登记过的演示视频，系统会按 [server/demo/suture-demo-1.json](../server/demo/suture-demo-1.json) 里的标注生成报告，所以时间轴上的每个时间戳都和视频内容对得上。其他视频仍然走 mock 评分（也可以配置成直接拒绝，见文末）。

## 一、演示前准备（只需做一次）

1. **登记演示视频**。系统按文件的 SHA-256 识别，所以文件改名也能认出来；但只要内容有任何改动（重新导出、剪辑），就必须重新登记。

   ```bash
   npm run demo:register -- path/to/suture_1.mp4
   ```

   登记成功会输出 `Registered ... for 'suture-demo-1'`。也可以在 `server/` 目录下运行 `.\.venv\Scripts\python -m app.demo check <视频>`，确认某个文件能否被识别。

   > 视频还没登记时，文件名为 `suture_1.mp4` 的视频也会被识别（后备规则）。正式演示请一定用哈希登记，这样改名不受影响，也不会误认其他文件。

2. **核对标注**。打开 `server/demo/suture-demo-1.json`，对照视频检查每个事件的秒数 `t`、标题和说明；分数、总结、建议等文字在 `narrative` 里。改完不需要重启，下一次上传就会生效。

3. **准备浏览器**：Chrome 开两个窗口，一个普通窗口、一个无痕窗口，分别登录学生和老师。两个账号的登录状态互不影响，演示时直接切换窗口即可。

## 二、每次演示前

```bash
npm run demo:reset
```

```bash
npm start
```

`demo:reset` 会清空数据库和已上传的视频，恢复成干净的演示数据，**本地数据会全部丢失**。

| 窗口 | 账号 | 密码 |
|------|------|------|
| 普通窗口（学生） | `alex@demo.local` | `suture-local-demo` |
| 无痕窗口（老师） | `chen@demo.local` | `suture-local-demo` |

## 三、演示流程（约 5 分钟）

| # | 窗口 | 操作 | 讲解要点 |
|---|------|------|----------|
| 1 | 学生 | 主页 → **Start training** → 选择 *Simple Suturing Practice* | 学生录完练习后上传视频 |
| 2 | 学生 | 拖入演示视频 → 确认右侧显示的时长 → **Upload & analyse** | 上传有进度条，可以取消 |
| 3 | 学生 | 停留在进度页（约 30 秒） | 7 个分析阶段依次完成，右侧实时显示分析动态，有剩余时间预估；完成后**自动跳转到报告** |
| 4 | 学生 | 报告顶部：66 分、五维评分、雷达图 | 每个维度都有说明 |
| 5 | 学生 | 时间轴 **0:26 Threading failed** → **Replay** | 视频自动跳到该时刻（**视频戳**） |
| 6 | 学生 | 时间轴 **0:03 Wrong tool in left hand** → **Appeal** → 选择 *This didn't happen*，填写说明 → **Send appeal** | 学生可以对具体某个判定提出申诉；时间轴上随即显示「Appeal pending」 |
| 7 | 老师 | 概览页 **Open appeals** 数字加 1 → 进入 Review queue 的 **Appeals** 页 → 点击 **Decide** | 老师能看到所有待处理的申诉 |
| 8 | 老师 | 申诉卡片上点 **▶ 0:03** | 跳到被申诉的片段，确认视频内容 |
| 9 | 老师 | 选 **Accept**（建议加 +4 分）→ 填写理由 → **Send decision** | 申诉被采纳后，该判定被撤销，分数自动调整为 70 |
| 10 | 老师 | 下方 Instructor review：最终分已经是 70 → 写评语 → **Complete review** | 老师确认最终成绩 |
| 11 | 学生 | 刷新报告 | 0:03 那一条显示删除线和「Overturned after appeal」，分数 70，并显示老师的裁决理由和评语 |
| 12 | 学生 | 报告顶部 **Export PDF** → 在打印对话框中选「另存为 PDF」 | 导出的 PDF 包含时间轴上每个时间点的视频截图、申诉记录和老师评审，可以归档 |

**备用路线**：如果现场上传或分析出了问题，可以直接打开 Alex 已有的报告（主页 → *Open latest report*），从第 4 步继续讲。这份样例报告的视频地址是 `/video/suture_1.mp4`，要让它能播放，需要事先把演示视频复制到 `public/video/suture_1.mp4`（这个目录不会提交到 Git）。

## 四、可调参数（环境变量，在 `npm start` 前设置）

| 变量 | 默认值 | 作用 |
|------|--------|------|
| `SUTURE_DEMO_ANALYSIS_S` | `24` | 分析阶段的总时长（秒） |
| `SUTURE_MOCK_REPORT_DELAY_S` | `4` | 生成报告阶段的时长（秒） |
| `SUTURE_DEMO_FALLBACK` | `mock` | 遇到未登记的视频怎么处理：`mock` 用随机评分；`reject` 直接报错，提示「这不是登记的演示视频」 |

PowerShell 示例：

```powershell
$env:SUTURE_DEMO_ANALYSIS_S = "15"; npm start
```

## 五、接入真实 API 后

演示用的是一个可替换的评分模块（`server/app/providers/demo.py`），接口和格式与将来的真实评分 API 完全相同（见 `providers/base.py`）。真实 API 接好后，把 `SUTURE_SCORING_PROVIDER` 切换过去即可；上传、进度页、报告、申诉、PDF 导出都不需要改。
