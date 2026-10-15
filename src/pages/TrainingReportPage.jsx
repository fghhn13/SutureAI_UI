import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, apiUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  AppealBadge,
  AppealForm,
  AppealsPanel,
  InstructorReviewPanel,
  PersonalNoteCard,
  ReviewResultCard,
  StudentResponseCard,
} from "../components/report/ReviewPanels.jsx";

function publicAssetUrl(path) {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${p}`;
}

/** Report media is either an API URL (uploaded video) or a static file under public/. */
function mediaUrl(path) {
  return path.startsWith("/api/") ? apiUrl(path) : publicAssetUrl(path);
}

function formatRecordedAt(report) {
  if (!report.recordedAt) return report.dateTime;
  const d = new Date(report.recordedAt);
  if (Number.isNaN(d.getTime())) return report.dateTime;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function defaultExpandedTimelineIds(timeline) {
  return new Set(
    timeline.filter((e) => e.type === "warning" || e.type === "error").map((e) => e.id),
  );
}

/** Parse labels like "0:02", "1:23", or "01:05:30" to seconds */
function parseTimeLabelToSeconds(label) {
  if (label == null) return 0;
  const s = String(label).trim();
  const parts = s.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function seekSecondsFromTimelineEvent(event) {
  if (typeof event.timeSeconds === "number" && !Number.isNaN(event.timeSeconds)) {
    return event.timeSeconds;
  }
  return parseTimeLabelToSeconds(event.time);
}

function seekSecondsFromClip(clip) {
  if (typeof clip.timeSeconds === "number" && !Number.isNaN(clip.timeSeconds)) {
    return clip.timeSeconds;
  }
  return parseTimeLabelToSeconds(clip.time);
}

function StatusBadge({ status }) {
  const reviewed = status === "Reviewed";
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        reviewed
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-amber-300 bg-amber-50 text-amber-700"
      }`}
    >
      {reviewed ? "✓ " : ""}
      {status}
    </span>
  );
}

function ScoreRing({ score }) {
  const degrees = Math.round((score / 100) * 360);
  return (
    <div
      className="flex h-32 w-32 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(#2e7cf6 ${degrees}deg, #dbeafe ${degrees}deg 360deg)`,
      }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white">
        <span className="text-3xl font-bold text-brand-700">{score}</span>
        <span className="text-xs text-slate-500">/100</span>
      </div>
    </div>
  );
}

function DimensionCard({ item }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">{item.name}</h3>
        <span
          className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700"
          title={item.metrics}
        >
          Metrics
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-2xl font-bold text-brand-700">{item.score}</p>
        <p className="text-xs text-slate-500">0 - 100</p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${item.score}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{item.explanation}</p>
    </article>
  );
}

