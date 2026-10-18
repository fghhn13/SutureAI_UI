import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  Clapperboard,
  Crosshair,
  Download,
  Flag,
  Gauge,
  Hourglass,
  Play,
  ShieldCheck,
  ShieldPlus,
  Sparkles,
  Target,
  Timer,
  TriangleAlert,
  User,
  Workflow,
} from "lucide-react";
import IconBadge from "../components/icons/IconBadge.jsx";
import { StitchIcon } from "../components/icons/DomainIcons.jsx";
import SutureLine from "../components/decor/SutureLine.jsx";
import { CountUp, EASE, GrowBar, Reveal, Stagger, StaggerItem } from "../components/motion/index.jsx";
import { api, apiUrl } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import LanguageSwitch from "../components/LanguageSwitch.jsx";
import {
  clipTypeLabel,
  formatDate,
  formatDateTime,
  reliabilityLabel,
  reportStatusLabel,
  taskName,
  useI18n,
} from "../i18n/index.js";
import {
  AppealBadge,
  AppealForm,
  AppealsPanel,
  InstructorReviewPanel,
  PersonalNoteCard,
  ReviewResultCard,
  StudentResponseCard,
} from "../components/report/ReviewPanels.jsx";
import {
  FocusCard,
  PointsLostCard,
  ProgressCard,
  TimeChips,
  TimelineStrip,
} from "../components/report/FocusPanels.jsx";

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

function formatRecordedAt(report, locale) {
  return formatDateTime(report.recordedAt, undefined, locale, report.dateTime);
}

/** Session picker text, built client-side so the task name and date follow the locale. */
function sessionOptionLabel(t, locale, item) {
  if (!item.recordedAt) return item.label;
  return t("report.sessionOption", {
    task: taskName(t, item.taskName),
    date: formatDate(item.recordedAt, undefined, locale, ""),
    score: item.score,
  });
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

/** "~2 min (includes interrupted segment)" -> "~2 min"; the qualifier goes to a tooltip. */
function shortDuration(text) {
  if (!text) return text;
  return String(text).replace(/\s*[(（][^()（）]*[)）]\s*$/, "") || text;
}

function StatusBadge({ status }) {
  const { t } = useI18n();
  // "Reviewed" and "Reviewed by <name>" both count as reviewed.
  const reviewed = /^Reviewed\b/.test(status ?? "");
  const Icon = reviewed ? BadgeCheck : Hourglass;
  return (
    <span
      title={reportStatusLabel(t, status)}
      className={`stamp motion-safe:animate-stamp ${
        reviewed ? "border-good text-good outline-good/50" : "border-warn text-warn outline-warn/50"
      }`}
    >
      <Icon size={13} strokeWidth={2} />
      {reviewed ? t("report.statusBadge.stampReviewed") : t("report.statusBadge.stampPending")}
    </span>
  );
}

/** Overall score: a gradient arc that sweeps to the score while the number counts up. */
function ScoreRing({ score }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-36 w-36 shrink-0">
      <svg viewBox="0 0 128 128" className="relative h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} stroke="#ebe6dc" strokeWidth="7" fill="none" />
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          stroke="#4f69c2"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: EASE, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={score} duration={1.4} delay={0.15} className="font-display text-4xl font-bold text-brand-800" />
        <span className="text-xs text-ink-muted">/ 100</span>
      </div>
    </div>
  );
}

// Report dimensions arrive localized and without keys, always in this order.
const DIMENSION_ICONS = [Gauge, Crosshair, Workflow, ShieldPlus, StitchIcon];

function DimensionCard({ item, index }) {
  const { t } = useI18n();
  const Icon = DIMENSION_ICONS[index] ?? Sparkles;
  return (
    <article className="surface-card surface-card-lift group h-full p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={Icon} size="sm" />
        <h3 className="flex-1 font-display text-base font-semibold text-brand-800">{item.name}</h3>
        <span className="chip border-brand-200 text-brand-600" title={item.metrics}>
          {t("report.metrics")}
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between">
        <CountUp value={item.score} delay={0.1 * index} className="font-display text-3xl font-bold text-brand-700" />
        <p className="text-xs text-ink-muted">0 – 100</p>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#ebe6dc]">
        <GrowBar
          percent={item.score}
          delay={0.1 * index}
          className="h-full rounded-full bg-brand-500"
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-muted">{item.explanation}</p>
    </article>
  );
}

