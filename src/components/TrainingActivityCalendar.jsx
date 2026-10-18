import { useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { intlLocale, reliabilityLabel, reviewStatusLabel, taskName, useI18n } from "../i18n/index.js";

function dateKey(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DISPLAY_DATE = { month: "short", day: "numeric", year: "numeric" };

/** Short weekday name for a Monday-based row index (0 = Monday). */
function weekdayLabel(locale, row) {
  // 1 Jan 2024 was a Monday.
  return new Date(2024, 0, 1 + row).toLocaleDateString(intlLocale(locale), { weekday: "short" });
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
  if (level === 1) return "bg-brand-200 border border-brand-300/60";
  if (level === 2) return "bg-brand-400 border border-brand-500/50";
  return "bg-brand-600 border border-brand-700/40";
}

export default function TrainingActivityCalendar({
  activityByDate,
  years,
  defaultYear,
  number,
}) {
  const { t, locale, formatDate } = useI18n();
  const formatDisplayDate = (d) => formatDate(d, DISPLAY_DATE);
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
        ? monday.toLocaleDateString(intlLocale(locale), { month: "short" })
        : "";
      return { wi, label };
    });
  }, [columns, locale]);

  const reportSearch = (sessionId) =>
    `?session=${encodeURIComponent(sessionId)}`;

  const onLeaveGrid = useCallback(() => {
    setHover(null);
  }, []);

  return (
    <section className="surface-card surface-card-lift p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="section-title">
            {number ? <span className="section-num">{number}</span> : null}
            {t("calendar.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {t("calendar.subtitle")}
          </p>
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-display text-lg font-semibold text-brand-700">{totalSessionsInYear}</span>{" "}
            {t("calendar.sessionsInYear", { count: totalSessionsInYear, year: selectedYear })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("calendar.year")}
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
                className={`rounded px-3 py-1 font-display text-sm font-semibold transition-colors duration-200 ${
                  selectedYear === y
                    ? "bg-brand-500 text-white"
                    : "text-ink-muted hover:bg-paper hover:text-ink"
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
          <span className="h-3 leading-3">{weekdayLabel(locale, 0)}</span>
          <span className="h-3 leading-3" aria-hidden />
          <span className="h-3 leading-3">{weekdayLabel(locale, 2)}</span>
          <span className="h-3 leading-3" aria-hidden />
          <span className="h-3 leading-3">{weekdayLabel(locale, 4)}</span>
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
                      className={`h-3 w-3 shrink-0 rounded-sm transition-all duration-150 ease-smooth motion-safe:hover:z-10 motion-safe:hover:scale-125 ${cellClasses(
                        level,
                        inY,
                        hasData,
                      )} ${inY ? "cursor-pointer hover:ring-2 hover:ring-brand-400/60 focus:outline-none focus:ring-2 focus:ring-brand-500" : "cursor-default"}`}
                      aria-label={
                        inY
                          ? t("calendar.cellLabel", { date: formatDisplayDate(date), count: sessions })
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
          className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lift motion-safe:animate-tooltip-in"
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
            {t("calendar.tooltipSessions", { count: hover.data.sessions })}
          </p>
          <p className="mt-1 text-slate-600">
            {t("calendar.tooltipTasks", {
              tasks: hover.data.tasks?.map((name) => taskName(t, name)).join(locale === "zh" ? "、" : ", ") || "—",
            })}
          </p>
          <p className="mt-1 text-slate-600">
            {t("calendar.tooltipTime", { minutes: hover.data.totalMinutes ?? "—" })}
          </p>
          <p className="mt-1 text-slate-600">
            {t("calendar.tooltipReports", { count: hover.data.reportsReady ?? 0 })}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>{t("calendar.legend")}</span>
        <div className="flex items-center gap-2">
          <span>{t("calendar.less")}</span>
          <div className="flex gap-1">
            <span className="h-3 w-3 rounded-sm bg-slate-100 ring-1 ring-slate-200/80" />
            <span className="h-3 w-3 rounded-sm bg-brand-200 ring-1 ring-brand-300/60" />
            <span className="h-3 w-3 rounded-sm bg-brand-400 ring-1 ring-brand-500/50" />
            <span className="h-3 w-3 rounded-sm bg-brand-600 ring-1 ring-brand-700/40" />
          </div>
          <span>{t("calendar.more")}</span>
        </div>
      </div>

      {/* Selected day summary */}
      {selectedKey && selectedKey.startsWith(`${selectedYear}-`) && (
        <div className="mt-5 rounded-md border border-line bg-paper p-4 motion-safe:animate-fade-in-up-fast">
          <p className="text-sm font-semibold text-slate-900">
            {formatDisplayDate(new Date(`${selectedKey}T12:00:00`))}
          </p>
          {(activityByDate[selectedKey]?.sessions ?? 0) === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              {t("calendar.emptyDay")}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {(activityByDate[selectedKey].records || []).map((rec, idx) => (
                <li
                  key={idx}
                  className="flex flex-col gap-2 rounded-md border border-line bg-white p-3 text-sm transition-colors duration-200 hover:border-brand-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">{taskName(t, rec.taskName)}</p>
                    <p className="text-slate-600">
                      {t("calendar.recordLine", {
                        score: rec.score != null ? `${rec.score}/100` : "—",
                        reliability: reliabilityLabel(t, rec.reliability),
                        status: reviewStatusLabel(t, rec.instructorStatus),
                      })}
                    </p>
                  </div>
                  <Link
                    to={{ pathname: "/report", search: reportSearch(rec.sessionId) }}
                    className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors duration-200 hover:bg-brand-600 active:scale-[0.98]"
                  >
                    {t("calendar.viewReport")}
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