function RadarChart({ dimensions }) {
  const size = 280;
  const center = size / 2;
  const maxRadius = 92;
  const levels = 4;
  const angleStep = (Math.PI * 2) / dimensions.length;

  const axisPoints = dimensions.map((_, index) => {
    const angle = -Math.PI / 2 + angleStep * index;
    return {
      x: center + Math.cos(angle) * maxRadius,
      y: center + Math.sin(angle) * maxRadius,
      angle,
    };
  });

  const levelPolygons = Array.from({ length: levels }, (_, levelIndex) => {
    const factor = (levelIndex + 1) / levels;
    return axisPoints
      .map((point) => {
        const x = center + (point.x - center) * factor;
        const y = center + (point.y - center) * factor;
        return `${x},${y}`;
      })
      .join(" ");
  });

  const scorePolygon = dimensions
    .map((dimension, index) => {
      const factor = dimension.score / 100;
      const point = axisPoints[index];
      const x = center + (point.x - center) * factor;
      const y = center + (point.y - center) * factor;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <article className="rounded-xl border border-brand-100 bg-brand-50/60 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        Five-Dimension Radar
      </h3>
      <p className="mt-1 text-xs text-slate-600">
        Auto-generated from current dimension scores.
      </p>
      <div className="mt-3 flex justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-72 w-full max-w-[320px]">
          {levelPolygons.map((polygon, index) => (
            <polygon
              key={`level-${index}`}
              points={polygon}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1"
            />
          ))}
          {axisPoints.map((point, index) => (
            <line
              key={`axis-${dimensions[index].name}`}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="#cbd5e1"
              strokeWidth="1"
            />
          ))}
          <polygon
            points={scorePolygon}
            fill="rgba(46, 124, 246, 0.25)"
            stroke="#2e7cf6"
            strokeWidth="2"
          />
          {dimensions.map((dimension, index) => {
            const factor = dimension.score / 100;
            const axis = axisPoints[index];
            const dotX = center + (axis.x - center) * factor;
            const dotY = center + (axis.y - center) * factor;
            const labelRadius = maxRadius + 18;
            const labelX = center + Math.cos(axis.angle) * labelRadius;
            const labelY = center + Math.sin(axis.angle) * labelRadius;
            return (
              <g key={`label-${dimension.name}`}>
                <circle cx={dotX} cy={dotY} r="3" fill="#1e66dc" />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-600 text-[10px]"
                >
                  {dimension.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
}

function TimelineItem({ event, expanded, onToggle, onSeekToSeconds, report, canAppeal, onUpdated }) {
  const [appealing, setAppealing] = useState(false);
  const colors = {
    normal: "bg-brand-500",
    warning: "bg-amber-500",
    error: "bg-rose-500",
  };
  const labels = {
    normal: "Step",
    warning: "Warning",
    error: "Issue",
  };

  return (
    <div className="relative pl-8">
      <span className="absolute left-[7px] top-8 h-full w-px bg-slate-200" />
      <span
        className={`absolute left-0 top-6 h-4 w-4 rounded-full border-2 border-white ${colors[event.type]}`}
      />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">{event.time}</p>
            <h4
              className={`text-sm font-semibold ${
                event.overturned ? "text-slate-400 line-through" : "text-slate-800"
              }`}
            >
              {event.title}
            </h4>
            {event.overturned ? (
              <p className="text-xs font-medium text-emerald-700">Overturned after the student's appeal</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {event.appeal ? <AppealBadge status={event.appeal.status} /> : null}
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {labels[event.type]}
            </span>
            {onSeekToSeconds ? (
              <button
                type="button"
                onClick={() => onSeekToSeconds(seekSecondsFromTimelineEvent(event))}
                className="rounded-md border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                {event.clip ? "Replay" : "Jump"}
              </button>
            ) : (
              event.clip && (
                <button
                  type="button"
                  className="rounded-md border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  View Clip
                </button>
              )
            )}
            <button
              onClick={onToggle}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
            {canAppeal && !appealing ? (
              <button
                type="button"
                onClick={() => setAppealing(true)}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Appeal
              </button>
            ) : null}
          </div>
        </div>
        {expanded && <p className="mt-3 text-sm text-slate-600">{event.detail}</p>}
        {appealing ? (
          <AppealForm
            report={report}
            eventId={event.id}
            onCancel={() => setAppealing(false)}
            onUpdated={(r) => {
              setAppealing(false);
              onUpdated(r);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function ClipCard({ clip, onReplay }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-700">{clip.time}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
          {clip.type}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-slate-800">{clip.label}</h4>
      <p className="mt-2 text-xs leading-5 text-slate-600">{clip.description}</p>
      <button
        type="button"
        onClick={() => onReplay?.()}
        disabled={!onReplay}
        className="mt-3 w-full rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Replay
      </button>
    </article>
  );
}

function AssessmentHighlightsCard({ highlights }) {
  const items = [
    {
      label: "Strongest Dimension",
      value: highlights.strongestDimension,
      valueClassName: "text-brand-700 font-semibold",
    },
    {
      label: "Main Issue",
      value: highlights.mainIssue,
      valueClassName: "text-rose-700 font-semibold",
    },
    {
      label: "Recommended Focus",
      value: highlights.practiceFocus,
      valueClassName: "text-indigo-700 font-semibold",
    },
    {
      label: "Evidence Clips Available",
      value: `${highlights.evidenceClipCount} linked segments`,
      valueClassName: "text-slate-900 font-semibold",
    },
    {
      label: "Review Status",
      value: highlights.reviewStatus,
      valueClassName: "text-amber-700 font-semibold",
    },
  ];

  return (
    <article className="surface-card surface-card-lift p-6">
      <h2 className="text-lg font-semibold text-slate-900">Assessment Highlights</h2>
      <p className="mt-1 text-sm text-slate-600">
        Compact summary of the most important report takeaways.
      </p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {item.label}
            </p>
            <p className={`mt-1 text-sm ${item.valueClassName || "font-medium text-slate-800"}`}>
              {item.value}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}

function StudentReportFeedbackReflectionSection({ data, onUpdated }) {
  return (
    <section className="mt-6 surface-card surface-card-lift p-6">
      <h2 className="text-lg font-semibold text-slate-900">Report Feedback & Reflection</h2>
      <p className="mt-1 text-sm text-slate-600">
        Structured educational workflow connecting AI-generated interpretation, instructor review, and student reflection.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-brand-100 bg-brand-50/70 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            AI Feedback
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Grounded in institutional rubric, benchmark database, cohort comparison, and evidence-linked performance metrics.
          </p>
          <div className="mt-3 rounded-md bg-white/80 px-4 py-3">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {data.aiFeedback.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <article className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 md:col-span-2">
              <h4 className="text-sm font-semibold text-emerald-800">Strengths</h4>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-emerald-900">
                {data.strengths.map((item) => (
                  <li key={item} className="rounded-md bg-white/80 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
              <h4 className="text-sm font-semibold text-rose-800">Areas for Improvement</h4>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-rose-900">
                {data.weaknesses.map((item) => (
                  <li key={item} className="rounded-md bg-white/80 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-lg border border-brand-200 bg-white/80 p-4">
              <h4 className="text-sm font-semibold text-brand-700">Recommended Next Steps</h4>
              <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                {data.suggestions.map((item) => (
                  <li key={item} className="rounded-md bg-brand-50 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </article>

        <div className="space-y-4 lg:col-span-1">
          <ReviewResultCard review={data.review} />
          {data.meta.canRespond ? (
            <>
              <StudentResponseCard report={data} onUpdated={onUpdated} />
              <PersonalNoteCard report={data} onUpdated={onUpdated} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function InstructorReportFeedbackSection({ data, onUpdated, onSeek }) {
  return (
    <section className="mt-6 surface-card surface-card-lift p-6">
      <h2 className="text-lg font-semibold text-slate-900">Report Feedback & Review</h2>
      <p className="mt-1 text-sm text-slate-600">
        The same AI-generated, evidence-linked report viewed through an instructor workflow.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-brand-100 bg-brand-50/70 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
            AI Feedback
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Grounded in institutional rubric, benchmark database, cohort comparison, and evidence-linked performance metrics.
          </p>
          <div className="mt-3 rounded-md bg-white/80 px-4 py-3">
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {data.aiFeedback.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>

        <AppealsPanel report={data} onUpdated={onUpdated} onSeek={onSeek} />
      </div>

      <div className="mt-4">
        <InstructorReviewPanel report={data} onUpdated={onUpdated} />
      </div>
    </section>
  );
}

function BackLink({ isStaff, report }) {
  if (!isStaff) {
    return (
      <Link to="/" className="link-brand text-sm font-medium">
        Student dashboard
      </Link>
    );
  }
  const studentId = report?.meta?.studentId;
  return (
    <Link
      to={studentId ? `/instructor/students/${studentId}` : "/instructor"}
      className="link-brand text-sm font-medium"
    >
      ← {studentId ? report.meta.studentName : "Instructor overview"}
    </Link>
  );
}

function TrainingReportPage() {
  const { user } = useAuth();
  const isStaff = user.role !== "student";
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRetryToken, setReportRetryToken] = useState(0);

  const [expanded, setExpanded] = useState(() => new Set());
  const [timelineSectionOpen, setTimelineSectionOpen] = useState(true);
  const [viewMode, setViewMode] = useState(isStaff ? "instructor" : "student");
  const evidenceVideoRef = useRef(null);

  const loadCatalog = useCallback(() => {
    setCatalogLoading(true);
    setCatalogError(null);
    const wanted = new URLSearchParams(window.location.search).get("session");
    // Instructors browse one student's reports: find whose report this is first.
    const listPath =
      isStaff && wanted
        ? api(`/reports/${encodeURIComponent(wanted)}`).then(
            (r) => `/reports?studentId=${r.meta.studentId}`,
          )
        : Promise.resolve(isStaff ? null : "/reports");
    listPath
      .then((path) => (path ? api(path) : []))
      .then((data) => {
        const items = data.map((item) => ({ id: item.sessionId, label: item.label }));
        setCatalog(items);
        const nextId =
          wanted && items.some((item) => item.id === wanted) ? wanted : items[0]?.id ?? "";
        setSelectedId(nextId);
      })
      .catch((err) => {
        setCatalogError(err instanceof Error ? err.message : "Failed to load catalog");
        setCatalog([]);
      })
      .finally(() => setCatalogLoading(false));
  }, [user?.id, isStaff]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const sessionParam = searchParams.get("session");
  useEffect(() => {
    if (sessionParam && catalog.some((item) => item.id === sessionParam)) {
      setSelectedId(sessionParam);
    }
  }, [sessionParam, catalog]);

  useEffect(() => {
    if (!selectedId) return undefined;

    let cancelled = false;
    setReportLoading(true);
    setReportError(null);

    api(`/reports/${encodeURIComponent(selectedId)}`)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setReportError(err instanceof Error ? err.message : "Failed to load report");
        }
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, reportRetryToken]);

  const selectReport = (id) => {
    setSelectedId(id);
    setSearchParams({ session: id }, { replace: true });
  };

  const reportKey = report?.meta?.sessionId ?? report?.recordedAt;
  useEffect(() => {
    if (!report?.timeline) return;
    setExpanded(defaultExpandedTimelineIds(report.timeline));
    setTimelineSectionOpen(true);
    // Only when a different report is opened, not on every update of this one.
  }, [reportKey]);

  const completionLabel = report?.completed ? "Completed" : "Incomplete";
  const completionStyles = report?.completed
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-rose-50 text-rose-700 border-rose-200";

  const toggleTimeline = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const avgDimension = useMemo(() => {
    if (!report?.dimensions?.length) return 0;
    const total = report.dimensions.reduce((sum, cur) => sum + cur.score, 0);
    return Math.round(total / report.dimensions.length);
  }, [report]);

  const evidenceSrc =
    report?.evidencePreviewUrl != null && report.evidencePreviewUrl !== ""
      ? mediaUrl(report.evidencePreviewUrl)
      : publicAssetUrl("picture/微信图片_20260421160900_112_99.png");

  const evidenceVideoUrl =
    report?.evidenceVideoUrl != null && String(report.evidenceVideoUrl).trim() !== ""
      ? mediaUrl(String(report.evidenceVideoUrl))
      : null;

  const seekEvidenceVideoToSeconds = (seconds) => {
    const el = evidenceVideoRef.current;
    if (!el || typeof seconds !== "number" || Number.isNaN(seconds)) return;
    el.currentTime = Math.max(0, seconds);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.play().catch(() => {});
  };

  if (catalogLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-600 md:px-8">
        <div className="mb-6 text-left">
          <BackLink isStaff={isStaff} report={report} />
        </div>
        Loading reports…
      </main>
    );
  }

  if (catalogError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-6">
          <BackLink isStaff={isStaff} report={report} />
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <p className="font-semibold">Could not load report catalog</p>
          <p className="mt-2 text-sm">{catalogError}</p>
          <button
            type="button"
            onClick={loadCatalog}
            className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!catalogLoading && !catalogError && catalog.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-6">
          <BackLink isStaff={isStaff} report={report} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-700 shadow-soft">
          <p className="font-semibold text-slate-900">No reports available</p>
          {isStaff ? (
            <p className="mt-2 text-sm">
              Open a report from the{" "}
              <Link to="/instructor/reviews" className="link-brand">
                review queue
              </Link>{" "}
              or a student's page.
            </p>
          ) : (
            <p className="mt-2 text-sm">
              You don't have any finished reports yet.{" "}
              <Link to="/train" className="link-brand">
                Record a training session
              </Link>{" "}
              to get your first one.
            </p>
          )}
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-4">
          <BackLink isStaff={isStaff} report={report} />
        </div>
        <header className="surface-card surface-card-lift p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Training session
              </span>
              <select
                value={selectedId}
                onChange={(e) => selectReport(e.target.value)}
                className="min-w-[240px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800"
              >
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        {reportError ? (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
            <p className="font-semibold">Could not load this report</p>
            <p className="mt-2 text-sm">{reportError}</p>
            <button
              type="button"
              onClick={() => setReportRetryToken((t) => t + 1)}
              className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <p className="mt-10 text-center text-slate-600">Loading report…</p>
        )}
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-4">
        <BackLink isStaff={isStaff} report={report} />
      </div>
      {reportError ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-semibold">Could not refresh report.</span>{" "}
          <span className="text-amber-900">{reportError}</span>
          <button
            type="button"
            onClick={() => setReportRetryToken((t) => t + 1)}
            className="ml-3 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      ) : null}
      {reportLoading ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-24 text-sm font-medium text-slate-600">
          Updating report…
        </div>
      ) : null}

      <header className="surface-card surface-card-lift p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-700">
              {report.productName}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{report.reportTitle}</h1>
            <p className="mt-2 text-sm text-slate-600">{report.task}</p>
          </div>
          <StatusBadge status={report.status} />
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="font-medium text-slate-800">Student: </span>
            {report.student}
          </p>
          <p>
            <span className="font-medium text-slate-800">Date & Time: </span>
            {formatRecordedAt(report)}
          </p>
          <p>
            <span className="font-medium text-slate-800">Task Duration: </span>
            {report.duration}
          </p>
          <p>
            <span className="font-medium text-slate-800">Confidence: </span>
            {report.reliability}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Session
            <select
              value={selectedId}
              onChange={(e) => selectReport(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium normal-case text-slate-800"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              window.open(
                `${import.meta.env.BASE_URL.replace(/\/$/, "")}/report/print?session=${encodeURIComponent(selectedId)}&autoprint=1`,
                "_blank",
              )
            }
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export PDF
          </button>
          {isStaff ? (
            <>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">View</span>
              {[
                ["instructor", "Instructor"],
                ["student", "As student sees it"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === mode
                      ? "bg-brand-600 text-white"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </>
          ) : null}
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="surface-card surface-card-lift p-6 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-500">Overall Performance</p>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <ScoreRing score={report.overallScore} />
            <div className="flex-1">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="font-medium text-slate-800">Reliability: </span>
                  {report.reliability}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Change vs Last: </span>
                  <span
                    className={`font-semibold ${
                      String(report.delta).startsWith("-")
                        ? "text-rose-600"
                        : String(report.delta).startsWith("+")
                          ? "text-emerald-600"
                          : "text-slate-600"
                    }`}
                  >
                    {report.delta}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-slate-800">Duration: </span>
                  {report.duration}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Dimension Avg: </span>
                  {avgDimension}
                </p>
              </div>
              {report.scores && (report.scores.current !== report.scores.ai || report.scores.confirmedByInstructor) ? (
                <p className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                  <span className="font-semibold">Current score {report.scores.current}</span>
                  <span className="text-indigo-700">
                    {" "}
                    (AI {report.scores.ai}
                    {report.scores.appealAdjustment
                      ? `, ${report.scores.appealAdjustment > 0 ? "+" : ""}${report.scores.appealAdjustment} from accepted appeals`
                      : ""}
                    {report.scores.confirmedByInstructor ? ", confirmed by your instructor" : ""})
                  </span>
                </p>
              ) : null}
              <span
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${completionStyles}`}
              >
                {completionLabel}
              </span>
              <p className="mt-3 text-sm leading-6 text-slate-700">{report.summary}</p>
            </div>
          </div>
        </article>

        <article className="surface-card surface-card-lift p-6">
          <h2 className="text-sm font-semibold text-slate-500">Confidence Notice</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {report.uncertainty.map((item, index) => (
              <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-amber-700">
                  {index === 0 ? `${report.reliability}: ` : "Caution: "}
                </span>
                <span className="text-slate-700">{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Dimension Scores</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <RadarChart dimensions={report.dimensions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
            {report.dimensions.map((item) => (
              <DimensionCard key={item.name} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <article className="surface-card surface-card-lift p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900">Training Timeline</h2>
              <p className="mt-1 text-sm text-slate-600">
                AI-detected steps, warnings, and evidence-linked events.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTimelineSectionOpen((open) => !open)}
              aria-expanded={timelineSectionOpen}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {timelineSectionOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {timelineSectionOpen ? (
            <div className="mt-4 space-y-4">
              {report.timeline.map((event) => (
                <TimelineItem
                  key={event.id}
                  event={event}
                  expanded={expanded.has(event.id)}
                  onToggle={() => toggleTimeline(event.id)}
                  onSeekToSeconds={evidenceVideoUrl ? seekEvidenceVideoToSeconds : undefined}
                  report={report}
                  canAppeal={
                    Boolean(report.meta?.canRespond) &&
                    (event.type === "warning" || event.type === "error") &&
                    !event.appeal &&
                    (report.appeals?.length ?? 0) < (report.meta?.maxAppeals ?? 5)
                  }
                  onUpdated={setReport}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {report.timeline.length} events hidden — expand to review the timeline.
            </p>
          )}
        </article>

        <aside className="space-y-6">
          <AssessmentHighlightsCard highlights={report.assessmentHighlights} />
        </aside>
      </section>

      <section className="mt-6 surface-card surface-card-lift p-6">
        <h2 className="text-lg font-semibold text-slate-900">Evidence Replay · Key Clips</h2>
        <p className="mt-1 text-sm text-slate-600">
          {evidenceVideoUrl
            ? "Use timeline or clip cards to jump to the matching moment in the recording."
            : "Static preview image for this session."}
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <div className="overflow-hidden rounded-xl border border-brand-200 bg-slate-100">
              {evidenceVideoUrl ? (
                <video
                  key={selectedId}
                  ref={evidenceVideoRef}
                  className="h-72 w-full bg-black object-contain md:h-80 lg:h-96"
                  controls
                  playsInline
                  preload="metadata"
                  poster={evidenceSrc}
                  src={evidenceVideoUrl}
                >
                  Your browser does not support embedded video.
                </video>
              ) : (
                <img
                  src={evidenceSrc}
                  alt="Evidence replay preview"
                  className="h-72 md:h-80 lg:h-96 w-full object-contain"
                />
              )}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {report.clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onReplay={
                  evidenceVideoUrl
                    ? () => seekEvidenceVideoToSeconds(seekSecondsFromClip(clip))
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </section>

      {isStaff && viewMode === "instructor" ? (
        <InstructorReportFeedbackSection
          data={report}
          onUpdated={setReport}
          onSeek={evidenceVideoUrl ? seekEvidenceVideoToSeconds : undefined}
        />
      ) : (
        <StudentReportFeedbackReflectionSection
          data={isStaff ? { ...report, review: report.review?.status === "completed" ? report.review : null } : report}
          onUpdated={setReport}
        />
      )}
    </main>
  );
}

export default TrainingReportPage;
