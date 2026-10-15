import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../api/client.js";
import ScoreHeatmap from "../../components/charts/ScoreHeatmap.jsx";
import Sparkline from "../../components/charts/Sparkline.jsx";
import StatTile from "../../components/charts/StatTile.jsx";
import { CHART } from "../../components/charts/tokens.js";
import { InstructorShell, LoadError, SeverityBadge, relativeDays, reportLink, signed } from "./shared.jsx";

const COLUMNS = [
  { key: "name", label: "Student", sort: (r) => r.name.toLowerCase() },
  { key: "lastActive", label: "Last active", sort: (r) => r.daysSinceActive ?? Infinity },
  { key: "sessions", label: "Sessions 7d / 30d", sort: (r) => -r.sessions30d },
  { key: "latest", label: "Latest", sort: (r) => r.latestScore ?? -1 },
  { key: "trend", label: "Trend" },
  { key: "change", label: "Change", sort: (r) => r.recentChange ?? 0 },
  { key: "weakest", label: "Weakest dimension", sort: (r) => r.weakestDimension ?? "~" },
  { key: "pending", label: "To review", sort: (r) => -(r.pendingReviews + r.openAppeals) },
];

function AttentionList({ items }) {
  if (!items.length) {
    return <p className="mt-4 text-sm text-slate-600">Nothing needs your attention right now.</p>;
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
            <p className="text-slate-600">{a.message}</p>
          </div>
          {a.sessionId ? (
            <Link to={reportLink(a.sessionId)} className="link-brand shrink-0 text-xs">
              Open report
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Roster({ students }) {
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
          <h2 className="text-lg font-semibold text-slate-900">Students</h2>
          <p className="text-sm text-slate-600">Click a column to sort; open a student for their full history.</p>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students"
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
                      {c.label}
                      {sort.key === c.key ? (sort.dir > 0 ? " ↑" : " ↓") : ""}
                    </button>
                  ) : (
                    c.label
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
                  {relativeDays(s.daysSinceActive)}
                  {s.inProgress ? <p className="text-xs text-brand-700">{s.inProgress} processing</p> : null}
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
                <td className="py-3 pr-4 text-slate-700">{s.weakestDimension ?? "—"}</td>
                <td className="py-3 pr-4">
                  {s.pendingReviews ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {s.pendingReviews} report{s.pendingReviews > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                  {s.openAppeals ? (
                    <span className="ml-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-800">
                      {s.openAppeals} appeal{s.openAppeals > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="py-6 text-center text-sm text-slate-500">No students match.</p> : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Trend: last 8 report scores. Change: average of the last 3 reports vs the 3 before them.
      </p>
    </section>
  );
}

export default function InstructorDashboardPage() {
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
        <p className="py-16 text-center text-slate-600">You are not assigned to any cohort yet.</p>
      </InstructorShell>
    );
  }

  const k = data?.kpis;
  return (
    <InstructorShell>
      {/* Filter row: scopes everything below. */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Class overview</h1>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          Cohort
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
        <p className="py-16 text-center text-sm text-slate-500">Loading class overview…</p>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Students" value={k.students} hint={`${k.activeStudents7d} trained this week`} />
            <StatTile
              label="Sessions this week"
              value={k.sessions7d}
              delta={k.sessions7d - k.sessionsPrev7d}
              deltaLabel="vs previous week"
            />
            <StatTile
              label="Average score, 30 days"
              value={k.avgScore30d != null ? Math.round(k.avgScore30d) : "—"}
              delta={k.avgScore30d != null && k.avgScorePrev30d != null ? k.avgScore30d - k.avgScorePrev30d : null}
              deltaLabel="vs previous 30 days"
              hint="No reports in the last 30 days"
            />
            <StatTile
              label="Reports to review"
              value={k.pendingReviews}
              hint="Open review queue →"
              to={`/instructor/reviews?cohort=${encodeURIComponent(data.cohort.id)}`}
            />
            <StatTile
              label="Open appeals"
              value={k.openAppeals}
              hint="Students disputing a finding →"
              to={`/instructor/reviews?filter=appeals&cohort=${encodeURIComponent(data.cohort.id)}`}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section className="surface-card p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-slate-900">Needs attention</h2>
              <p className="text-sm text-slate-600">
                Appeals, declining or low scores, inactivity and failed uploads.
              </p>
              <AttentionList items={data.attention} />
            </section>
            <section className="surface-card p-6 lg:col-span-3">
              <h2 className="text-lg font-semibold text-slate-900">Skill map</h2>
              <p className="text-sm text-slate-600">
                Where each student is strong or weak. Paler cells are lower scores.
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
