import { useMemo, useState } from "react";
import evidencePreviewImage from "../picture/微信图片_20260421160900_112_99.png";

const reportData = {
  productName: "SutureAI",
  reportTitle: "Training Report",
  task: "Simple Suturing Practice",
  student: "Jason Li",
  dateTime: "Apr 21, 2026 · 14:30",
  status: "Pending Instructor Review",
  overallScore: 74,
  reliability: "Medium Confidence",
  completed: true,
  duration: "1m 42s",
  delta: "+6",
  summary:
    "Good procedural flow, but needle insertion stability needs improvement.",
  dimensions: [
    {
      name: "Efficiency",
      score: 78,
      explanation: "Duration and motion efficiency are above baseline.",
      metrics: "duration, path length, idle ratio",
    },
    {
      name: "Accuracy",
      score: 65,
      explanation: "Insertion precision varied during mid-task attempts.",
      metrics: "entry/exit deviation, stitch spacing",
    },
    {
      name: "Procedural Flow",
      score: 84,
      explanation: "Step order and completion quality are strong.",
      metrics: "step completeness, step order, rework count",
    },
    {
      name: "Safety",
      score: 72,
      explanation: "No critical incidents, but repeated attempts occurred.",
      metrics: "needle drop, tool out of region, repeated attempts",
    },
    {
      name: "Product Quality",
      score: 68,
      explanation: "Knot and stitch consistency need additional practice.",
      metrics: "stitch consistency, knot quality proxy",
    },
  ],
  timeline: [
    {
      id: "t1",
      time: "00:12",
      title: "Needle pickup completed",
      type: "normal",
      detail:
        "Needle grasp stabilized within expected angle range and handover completed without interruption.",
      clip: true,
    },
    {
      id: "t2",
      time: "00:33",
      title: "Proper needle positioning detected",
      type: "normal",
      detail:
        "Needle tip orientation aligned with target tissue entry zone and maintained for >1.2s.",
      clip: false,
    },
    {
      id: "t3",
      time: "00:47",
      title: "Long pause detected",
      type: "warning",
      detail:
        "Idle duration exceeded cohort benchmark by 2.1 seconds before insertion initiation.",
      clip: true,
    },
    {
      id: "t4",
      time: "01:05",
      title: "Repeated insertion attempt",
      type: "error",
      detail:
        "Two readjustments were detected before successful penetration, reducing insertion precision.",
      clip: true,
    },
    {
      id: "t5",
      time: "01:18",
      title: "Knotting started",
      type: "normal",
      detail:
        "Transition into knotting phase was smooth with acceptable tool-to-tool trajectory continuity.",
      clip: false,
    },
    {
      id: "t6",
      time: "01:40",
      title: "Task completed",
      type: "normal",
      detail:
        "Full step sequence completed and terminal knot achieved within target task duration.",
      clip: true,
    },
  ],
  clips: [
    {
      id: "c1",
      time: "00:47",
      type: "Warning",
      label: "Pause Before Insertion",
      description: "Review the prolonged hesitation right before needle penetration.",
    },
    {
      id: "c2",
      time: "01:05",
      type: "Error",
      label: "Repeated Insertion Attempt",
      description: "Observe two readjustments that lowered insertion consistency.",
    },
    {
      id: "c3",
      time: "01:18",
      type: "Step",
      label: "Knotting Transition",
      description: "Strong hand transition with continuous motion into knotting.",
    },
    {
      id: "c4",
      time: "01:40",
      type: "Step",
      label: "Completion Segment",
      description: "Final segment showing completion quality and task closure.",
    },
  ],
  strengths: [
    "Procedural steps were completed in the correct order.",
    "Good overall task continuity during knotting.",
    "Needle handling remained controlled during initial pickup.",
  ],
  weaknesses: [
    "Needle insertion accuracy was unstable across repeated attempts.",
    "One prolonged pause affected efficiency score.",
    "Stitch consistency decreased slightly in the latter half.",
  ],
  suggestions: [
    "Repeat needle positioning drills before full suturing runs.",
    "Practice smoother insertion with fewer readjustments.",
    "Focus on reducing hesitation before penetration.",
  ],
  assessmentHighlights: {
    strongestDimension: "Procedural Flow",
    mainIssue: "Repeated insertion attempts reduced insertion stability.",
    practiceFocus: "Needle insertion consistency",
    evidenceClipCount: 4,
    reviewStatus: "Pending instructor review",
  },
  aiFeedback: [
    "Based on current institutional training benchmarks, the student's procedural flow is within expected range.",
    "Insertion precision remains below the target consistency level for this training stage.",
    "Pause duration before penetration exceeded the cohort median.",
  ],
  instructorEvaluation: {
    instructorName: "Dr. Chen",
    evaluationStatus: "Awaiting final confirmation",
    comment: "",
    finalScore: "",
  },
  studentResponse: {
    helperText:
      "The student may raise concerns if they believe a certain segment was misinterpreted.",
    acceptLabel: "Accept Feedback",
    clarifyLabel: "Request Clarification",
  },
  personalNote:
    "I felt less stable during insertion after the first knotting transition. I should practice positioning before starting full runs.",
  uncertainty: [
    "Hand tracking confidence was moderate due to brief occlusion.",
    "Accuracy-related metrics should be interpreted with caution.",
  ],
  instructorNote:
    "Good baseline flow. Needs more consistency in insertion control.",
  reviewStatus: "Awaiting instructor confirmation",
};

