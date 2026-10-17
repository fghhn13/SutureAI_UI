import { useI18n } from "../../i18n/index.js";
import { CHART } from "./tokens.js";

/**
 * Tiny single-series trend for table rows: de-emphasised line, latest point in the accent.
 * Values are exposed through the accessible label (and the row shows the latest number).
 * @param {{ values: number[], width?: number, height?: number, minSpan?: number, label?: string }} props
 */
export default function Sparkline({ values, width = 96, height = 28, minSpan = 20, label }) {
  const { t } = useI18n();
  if (!values?.length) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  // Self-scaled (a sparkline shows shape), but never tighter than minSpan points so
  // small noise doesn't look like a cliff.
  const mid = (Math.min(...values) + Math.max(...values)) / 2;
  const half = Math.max(minSpan, Math.max(...values) - Math.min(...values)) / 2;
  const min = mid - half;
  const max = mid + half;
  const pad = 5; // room for the end dot + ring
  const x = (i) => (values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v) => pad + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * (height - 2 * pad);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  const text = label ?? t("charts.sparkline", { count: values.length, values: values.join(", ") });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={text}>
      <title>{text}</title>
      <path d={d} fill="none" stroke={CHART.deEmphasis} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last])} r={4} fill={CHART.series} stroke={CHART.surface} strokeWidth={2} />
    </svg>
  );
}
