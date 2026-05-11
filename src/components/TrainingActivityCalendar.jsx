import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";

function dateKey(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(d) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Activity intensity from session count only (not score). */
function sessionIntensityLevel(sessions) {
  if (!sessions || sessions <= 0) return 0;
  if (sessions === 1) return 1;
  if (sessions === 2) return 2;
  return 3;
}

function buildWeekColumns(year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const padStart = new Date(yearStart);
  const dow = (yearStart.getDay() + 6) % 7;
  padStart.setDate(yearStart.getDate() - dow);
  const padEnd = new Date(yearEnd);
  const dowE = (yearEnd.getDay() + 6) % 7;
  padEnd.setDate(yearEnd.getDate() + (6 - dowE));

  const columns = [];
  const cur = new Date(padStart);
  while (cur <= padEnd) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      col.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    columns.push(col);
  }
  return columns;
}

function cellClasses(level, inSelectedYear, hasData) {
  if (!inSelectedYear) {
    return "bg-slate-50 border border-transparent";
  }
  if (level === 0 || !hasData) {
    return "bg-slate-100 border border-slate-200/80";
  }
  if (level === 1) return "bg-emerald-200 border border-emerald-300/60";
  if (level === 2) return "bg-emerald-400 border border-emerald-500/50";
  return "bg-emerald-600 border border-emerald-700/40";
}

