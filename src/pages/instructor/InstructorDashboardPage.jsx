import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client.js";
import ScoreHeatmap from "../../components/charts/ScoreHeatmap.jsx";
import Sparkline from "../../components/charts/Sparkline.jsx";
import StatTile from "../../components/charts/StatTile.jsx";
import { CHART } from "../../components/charts/tokens.js";
import { attentionText, dimensionName, useI18n } from "../../i18n/index.js";
import { InstructorShell, LoadError, SeverityBadge, relativeDays, reportLink, signed } from "./shared.jsx";

/** Column labels: instructor.overview.columns.<key>. */
const COLUMNS = [
  { key: "name", sort: (r) => r.name.toLowerCase() },
  { key: "lastActive", sort: (r) => r.daysSinceActive ?? Infinity },
  { key: "sessions", sort: (r) => -r.sessions30d },
  { key: "latest", sort: (r) => r.latestScore ?? -1 },
  { key: "trend" },
  { key: "change", sort: (r) => r.recentChange ?? 0 },
  { key: "weakest", sort: (r) => r.weakestDimension ?? "~" },
  { key: "pending", sort: (r) => -(r.pendingReviews + r.openAppeals) },
];

function AttentionList({ items }) {
  const { t } = useI18n();
  if (!items.length) {
    return <p className="mt-4 text-sm text-slate-600">{t("instructor.overview.attentionEmpty")}</p>;
  }
  return (
    <ul className="mt-4 space-y-2">
      {items.map((a, i) => (
        <li
          key={`${a.studentId}-${a.kind}-${a.sessionId ?? i}`}
          className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm"
        >
          <SeverityBadge severity={a.severity} />
          <div className="min-w-0 flex-1">
            <Link to={`/instructor/students/${a.studentId}`} className="font-semibold text-slate-900 hover:underline">
              {a.studentName}
            </Link>
            <p className="text-slate-600">{attentionText(t, a)}</p>
          </div>
          {a.sessionId ? (
            <Link to={reportLink(a.sessionId)} className="link-brand shrink-0 text-xs">
              {t("instructor.overview.openReport")}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Roster({ students }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "pending", dir: 1 });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = COLUMNS.find((c) => c.key === sort.key);
    const filtered = students.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.includes(q));
    if (!col?.sort) return filtered;
    return [...filtered].sort((a, b) => {
      const va = col.sort(a);
      const vb = col.sort(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [students, query, sort]);

  return (
    <section className="surface-card mt-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t("instructor.overview.studentsTitle")}</h2>
          <p className="text-sm text-slate-600">{t("instructor.overview.studentsSubtitle")}</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("instructor.overview.search")}
          aria-label={t("instructor.overview.search")}
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {COLUMNS.map((c) => (
                <th key={c.key} className="pb-3 pr-4" aria-sort={sort.key === c.key ? (sort.dir > 0 ? "ascending" : "descending") : undefined}>
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}
                      className="uppercase hover:text-slate-800"
                    >
                      {t(`instructor.overview.columns.${c.key}`)}
                      {sort.key === c.key ? (sort.dir > 0 ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    t(`instructor.overview.columns.${c.key}`)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-brand-50/50">
                <td className="py-3 pr-4">
                  <Link to={`/instructor/students/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-slate-500">{s.email}</p>
                </td>
                <td className="py-3 pr-4 text-slate-700">
                  {relativeDays(t, s.daysSinceActive)}
                  {s.inProgress ? <p className="text-xs text-brand-700">{t("instructor.counts.processing", { count: s.inProgress })}</p> : null}
                </td>
                <td className="py-3 pr-4 tabular-nums text-slate-700">
                  {s.sessions7d} / {s.sessions30d}
                </td>
                <td className="py-3 pr-4 text-base font-semibold tabular-nums text-slate-900">{s.latestScore ?? "—"}</td>
                <td className="py-3 pr-4">
                  <Sparkline values={s.trend} />
                </td>
                <td className="py-3 pr-4 font-semibold tabular-nums">
                  {s.recentChange == null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span style={{ color: s.recentChange > 0 ? CHART.upGood : s.recentChange < 0 ? CHART.downBad : CHART.inkSecondary }}>
                      {s.recentChange > 0 ? "▲ " : s.recentChange < 0 ? "▼ " : ""}
                      {signed(s.recentChange)}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-slate-700">{dimensionName(t, s.weakestDimension)}</td>
                <td className="py-3 pr-4">
                  {s.pendingReviews ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {t("instructor.counts.reports", { count: s.pendingReviews })}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  {s.openAppeals ? (
                    <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
                      {t("instructor.counts.appeals", { count: s.openAppeals })}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="py-6 text-center text-sm text-slate-500">{t("instructor.overview.noMatch")}</p> : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t("instructor.overview.footnote")}
      </p>
    </section>
  );
}

export default function InstructorDashboardPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cohorts, setCohorts] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const cohortId = searchParams.get("cohort") ?? cohorts?.[0]?.id ?? null;

  useEffect(() => {
    api("/instructor/cohorts")
      .then(setCohorts)
      .catch((e) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    if (!cohortId) return;
    setLoading(true);
    setError(null);
    api(`/instructor/cohorts/${encodeURIComponent(cohortId)}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cohortId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <InstructorShell>
        <LoadError message={error} onRetry={load} />
      </InstructorShell>
    );
  }

  if (cohorts && cohorts.length === 0) {
    return (
      <InstructorShell>
        <p className="py-16 text-center text-slate-600">{t("instructor.overview.noCohort")}</p>
      </InstructorShell>
    );
  }

  const k = data?.kpis;
  return (
    <InstructorShell>
      {/* Filter row: scopes everything below. */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t("instructor.overview.title")}</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          {t("instructor.overview.cohort")}
          <select
            value={cohortId ?? ""}
            onChange={(e) => setSearchParams({ cohort: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            {(cohorts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.courseName} ({c.studentCount})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data ? (
        <p className="py-16 text-center text-sm text-slate-500">{t("instructor.overview.loading")}</p>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile
              label={t("instructor.overview.kpiStudents")}
              value={k.students}
              hint={t("instructor.overview.kpiActive", { count: k.activeStudents7d })}
            />
            <StatTile
              label={t("instructor.overview.kpiSessions")}
              value={k.sessions7d}
              delta={k.sessions7d - k.sessionsPrev7d}
              deltaLabel={t("instructor.overview.kpiSessionsDelta")}
            />
            <StatTile
              label={t("instructor.overview.kpiAvgScore")}
              value={k.avgScore30d != null ? Math.round(k.avgScore30d) : "—"}
              delta={k.avgScore30d != null && k.avgScorePrev30d != null ? k.avgScore30d - k.avgScorePrev30d : null}
              deltaLabel={t("instructor.overview.kpiAvgScoreDelta")}
              hint={t("instructor.overview.kpiAvgScoreEmpty")}
            />
            <StatTile
              label={t("instructor.overview.kpiToReview")}
              value={k.pendingReviews}
              hint={t("instructor.overview.kpiToReviewHint")}
              to={`/instructor/reviews?cohort=${encodeURIComponent(data.cohort.id)}`}
            />
            <StatTile
              label={t("instructor.overview.kpiAppeals")}
              value={k.openAppeals}
              hint={t("instructor.overview.kpiAppealsHint")}
              to={`/instructor/reviews?filter=appeals&cohort=${encodeURIComponent(data.cohort.id)}`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section className="surface-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">{t("instructor.overview.attentionTitle")}</h2>
              <p className="text-sm text-slate-600">
                {t("instructor.overview.attentionSubtitle")}
              </p>
              <AttentionList items={data.attention} />
            </section>
            <section className="surface-card p-6 lg:col-span-3">
              <h2 className="text-lg font-semibold text-slate-900">{t("instructor.overview.skillMapTitle")}</h2>
              <p className="text-sm text-slate-600">
                {t("instructor.overview.skillMapSubtitle")}
              </p>
              <div className="mt-4">
                <ScoreHeatmap
                  dimensions={data.dimensions}
                  rows={data.students.map((s) => ({ id: s.id, name: s.name, values: s.dimensionAverages }))}
                  cohortAverages={data.cohortDimensionAverages}
                />
              </div>
            </section>
          </div>

          <Roster students={data.students} />
        </div>
      )}
    </InstructorShell>
  );
}
