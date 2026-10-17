import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/index.js";
import { CHART } from "./tokens.js";

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Single-series line over ordered points (sessions), with crosshair + tooltip.
 * Hover/arrow keys snap to the nearest point; click/Enter calls onSelect(point).
 *
 * @param {{
 *   points: { key: string, value: number, label: string, detail?: string }[],
 *   height?: number, min?: number, max?: number, compact?: boolean,
 *   ariaLabel: string, valueLabel?: string (defaults to "Score", localised), onSelect?: (p: any) => void,
 * }} props
 */
export default function LineChart({
  points,
  height = 220,
  min = 30,
  max = 100,
  compact = false,
  ariaLabel,
  valueLabel,
  onSelect,
}) {
  const { t } = useI18n();
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [active, setActive] = useState(null);

  useEffect(() => setActive(null), [points]);

  const m = compact ? { l: 4, r: 30, t: 8, b: 8 } : { l: 36, r: 36, t: 12, b: 28 };
  const innerW = Math.max(0, width - m.l - m.r);
  const innerH = height - m.t - m.b;
  const n = points.length;
  const x = (i) => m.l + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const y = (v) => m.t + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * innerH;
  const ticks = compact ? [] : [min, Math.round((min + max) / 2), max];

  function nearest(clientX) {
    const rect = wrapRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    if (n === 1) return 0;
    const i = Math.round(((px - m.l) / innerW) * (n - 1));
    return Math.min(n - 1, Math.max(0, i));
  }

  function onKeyDown(e) {
    if (!n) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      setActive((cur) => Math.min(n - 1, Math.max(0, (cur ?? (step > 0 ? -1 : n)) + step)));
    } else if (e.key === "Enter" && active != null && onSelect) {
      onSelect(points[active]);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = n - 1;
  const hovered = active != null ? points[active] : null;
  const tipLeft = hovered ? Math.min(Math.max(x(active), 80), Math.max(80, width - 80)) : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      {width > 0 && n > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="rounded outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          style={{ cursor: onSelect ? "pointer" : "default" }}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={() => setActive(null)}
          onClick={(e) => onSelect?.(points[nearest(e.clientX)])}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} />
              <text x={m.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.inkMuted}>
                {t}
              </text>
            </g>
          ))}
          {!compact ? (
            <>
              <text x={m.l} y={height - 8} fontSize={11} fill={CHART.inkMuted}>
                {points[0].label}
              </text>
              {n > 1 ? (
                <text x={width - m.r} y={height - 8} fontSize={11} fill={CHART.inkMuted} textAnchor="end">
                  {points[last].label}
                </text>
              ) : null}
            </>
          ) : null}

          {hovered ? (
            <line x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + innerH} stroke={CHART.axis} strokeWidth={1} />
          ) : null}

          <path d={path} fill="none" stroke={CHART.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* End marker + direct label on the latest value. */}
          <circle cx={x(last)} cy={y(points[last].value)} r={4} fill={CHART.series} stroke={CHART.surface} strokeWidth={2} />
          <text
            x={x(last) + 8}
            y={y(points[last].value)}
            dy="0.32em"
            fontSize={compact ? 11 : 12}
            fontWeight={600}
            fill={CHART.inkPrimary}
          >
            {points[last].value}
          </text>

          {hovered ? (
            <circle cx={x(active)} cy={y(hovered.value)} r={5} fill={CHART.series} stroke={CHART.surface} strokeWidth={2} />
          ) : null}
        </svg>
      ) : null}

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: tipLeft, top: 0 }}
          role="status"
        >
          <p className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 rounded" style={{ background: CHART.series }} />
            <span className="text-sm font-semibold text-slate-900">{hovered.value}</span>
            <span className="text-slate-500">{valueLabel ?? t("charts.score")}</span>
          </p>
          <p className="text-slate-600">{hovered.label}</p>
          {hovered.detail ? <p className="text-slate-500">{hovered.detail}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