export default function TrainingActivityCalendar({
  activityByDate,
  years,
  defaultYear,
}) {
  const [selectedYear, setSelectedYear] = useState(defaultYear ?? years[0]);
  const [hover, setHover] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);

  const columns = useMemo(() => buildWeekColumns(selectedYear), [selectedYear]);

  const totalSessionsInYear = useMemo(() => {
    let sum = 0;
    for (const [key, val] of Object.entries(activityByDate)) {
      if (key.startsWith(`${selectedYear}-`) && val?.sessions) {
        sum += val.sessions;
      }
    }
    return sum;
  }, [activityByDate, selectedYear]);

  const monthLabels = useMemo(() => {
    return columns.map((col, wi) => {
      const monday = col[0];
      if (!monday) return { wi, label: "" };
      const prevMonday = wi > 0 ? columns[wi - 1][0] : null;
      const monthBoundary =
        !prevMonday ||
        prevMonday.getMonth() !== monday.getMonth() ||
        prevMonday.getFullYear() !== monday.getFullYear();
      const label = monthBoundary
        ? monday.toLocaleDateString("en-US", { month: "short" })
        : "";
      return { wi, label };
    });
  }, [columns]);

  const reportSearch = (reportId) =>
    `?report=${encodeURIComponent(reportId)}`;

  const onLeaveGrid = useCallback(() => {
    setHover(null);
  }, []);

  return (
    <section className="surface-card surface-card-lift p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Training Activity Calendar
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            How often you practiced—darker squares mean more sessions that day (not a score
            judgement). Use it to spot streaks and gaps.
          </p>
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{totalSessionsInYear}</span>{" "}
            training sessions in {selectedYear}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Year
          </span>
          <div className="flex flex-col gap-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setSelectedYear(y);
                  setSelectedKey(null);
                  setHover(null);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200 ease-smooth active:scale-95 ${
                  selectedYear === y
                    ? "bg-brand-600 text-white shadow-md ring-2 ring-brand-500/30"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-6 flex gap-2 overflow-x-auto pb-2" onMouseLeave={onLeaveGrid}>
        {/* Weekday labels */}
        <div className="flex shrink-0 flex-col justify-between pt-6 text-[10px] font-medium text-slate-400">
          <span className="h-3 leading-3">Mon</span>
          <span className="h-3 leading-3" aria-hidden />
          <span className="h-3 leading-3">Wed</span>
          <span className="h-3 leading-3" aria-hidden />
          <span className="h-3 leading-3">Fri</span>
          <span className="h-3 leading-3" aria-hidden />
          <span className="h-3 leading-3" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          {/* Month row */}
          <div className="mb-1 flex gap-[3px]">
            {monthLabels.map(({ wi, label }) => (
              <div
                key={wi}
                className="w-3 shrink-0 text-center text-[10px] font-medium leading-none text-slate-500"
                style={{ width: "11px" }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {columns.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((date) => {
                  const key = dateKey(date);
                  const inY = date.getFullYear() === selectedYear;
                  const dayData = inY ? activityByDate[key] : null;
                  const sessions = dayData?.sessions ?? 0;
                  const level = inY ? sessionIntensityLevel(sessions) : 0;
                  const hasData = inY && sessions > 0;

                  return (
                    <button
                      key={key + wi}
                      type="button"
                      tabIndex={inY ? 0 : -1}
                      disabled={!inY}
                      onClick={() => {
                        if (inY) setSelectedKey(key);
                      }}
                      onMouseEnter={(e) => {
                        if (!inY) return;
                        setHover({
                          key,
                          clientX: e.clientX,
                          clientY: e.clientY,
                          data: dayData,
                          date,
                        });
                      }}
                      onMouseMove={(e) => {
                        setHover((h) =>
                          h && h.key === key
                            ? { ...h, clientX: e.clientX, clientY: e.clientY }
                            : h,
                        );
                      }}
                      onMouseLeave={() => setHover(null)}
                      className={`h-3 w-3 shrink-0 rounded-sm transition-all duration-150 ease-smooth motion-safe:hover:z-10 motion-safe:hover:scale-125 motion-safe:hover:shadow-sm ${cellClasses(
                        level,
                        inY,
                        hasData,
                      )} ${inY ? "cursor-pointer hover:ring-2 hover:ring-brand-400/60 focus:outline-none focus:ring-2 focus:ring-brand-500" : "cursor-default"}`}
                      aria-label={
                        inY
                          ? `${formatDisplayDate(date)}, ${sessions} session(s)`
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hover && hover.data && hover.data.sessions > 0 && (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm motion-safe:animate-tooltip-in"
          style={{
            left: Math.max(
              12,
              Math.min(
                hover.clientX,
                typeof window !== "undefined" ? window.innerWidth - 220 : hover.clientX,
              ),
            ),
            top: Math.max(12, hover.clientY - 12),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="font-semibold text-slate-900">{formatDisplayDate(hover.date)}</p>
          <p className="mt-1 text-slate-700">
            {hover.data.sessions} training session
            {hover.data.sessions === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-slate-600">
            Tasks: {hover.data.tasks?.join(", ") || "—"}
          </p>
          <p className="mt-1 text-slate-600">
            Total practice time: {hover.data.totalMinutes ?? "—"} min
          </p>
          <p className="mt-1 text-slate-600">
            Reports ready: {hover.data.reportsReady ?? 0}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>How often you trained (session count)</span>
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="flex gap-1">
            <span className="h-3 w-3 rounded-sm bg-slate-100 ring-1 ring-slate-200/80" />
            <span className="h-3 w-3 rounded-sm bg-emerald-200 ring-1 ring-emerald-300/60" />
            <span className="h-3 w-3 rounded-sm bg-emerald-400 ring-1 ring-emerald-500/50" />
            <span className="h-3 w-3 rounded-sm bg-emerald-600 ring-1 ring-emerald-700/40" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Selected day summary */}
      {selectedKey && selectedKey.startsWith(`${selectedYear}-`) && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-inner ring-1 ring-slate-100/80 motion-safe:animate-fade-in-up-fast">
          <p className="text-sm font-semibold text-slate-900">
            {formatDisplayDate(new Date(`${selectedKey}T12:00:00`))}
          </p>
          {(activityByDate[selectedKey]?.sessions ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              No training sessions logged on this day (demo).
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {(activityByDate[selectedKey].records || []).map((rec, idx) => (
                <li
                  key={idx}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm transition-all duration-200 hover:border-brand-100 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">{rec.taskName}</p>
                    <p className="text-slate-600">
                      Score{" "}
                      {rec.score != null ? `${rec.score}/100` : "—"} · {rec.reliability} ·
                      Instructor: {rec.instructorStatus}
                    </p>
                  </div>
                  <Link
                    to={{ pathname: "/report", search: reportSearch(rec.reportId) }}
                    className="shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition-all duration-200 hover:bg-brand-700 hover:shadow-md active:scale-[0.98]"
                  >
                    View report
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