function StatusBadge({ status }) {
  return (
    <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
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

function TimelineItem({ event, expanded, onToggle }) {
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
            <h4 className="text-sm font-semibold text-slate-800">{event.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {labels[event.type]}
            </span>
            {event.clip && (
              <button className="rounded-md border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50">
                View Clip
              </button>
            )}
            <button
              onClick={onToggle}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
        {expanded && <p className="mt-3 text-sm text-slate-600">{event.detail}</p>}
      </div>
    </div>
  );
}

function ClipCard({ clip }) {
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
      <button className="mt-3 w-full rounded-md bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
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
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
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

function ReportFeedbackReflectionSection({ data }) {
  const isInstructorPending = data.instructorEvaluation.evaluationStatus
    .toLowerCase()
    .includes("awaiting");

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
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
          <article className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
              Instructor Evaluation
            </h3>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Instructor: </span>
                {data.instructorEvaluation.instructorName}
              </p>
              <p>
                <span className="font-medium text-slate-900">Status: </span>
                {data.instructorEvaluation.evaluationStatus}
              </p>
              <p>
                <span className="font-medium text-slate-900">Final Score: </span>
                {data.instructorEvaluation.finalScore || (
                  <span className="italic text-slate-400">Pending confirmation</span>
                )}
              </p>
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700">Comment</label>
            <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6">
              {isInstructorPending || !data.instructorEvaluation.comment ? (
                <span className="italic text-slate-400">
                  Awaiting instructor comment after final review confirmation.
                </span>
              ) : (
                <span className="text-slate-700">{data.instructorEvaluation.comment}</span>
              )}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Student Response
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{data.studentResponse.helperText}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                {data.studentResponse.acceptLabel}
              </button>
              <button className="rounded-md border border-brand-200 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                {data.studentResponse.clarifyLabel}
              </button>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Personal Note
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Optional personal reflection saved with this report.
            </p>
            <textarea
              className="mt-3 h-32 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
              defaultValue={data.personalNote}
              placeholder="Write your reflection here..."
            />
          </article>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [expanded, setExpanded] = useState(() => new Set(["t3", "t4"]));
  const completionLabel = reportData.completed ? "Completed" : "Incomplete";
  const completionStyles = reportData.completed
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
    const total = reportData.dimensions.reduce((sum, cur) => sum + cur.score, 0);
    return Math.round(total / reportData.dimensions.length);
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-brand-700">
              {reportData.productName}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {reportData.reportTitle}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{reportData.task}</p>
          </div>
          <StatusBadge status={reportData.status} />
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
          <p>
            <span className="font-medium text-slate-800">Student: </span>
            {reportData.student}
          </p>
          <p>
            <span className="font-medium text-slate-800">Date & Time: </span>
            {reportData.dateTime}
          </p>
          <p>
            <span className="font-medium text-slate-800">Task Duration: </span>
            {reportData.duration}
          </p>
          <p>
            <span className="font-medium text-slate-800">Confidence: </span>
            {reportData.reliability}
          </p>
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft lg:col-span-2">
          <p className="text-sm font-semibold text-slate-500">Overall Performance</p>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <ScoreRing score={reportData.overallScore} />
            <div className="flex-1">
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="font-medium text-slate-800">Reliability: </span>
                  {reportData.reliability}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Change vs Last: </span>
                  <span className="font-semibold text-emerald-600">{reportData.delta}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-800">Duration: </span>
                  {reportData.duration}
                </p>
                <p>
                  <span className="font-medium text-slate-800">Dimension Avg: </span>
                  {avgDimension}
                </p>
              </div>
              <span
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${completionStyles}`}
              >
                {completionLabel}
              </span>
              <p className="mt-3 text-sm leading-6 text-slate-700">{reportData.summary}</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-sm font-semibold text-slate-500">Confidence Notice</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            {reportData.uncertainty.map((item, index) => (
              <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-semibold text-amber-700">
                  {index === 0 ? "Moderate confidence: " : "Caution: "}
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
            <RadarChart dimensions={reportData.dimensions} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
            {reportData.dimensions.map((item) => (
              <DimensionCard key={item.name} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Training Timeline</h2>
          <p className="mt-1 text-sm text-slate-600">
            AI-detected steps, warnings, and evidence-linked events.
          </p>
          <div className="mt-4 space-y-4">
            {reportData.timeline.map((event) => (
              <TimelineItem
                key={event.id}
                event={event}
                expanded={expanded.has(event.id)}
                onToggle={() => toggleTimeline(event.id)}
              />
            ))}
          </div>
        </article>

        <aside className="space-y-6">
          <AssessmentHighlightsCard highlights={reportData.assessmentHighlights} />
        </aside>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-900">Evidence Replay · Key Clips</h2>
        <div className="mt-4 space-y-4">
          <div>
            <div className="overflow-hidden rounded-xl border border-brand-200 bg-slate-100">
              <img
                src={evidencePreviewImage}
                alt="Evidence replay preview"
                className="h-72 md:h-80 lg:h-96 w-full object-contain"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reportData.clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} />
            ))}
          </div>
        </div>
      </section>

      <ReportFeedbackReflectionSection data={reportData} />
    </main>
  );
}

export default App;