function RadarChart({ dimensions }) {
  const { t } = useI18n();
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
    <article className="glass-card h-full p-5">
      <p className="pill-header">{t("report.radar.title")}</p>
      <p className="mt-2 text-xs text-ink-muted">{t("report.radar.subtitle")}</p>
      <div className="mt-3 flex justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-72 w-full max-w-[320px]">
          {levelPolygons.map((polygon, index) => (
            <polygon
              key={`level-${index}`}
              points={polygon}
              fill="none"
              stroke="#e3ddd0"
              strokeWidth="1"
              strokeDasharray={index === levels - 1 ? undefined : "3 3"}
            />
          ))}
          {axisPoints.map((point, index) => (
            <line
              key={`axis-${dimensions[index].name}`}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="#e3ddd0"
              strokeWidth="1"
            />
          ))}
          {/* Grows out from the centre the first time the chart is seen. */}
          <motion.polygon
            points={scorePolygon}
            fill="rgba(79, 105, 194, 0.1)"
            stroke="#4f69c2"
            strokeWidth="1.5"
            strokeLinejoin="round"
            style={{ transformOrigin: `${center}px ${center}px`, transformBox: "view-box" }}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, ease: EASE }}
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
                <motion.circle
                  cx={dotX}
                  cy={dotY}
                  r="3.5"
                  fill="#fff"
                  stroke="#4f69c2"
                  strokeWidth="1.5"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 + index * 0.08 }}
                />
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-ink-soft text-[10px] font-medium"
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

const EVENT_STYLE = {
  normal: { dot: "border-brand-300 bg-white", chip: "border-brand-200 text-brand-600" },
  warning: { dot: "border-warn bg-warn/25", chip: "border-warn/50 text-warn" },
  error: { dot: "border-bad bg-bad", chip: "border-bad/50 text-bad" },
};

