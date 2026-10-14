import { Link } from "react-router-dom";
import { CHART } from "./tokens.js";

/**
 * KPI tile: label · value · optional signed delta vs a named period.
 * @param {{ label: string, value: React.ReactNode, delta?: number|null, deltaLabel?: string,
 *   deltaSuffix?: string, upIsGood?: boolean, hint?: string, to?: string }} props
 */
export default function StatTile({ label, value, delta, deltaLabel, deltaSuffix = "", upIsGood = true, hint, to }) {
  const hasDelta = typeof delta === "number" && !Number.isNaN(delta);
  const good = hasDelta && (delta === 0 ? null : delta > 0 === upIsGood);
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value ?? "—"}</p>
      {hasDelta ? (
        <p className="mt-1 text-xs">
          <span
            className="font-semibold"
            style={{ color: good == null ? CHART.inkSecondary : good ? CHART.upGood : CHART.downBad }}
          >
            {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}
            {Math.round(delta * 10) / 10}
            {deltaSuffix}
          </span>{" "}
          <span className="text-slate-500">{deltaLabel}</span>
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </>
  );
  const cls = "surface-card block p-4 transition-colors";
  return to ? (
    <Link to={to} className={`${cls} hover:border-brand-200`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
