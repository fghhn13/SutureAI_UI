import { Link } from "react-router-dom";
import { dimensionName, useI18n } from "../../i18n/index.js";
import { BLUE_RAMP, rampColor } from "./tokens.js";

const LO = 40;
const HI = 95;

/**
 * Students × dimensions grid of recent average scores (sequential one-hue ramp, value
 * printed in each cell so it doubles as the table view). Rows link to the student page.
 * @param {{ dimensions: string[], rows: { id: number, name: string, values: Record<string, number|null> }[],
 *   cohortAverages?: Record<string, number|null> }} props
 */
export default function ScoreHeatmap({ dimensions, rows, cohortAverages }) {
  const { t } = useI18n();
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate text-sm" style={{ borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="pb-2 pr-2 text-left text-xs font-semibold text-slate-500">{t("charts.heatmap.student")}</th>
              {dimensions.map((d) => (
                <th key={d} className="px-1 pb-2 text-center text-xs font-semibold text-slate-500">
                  {dimensionName(t, d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group">
                <th scope="row" className="pr-2 text-left font-medium">
                  <Link to={`/instructor/students/${row.id}`} className="text-slate-800 hover:text-brand-700 hover:underline">
                    {row.name}
                  </Link>
                </th>
                {dimensions.map((d) => {
                  const v = row.values[d];
                  if (v == null) {
                    return (
                      <td
                        key={d}
                        className="h-9 rounded text-center text-xs text-slate-400"
                        style={{ background: "repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 4px,#fff 4px,#fff 8px)" }}
                        title={t("charts.heatmap.noData", { name: row.name, dimension: dimensionName(t, d) })}
                      >
                        —
                      </td>
                    );
                  }
                  const { fill, ink } = rampColor(v, LO, HI);
                  return (
                    <td
                      key={d}
                      tabIndex={0}
                      title={t("charts.heatmap.cell", { name: row.name, dimension: dimensionName(t, d), value: v })}
                      className="h-9 rounded text-center font-semibold tabular-nums outline-none transition-shadow hover:ring-2 hover:ring-slate-900/30 focus-visible:ring-2 focus-visible:ring-slate-900/40"
                      style={{ background: fill, color: ink }}
                    >
                      {Math.round(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {cohortAverages ? (
            <tfoot>
              <tr>
                <th scope="row" className="pr-2 pt-2 text-left text-xs font-semibold text-slate-500">
                  {t("charts.heatmap.cohortAverage")}
                </th>
                {dimensions.map((d) => (
                  <td key={d} className="pt-2 text-center text-xs font-semibold tabular-nums text-slate-700">
                    {cohortAverages[d] != null ? Math.round(cohortAverages[d]) : "—"}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500" aria-hidden>
        <span>{t("charts.heatmap.low", { value: LO })}</span>
        <span
          className="h-2 w-40 rounded"
          style={{ background: `linear-gradient(90deg, ${BLUE_RAMP.join(",")})` }}
        />
        <span>{t("charts.heatmap.high", { value: HI })}</span>
        <span className="ml-2">{t("charts.heatmap.note")}</span>
      </div>
    </div>
  );
}