function TimelineItem({ event, expanded, onToggle, onSeekToSeconds, report, canAppeal, onUpdated }) {
  const { t } = useI18n();
  const [appealing, setAppealing] = useState(false);
  const style = EVENT_STYLE[event.type] ?? EVENT_STYLE.normal;
  return (
    <div className="relative pl-7">
      <span className="absolute left-[5px] top-9 h-[calc(100%-1.25rem)] w-px bg-line" />
      <span className={`absolute left-0 top-[1.15rem] h-[11px] w-[11px] rounded-full border-[1.5px] ${style.dot}`} />
      <div className="rounded-md border border-line bg-white p-4 transition-colors duration-300 hover:border-mist">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs font-semibold text-brand-600">{event.time}</p>
            <h4
              className={`mt-0.5 font-display text-base font-semibold ${
                event.overturned ? "text-ink-muted line-through" : "text-brand-800"
              }`}
            >
              {event.title}
            </h4>
            {event.overturned ? (
              <p className="text-xs font-medium text-good">{t("report.timelineSection.overturned")}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {event.appeal ? <AppealBadge status={event.appeal.status} /> : null}
            <span className={`chip ${style.chip}`}>
              {t(`report.eventType.${event.type}`, { defaultValue: event.type })}
            </span>
            {onSeekToSeconds ? (
              <button
                type="button"
                onClick={() => onSeekToSeconds(seekSecondsFromTimelineEvent(event))}
                className="btn-ghost"
              >
                <Play size={12} strokeWidth={2.5} />
                {event.clip ? t("report.timelineSection.replay") : t("report.timelineSection.jump")}
              </button>
            ) : (
              event.clip && (
                <button type="button" className="btn-ghost">
                  <Clapperboard size={12} strokeWidth={2.25} />
                  {t("report.timelineSection.viewClip")}
                </button>
              )
            )}
            <button
              onClick={onToggle}
              aria-expanded={expanded}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {expanded ? t("report.timelineSection.collapse") : t("report.timelineSection.expand")}
              <ChevronDown
                size={13}
                strokeWidth={2.25}
                className={`transition-transform duration-300 ease-smooth ${expanded ? "rotate-180" : ""}`}
              />
            </button>
            {canAppeal && !appealing ? (
              <button
                type="button"
                onClick={() => setAppealing(true)}
                className="inline-flex items-center gap-1 border-b border-transparent text-xs font-semibold text-warn transition-colors hover:border-current"
              >
                <Flag size={12} strokeWidth={2.25} />
                {t("report.appeal")}
              </button>
            ) : null}
          </div>
        </div>
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="detail"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="overflow-hidden"
            >
              <p className="pt-3 text-sm leading-6 text-ink-soft">{event.detail}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>
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
  const { t } = useI18n();
  return (
    <article className="tile-dashed group flex h-full flex-col transition-colors duration-300 hover:border-solid hover:border-brand-400 hover:bg-white">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-brand-600">{clip.time}</span>
        <span className="chip border-brand-200 text-brand-600">
          {clipTypeLabel(t, clip.type)}
        </span>
      </div>
      <h4 className="font-display text-base font-semibold text-brand-800">{clip.label}</h4>
      <p className="mt-1.5 flex-1 text-xs leading-5 text-ink-muted">{clip.description}</p>
      <button
        type="button"
        onClick={() => onReplay?.()}
        disabled={!onReplay}
        className="btn-primary mt-3 inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Play size={13} strokeWidth={2.5} className="transition-transform duration-300 group-hover:scale-110" />
        {t("report.timelineSection.replay")}
      </button>
    </article>
  );
}

function AssessmentHighlightsCard({ highlights }) {
  const { t, plural } = useI18n();
  const items = [
    {
      label: t("report.highlights.strongest"),
      value: highlights.strongestDimension,
      icon: Sparkles,
      tone: "brand",
      valueClassName: "text-brand-700",
    },
    {
      label: t("report.highlights.mainIssue"),
      value: highlights.mainIssue,
      icon: CircleAlert,
      tone: "bad",
      valueClassName: "text-bad",
    },
    {
      label: t("report.highlights.focus"),
      value: highlights.practiceFocus,
      icon: Target,
      tone: "soft",
      valueClassName: "text-brand-800",
    },
    {
      label: t("report.highlights.clips"),
      value: plural("report.highlights.clipsValue", highlights.evidenceClipCount),
      icon: Clapperboard,
      tone: "soft",
      valueClassName: "text-ink",
    },
    {
      label: t("report.highlights.reviewStatus"),
      value: reportStatusLabel(t, highlights.reviewStatus),
      icon: ShieldCheck,
      tone: "warn",
      valueClassName: "text-warn",
    },
  ];

  return (
    <article className="glass-card h-full p-6">
      <h2 className="section-title">{t("report.highlights.title")}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("report.highlights.subtitle")}</p>
      <Stagger as="ul" className="mt-3">
        {items.map((item) => (
          <StaggerItem
            as="li"
            key={item.label}
            className="flex items-start gap-3 border-b border-line py-3 last:border-0"
          >
            <IconBadge icon={item.icon} tone={item.tone} size="sm" />
            <div className="min-w-0">
              <p className="eyebrow">{item.label}</p>
              <p className={`mt-0.5 text-sm font-semibold ${item.valueClassName}`}>{item.value}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </article>
  );
}

function AiFeedbackList({ items }) {
  return (
    <ul className="mt-2 text-sm leading-6 text-ink-soft">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 border-b border-brand-100 py-2.5 last:border-0">
          <Sparkles size={14} strokeWidth={1.5} className="mt-1 shrink-0 text-brand-400" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StudentReportFeedbackReflectionSection({ data, onUpdated, onSeek }) {
  const { t } = useI18n();
  return (
    <Reveal as="section" className="glass-card mt-8 p-6">
      <h2 className="section-title"><span className="section-num">05</span>{t("report.feedback.titleStudent")}</h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <article className="tile-blue p-5">
            <p className="pill-header">{t("report.feedback.aiFeedback")}</p>
            <AiFeedbackList items={data.aiFeedback} />
          </article>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="tile md:col-span-2">
              <h4 className="tile-title is-good">{t("report.feedback.strengths")}</h4>
              <ul className="mt-2 text-sm leading-6 text-ink-soft">
                {data.strengths.map((item) => (
                  <li key={item} className="border-b border-[#e4dfd5] py-2 last:border-0">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="tile">
              <h4 className="tile-title is-bad">{t("report.feedback.improvements")}</h4>
              <ul className="mt-2 text-sm leading-6 text-ink-soft">
                {data.weaknesses.map((item) => (
                  <li key={item} className="border-b border-[#e4dfd5] py-2 last:border-0">
                    {item}
                  </li>
                ))}
              </ul>
            </article>

            <article className="tile-dashed">
              <h4 className="tile-title">{t("report.feedback.nextSteps")}</h4>
              <ul className="mt-2 text-sm leading-6 text-ink-soft">
                {(data.suggestionDetails ?? data.suggestions.map((text) => ({ text, times: [] }))).map((item) => (
                  <li key={item.text} className="border-b border-[#e4dfd5] py-2 last:border-0">
                    {item.text}
                    {item.times?.length ? <TimeChips times={item.times} onSeek={onSeek} className="ml-2" /> : null}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>

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
    </Reveal>
  );
}

function InstructorReportFeedbackSection({ data, onUpdated, onSeek }) {
  const { t } = useI18n();
  return (
    <Reveal as="section" className="glass-card mt-8 p-6">
      <h2 className="section-title"><span className="section-num">05</span>{t("report.feedback.titleInstructor")}</h2>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <article className="tile-blue p-5 lg:col-span-2">
          <p className="pill-header">{t("report.feedback.aiFeedback")}</p>
          <AiFeedbackList items={data.aiFeedback} />
        </article>

        <AppealsPanel report={data} onUpdated={onUpdated} onSeek={onSeek} />
      </div>

      <div className="mt-4">
        <InstructorReviewPanel report={data} onUpdated={onUpdated} />
      </div>
    </Reveal>
  );
}

function BackLink({ isStaff, report }) {
  const { t } = useI18n();
  const className =
    "group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700";
  const arrow = (
    <ArrowLeft size={15} strokeWidth={2.25} className="transition-transform duration-300 ease-smooth group-hover:-translate-x-0.5" />
  );
  if (!isStaff) {
    return (
      <Link to="/" className={className}>
        {arrow}
        {t("report.back.student")}
      </Link>
    );
  }
  const studentId = report?.meta?.studentId;
  return (
    <Link to={studentId ? `/instructor/students/${studentId}` : "/instructor"} className={className}>
      {arrow}
      {studentId ? report.meta.studentName : t("report.back.instructorOverview")}
    </Link>
  );
}

/** Placeholder with the report's rough shape while it loads. */
function ReportSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <div className="skeleton h-48" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="skeleton h-56 lg:col-span-2" />
        <div className="skeleton h-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-36" />
        <div className="skeleton h-36" />
        <div className="skeleton h-36" />
      </div>
    </div>
  );
}

function TrainingReportPage() {
  const { user } = useAuth();
  const { t, plural, locale } = useI18n();
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
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [videoDuration, setVideoDuration] = useState(null);
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
        const items = data.map((item) => ({
          id: item.sessionId,
          label: item.label,
          taskName: item.taskName,
          recordedAt: item.recordedAt,
          score: item.overallScore,
        }));
        setCatalog(items);
        const nextId =
          wanted && items.some((item) => item.id === wanted) ? wanted : items[0]?.id ?? "";
        setSelectedId(nextId);
      })
      .catch((err) => {
        setCatalogError(err instanceof Error ? err.message : t("report.catalogFailedFallback"));
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
          setReportError(err instanceof Error ? err.message : t("report.loadFailedFallback"));
        }
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Refetch on language change: the server returns report text in the requested language.
  }, [selectedId, reportRetryToken, locale]);

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

  const flaggedCount = report?.timeline?.filter((e) => e.type !== "normal").length ?? 0;
  // Normal steps are hidden by default so the problems stand out (all shown if none flagged).
  const visibleTimeline =
    !report?.timeline || showAllEvents || !flaggedCount
      ? report?.timeline ?? []
      : report.timeline.filter((e) => e.type !== "normal");

  const completionLabel = report?.completed ? t("report.overall.completed") : t("report.overall.incomplete");
  const completionStyles = report?.completed
    ? "border-good/50 text-good"
    : "border-bad/50 text-bad";

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
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-4">
          <BackLink isStaff={isStaff} report={report} />
        </div>
        <p className="sr-only" role="status">{t("report.loadingReports")}</p>
        <ReportSkeleton />
      </main>
    );
  }

  if (catalogError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-6">
          <BackLink isStaff={isStaff} report={report} />
        </div>
        <div className="rounded-md border border-line border-l-2 border-l-bad bg-white p-6 text-ink">
          <p className="font-semibold">{t("report.catalogFailed")}</p>
          <p className="mt-2 text-sm">{catalogError}</p>
          <button
            type="button"
            onClick={loadCatalog}
            className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            {t("common.retry")}
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
        <div className="glass-card p-8 text-ink-soft">
          <IconBadge icon={StitchIcon} size="lg" className="mb-4" />
          <p className="font-display text-lg font-semibold text-brand-800">{t("report.noReports")}</p>
          {isStaff ? (
            <p className="mt-2 text-sm">
              {t("report.noReportsStaff.before")}
              <Link to="/instructor/reviews" className="link-brand">
                {t("report.noReportsStaff.link")}
              </Link>
              {t("report.noReportsStaff.after")}
            </p>
          ) : (
            <p className="mt-2 text-sm">
              {t("report.noReportsStudent.before")}
              <Link to="/train" className="link-brand">
                {t("report.noReportsStudent.link")}
              </Link>
              {t("report.noReportsStudent.after")}
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
        <header className="glass-card p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="eyebrow">{t("report.trainingSession")}</span>
              <select
                value={selectedId}
                onChange={(e) => selectReport(e.target.value)}
                className="field-select min-w-[240px] py-2"
              >
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {sessionOptionLabel(t, locale, item)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>
        {reportError ? (
          <div className="mt-8 rounded-md border border-line border-l-2 border-l-bad bg-white p-6 text-ink">
            <p className="font-semibold">{t("report.loadFailed")}</p>
            <p className="mt-2 text-sm">{reportError}</p>
            <button
              type="button"
              onClick={() => setReportRetryToken((t) => t + 1)}
              className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <p className="sr-only" role="status">{t("report.loading")}</p>
            <ReportSkeleton />
          </div>
        )}
      </main>
    );
  }

  const headerMeta = [
    { icon: User, label: t("report.header.student"), value: report.student },
    { icon: CalendarClock, label: t("report.header.dateTime"), value: formatRecordedAt(report, locale) },
    { icon: Timer, label: t("report.header.taskDuration"), value: shortDuration(report.duration), title: report.duration },
    { icon: ShieldCheck, label: t("report.header.confidence"), value: reliabilityLabel(t, report.reliability) },
  ];
  const deltaText = String(report.delta);
  const deltaClass = deltaText.startsWith("-")
    ? "text-bad"
    : deltaText.startsWith("+")
      ? "text-good"
      : "text-ink-muted";
  const overallStats = [
    { label: t("report.overall.reliability"), value: reliabilityLabel(t, report.reliability) },
    { label: t("report.overall.change"), value: report.delta, className: deltaClass },
    { label: t("report.overall.duration"), value: shortDuration(report.duration), title: report.duration },
    { label: t("report.overall.dimensionAvg"), value: avgDimension },
  ];

  return (
    <main className="relative mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-4">
        <BackLink isStaff={isStaff} report={report} />
      </div>
      {reportError ? (
        <div className="mb-4 rounded-md border border-line border-l-2 border-l-warn bg-white px-4 py-3 text-sm text-ink">
          <span className="font-semibold">{t("report.refreshFailed")}</span>{" "}
          <span className="text-ink-soft">{reportError}</span>
          <button
            type="button"
            onClick={() => setReportRetryToken((t) => t + 1)}
            className="btn-ghost ml-3"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}
      <AnimatePresence>
        {reportLoading ? (
          <motion.div
            key="updating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-paper/60 pt-24"
          >
            <span className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sheet">
              {t("report.updating")}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Hero: deck-style title with the stitched-incision ornament on the right. */}
      <Reveal as="header" y={12} className="glass-card overflow-hidden p-6 md:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-md bg-brand-500" />
        <SutureLine className="pointer-events-none absolute right-4 top-[5.5rem] hidden w-72 md:block" />
        <p className="pill-header relative">{report.productName}</p>
        <div className="relative mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="title-display text-3xl md:text-4xl">{report.reportTitle}</h1>
            <p className="mt-1.5 text-sm font-medium text-ink-muted">{report.task}</p>
          </div>
          <StatusBadge status={report.status} />
        </div>
        <Stagger className="relative mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4" delay={0.15}>
          {headerMeta.map((m) => (
            <StaggerItem
              key={m.label}
              className="flex items-center gap-3 border-t border-line pt-3"
            >
              <IconBadge icon={m.icon} tone="soft" size="sm" />
              <div className="min-w-0">
                <p className="eyebrow">{m.label.replace(/[:：]\s*$/, "")}</p>
                <p className="text-sm font-semibold leading-snug text-ink" title={m.title}>
                  {m.value}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <label className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{t("report.session")}</span>
            <select
              value={selectedId}
              onChange={(e) => selectReport(e.target.value)}
              className="field-select"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {sessionOptionLabel(t, locale, item)}
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
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            <Download size={14} strokeWidth={2.25} />
            {t("report.exportPdf")}
          </button>
          <LanguageSwitch />
          {isStaff ? (
            <div className="flex items-center gap-2">
              <span className="eyebrow">{t("report.view")}</span>
              {/* Segmented control; the active pill slides between options. */}
              <div className="relative flex rounded-md border border-line bg-paper p-0.5">
                {[
                  ["instructor", t("report.viewModes.instructor")],
                  ["student", t("report.viewModes.student")],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    aria-pressed={viewMode === mode}
                    className={`relative rounded px-3 py-1 text-xs font-semibold transition-colors ${
                      viewMode === mode ? "text-white" : "text-ink-soft hover:text-brand-700"
                    }`}
                  >
                    {viewMode === mode ? (
                      <motion.span
                        layoutId="view-mode-pill"
                        className="absolute inset-0 rounded bg-brand-500"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    ) : null}
                    <span className="relative">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <FocusCard focus={report.focus} onSeek={evidenceVideoUrl ? seekEvidenceVideoToSeconds : undefined} />
      </Reveal>

      <Stagger as="section" className="mt-6 grid gap-4 lg:grid-cols-3" delay={0.1}>
        <StaggerItem as="article" className="glass-card p-6 lg:col-span-2">
          <p className="pill-header"><span className="section-num">01</span>{t("report.overall.title")}</p>
          <div className="mt-5 flex flex-wrap items-center gap-8">
            <ScoreRing score={report.overallScore} />
            <div className="min-w-[16rem] flex-1">
              <ul className="grid gap-x-8 sm:grid-cols-2">
                {overallStats.map((s) => (
                  <li key={s.label} className="leader">
                    <span className="text-ink-muted">{s.label.replace(/[:：]\s*$/, "")}</span>
                    <span
                      className={`font-display text-base font-semibold ${s.className ?? "text-brand-800"}`}
                      title={s.title}
                    >
                      {s.value}
                    </span>
                  </li>
                ))}
              </ul>
              {report.scores && (report.scores.current !== report.scores.ai || report.scores.confirmedByInstructor) ? (
                <p className="tile-blue mt-3 px-3 py-2 text-sm text-brand-800">
                  <span className="font-semibold">
                    {t("report.overall.currentScore", { score: report.scores.current })}
                  </span>
                  <span className="text-brand-700">
                    {t("report.overall.details", {
                      details: [
                        t("report.overall.aiPart", { score: report.scores.ai }),
                        report.scores.appealAdjustment
                          ? t("report.overall.appealPart", {
                              value: `${report.scores.appealAdjustment > 0 ? "+" : ""}${report.scores.appealAdjustment}`,
                            })
                          : null,
                        report.scores.confirmedByInstructor ? t("report.overall.confirmedPart") : null,
                      ]
                        .filter(Boolean)
                        .join(t("report.overall.detailSeparator")),
                    })}
                  </span>
                </p>
              ) : null}
              <span className={`chip mt-3 ${completionStyles}`}>
                {report.completed ? <BadgeCheck size={13} strokeWidth={2.25} /> : <CircleAlert size={13} strokeWidth={2.25} />}
                {completionLabel}
              </span>
              <p className="mt-3 text-sm leading-6 text-ink-soft">{report.summary}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem as="article" className="glass-card p-6">
          <p className="pill-header">{t("report.notice.title")}</p>
          <ul className="mt-4 space-y-3 text-sm leading-6">
            {report.uncertainty.map((item, index) => (
              <li
                key={item}
                className="tile flex gap-3 px-3 py-2.5"
              >
                <TriangleAlert size={15} strokeWidth={1.75} className="mt-1 shrink-0 text-warn" />
                <span>
                  <span className="font-semibold text-warn-700">
                    {index === 0
                      ? t("report.notice.levelPrefix", { level: reliabilityLabel(t, report.reliability) })
                      : t("report.notice.caution")}
                  </span>
                  <span className="text-ink-soft">{item}</span>
                </span>
              </li>
            ))}
          </ul>
        </StaggerItem>
      </Stagger>

      {report.pointsLost?.length || report.changes?.length || report.keyMetrics?.length ? (
        <Reveal as="section" className="mt-6 grid gap-4 lg:grid-cols-2">
          <PointsLostCard
            items={report.pointsLost}
            total={100 - report.overallScore}
            onSeek={evidenceVideoUrl ? seekEvidenceVideoToSeconds : undefined}
          />
          <ProgressCard changes={report.changes} metrics={report.keyMetrics} />
        </Reveal>
      ) : null}

      <section className="mt-8">
        <h2 className="section-title mb-4"><span className="section-num">02</span>{t("report.dimensionScores")}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal>
            <RadarChart dimensions={report.dimensions} />
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
            {report.dimensions.map((item, index) => (
              <StaggerItem key={item.name}>
                <DimensionCard item={item} index={index} />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <Reveal as="article" className="glass-card p-6 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="section-title"><span className="section-num">03</span>{t("report.timelineSection.title")}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {showAllEvents || !flaggedCount
                  ? plural("report.timelineSection.allEvents", report.timeline.length)
                  : t("report.timelineSection.flaggedSummary", {
                      flagged: plural("report.timelineSection.flaggedPart", flaggedCount),
                      hidden: plural("report.timelineSection.hiddenPart", report.timeline.length - flaggedCount),
                    })}
              </p>
            </div>
            {flaggedCount && flaggedCount < report.timeline.length ? (
              <button
                type="button"
                onClick={() => setShowAllEvents((v) => !v)}
                aria-pressed={showAllEvents}
                className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
              >
                {showAllEvents
                  ? t("report.timelineSection.showIssuesOnly")
                  : plural("report.timelineSection.showAll", report.timeline.length)}
              </button>
            ) : null}
          </div>
          {timelineSectionOpen ? (
            <motion.div layout className="mt-5 space-y-4">
              <AnimatePresence initial={false}>
                {visibleTimeline.map((event) => (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.35, ease: EASE }}
                  >
                    <TimelineItem
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
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">
              {plural("report.timelineSection.collapsed", report.timeline.length)}
            </p>
          )}
        </Reveal>

        <Reveal as="aside" delay={0.1} className="space-y-6">
          <AssessmentHighlightsCard highlights={report.assessmentHighlights} />
        </Reveal>
      </section>

      <Reveal as="section" className="glass-card mt-8 p-6">
        <h2 className="section-title"><span className="section-num">04</span>{t("report.evidenceSection.title")}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {evidenceVideoUrl
            ? t("report.evidenceSection.hintVideo")
            : t("report.evidenceSection.hintStatic")}
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <div className="overflow-hidden rounded-md bg-ink ring-1 ring-line">
              {evidenceVideoUrl ? (
                <video
                  key={selectedId}
                  ref={evidenceVideoRef}
                  className="h-72 w-full bg-black object-contain md:h-80 lg:h-96"
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => setVideoDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
                  poster={evidenceSrc}
                  src={evidenceVideoUrl}
                >
                  {t("report.evidenceSection.noVideoSupport")}
                </video>
              ) : (
                <img
                  src={evidenceSrc}
                  alt={t("report.evidenceSection.previewAlt")}
                  className="h-72 w-full bg-brand-50 object-contain md:h-80 lg:h-96"
                />
              )}
            </div>
            {evidenceVideoUrl ? (
              <TimelineStrip
                events={report.timeline.map((e) => ({ ...e, timeSeconds: seekSecondsFromTimelineEvent(e) }))}
                duration={report.durationSeconds ?? videoDuration}
                onSeek={seekEvidenceVideoToSeconds}
              />
            ) : null}
          </div>
          <Stagger className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {report.clips.map((clip) => (
              <StaggerItem key={clip.id}>
                <ClipCard
                  clip={clip}
                  onReplay={
                    evidenceVideoUrl
                      ? () => seekEvidenceVideoToSeconds(seekSecondsFromClip(clip))
                      : undefined
                  }
                />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Reveal>

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
          onSeek={evidenceVideoUrl ? seekEvidenceVideoToSeconds : undefined}
        />
      )}
    </main>
  );
}

export default TrainingReportPage;
