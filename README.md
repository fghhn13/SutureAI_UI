# SutureAI · Training Report Dashboard

SutureAI 缝合技能训练的一页式报告看板，用于展示单次训练的综合得分、多维度能力分析、时间轴事件与重点片段，并预留教官评审与学员反馈等界面区域。

## 功能概览

- **总览**：产品/任务信息、综合得分环、与基准对比的增量、训练时长与完成状态
- **五维评分**：效率、精准度、流程、安全、质量等维度的分数与说明，附雷达图
- **时间轴**：按时间线展示关键事件（正常 / 警告 / 问题），可展开查看详情
- **重点片段**：与训练相关的短视频/证据片段入口（含示例证图区域）
- **评价与建议**：优势、待改进、练习建议、AI 摘要、不确定性说明
- **教官与学员**：教官评语/终评、学员接受或澄清等交互占位

当前页面数据为 `src/App.jsx` 中的静态示例对象 `reportData`，便于先定稿 UI 与信息架构；后续可替换为 API 或父应用传入的 props。

## 技术栈

| 类型     | 选用 |
|----------|------|
| 框架     | [React 18](https://react.dev/) |
| 构建     | [Vite 5](https://vitejs.dev/) |
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
├── src/
│   ├── main.jsx
│   ├── index.css
│   └── App.jsx          # 报告页主组件与示例数据
└── picture/             # 证图等静态资源（如证据预览图）
```

## 许可证

私有学习/项目用途；如需开源请自行补充 `LICENSE` 与说明。
