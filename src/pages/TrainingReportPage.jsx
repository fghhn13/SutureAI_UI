import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { getAllowedReportIds } from "../data/reportAcl.js";

function publicAssetUrl(path) {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${base}${p}`;
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

function TimelineItem({ event, expanded, onToggle, onSeekToSeconds }) {
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
          </div>
        </div>
        {expanded && <p className="mt-3 text-sm text-slate-600">{event.detail}</p>}
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

function StudentReportFeedbackReflectionSection({ data }) {
  const isInstructorPending = data.instructorEvaluation.evaluationStatus
    .toLowerCase()
    .includes("awaiting");

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

function InstructorReviewResolutionSection({ data }) {
  return (
    <article className="mt-4 rounded-xl border border-brand-100 bg-brand-50/40 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-700">
        Instructor Review & Resolution
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Teacher-facing workflow for final educational evaluation, student clarification handling, and
        resolution tracking on the same evidence-based report.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border border-indigo-100 bg-white p-4 xl:col-span-2">
          <h4 className="text-sm font-semibold text-indigo-700">Instructor Evaluation Form</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Instructor Name</span>
              <input
                defaultValue={data.instructorEvaluation.instructorName}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Review Status</span>
              <input
                defaultValue={data.instructorReview.reviewStatus}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">AI Suggested Score</span>
              <input
                defaultValue={data.instructorReview.aiSuggestedScore}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                readOnly
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Final Confirmed Score</span>
              <input
                defaultValue={data.instructorReview.finalConfirmedScore}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Optional Adjusted Score</span>
              <input
                defaultValue={data.instructorReview.adjustedScore}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Alignment with AI</span>
              <select
                defaultValue={data.instructorReview.alignmentWithAi}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
              >
                <option>Fully agree</option>
                <option>Partially adjust</option>
                <option>Override</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Teacher Comment</span>
            <textarea
              defaultValue={data.instructorReview.teacherComment}
              className="h-24 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
            />
          </label>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700">Teaching Focus</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.instructorReview.teachingFocus.map((focus) => (
                <span
                  key={focus}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700"
                >
                  {focus}
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Student Objection / Clarification</h4>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Submitted: </span>
              {data.studentObjection.submitted ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-medium text-slate-900">Resolution Status: </span>
              {data.studentObjection.resolutionStatus}
            </p>
            <p>
              <span className="font-medium text-slate-900">Student Concern: </span>
              {data.studentObjection.concernText}
            </p>
            <p>
              <span className="font-medium text-slate-900">Referenced Clip: </span>
              {data.studentObjection.referencedClip}
            </p>
          </div>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Teacher Response</span>
            <textarea
              defaultValue={data.studentObjection.teacherResponse}
              className="h-24 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-brand-200 focus:ring"
            />
          </label>
        </article>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-800">Review Actions</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Save Draft
          </button>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Confirm Evaluation
          </button>
          <button className="rounded-md border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100">
            Send Response to Student
          </button>
        </div>
      </div>
    </article>
  );
}

function InstructorReportFeedbackSection({ data }) {
  const isInstructorPending = data.instructorEvaluation.evaluationStatus
    .toLowerCase()
    .includes("awaiting");

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
              {data.instructorReview.reviewStatus}
            </p>
            <p>
              <span className="font-medium text-slate-900">AI Suggested Score: </span>
              {data.instructorReview.aiSuggestedScore}
            </p>
            <p>
              <span className="font-medium text-slate-900">Final Confirmed Score: </span>
              {data.instructorReview.finalConfirmedScore}
            </p>
          </div>
          <label className="mt-4 block text-sm font-medium text-slate-700">Comment</label>
          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-6">
            {isInstructorPending || !data.instructorReview.teacherComment ? (
              <span className="italic text-slate-400">
                Awaiting instructor comment after final review confirmation.
              </span>
            ) : (
              <span className="text-slate-700">{data.instructorReview.teacherComment}</span>
            )}
          </div>
        </article>
      </div>

      <InstructorReviewResolutionSection data={data} />
    </section>
  );
}

function TrainingReportPage() {
  const { user } = useAuth();
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
  const [viewMode, setViewMode] = useState("student");
  const evidenceVideoRef = useRef(null);

  const loadCatalog = useCallback(() => {
    setCatalogLoading(true);
    setCatalogError(null);
    fetch(publicAssetUrl("reports/catalog.json"))
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load catalog (${res.status})`);
        return res.json();
      })
      .then((data) => {
        const uid = user?.id ?? "alex";
        const allowed = new Set(getAllowedReportIds(uid));
        const filtered = Array.isArray(data) ? data.filter((item) => allowed.has(item.id)) : [];
        setCatalog(filtered);
        const params = new URLSearchParams(window.location.search);
        const wanted = params.get("report");
        const nextId =
          wanted && filtered.some((item) => item.id === wanted)
            ? wanted
            : filtered[0]?.id ?? "";
        setSelectedId(nextId);
      })
      .catch((err) => {
        setCatalogError(err instanceof Error ? err.message : "Failed to load catalog");
        setCatalog([]);
      })
      .finally(() => setCatalogLoading(false));
  }, [user?.id]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!selectedId || catalog.length === 0) return undefined;

    const entry = catalog.find((item) => item.id === selectedId);
    if (!entry) return undefined;

    let cancelled = false;
    setReportLoading(true);
    setReportError(null);

    fetch(publicAssetUrl(entry.path.replace(/^\//, "")))
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load report (${res.status})`);
        return res.json();
      })
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
  }, [selectedId, catalog, reportRetryToken]);

  useEffect(() => {
    if (!report?.timeline) return;
    setExpanded(defaultExpandedTimelineIds(report.timeline));
    setTimelineSectionOpen(true);
  }, [report]);

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
      ? publicAssetUrl(report.evidencePreviewUrl.replace(/^\//, ""))
      : publicAssetUrl("picture/微信图片_20260421160900_112_99.png");

  const evidenceVideoUrl =
    report?.evidenceVideoUrl != null && String(report.evidenceVideoUrl).trim() !== ""
      ? publicAssetUrl(String(report.evidenceVideoUrl).replace(/^\//, ""))
      : null;

  const seekEvidenceVideoToSeconds = (seconds) => {
    const el = evidenceVideoRef.current;
    if (!el || typeof seconds !== "number" || Number.isNaN(seconds)) return;
    el.currentTime = Math.max(0, seconds);
    el.play().catch(() => {});
  };

  if (catalogLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-600 md:px-8">
        <div className="mb-6 text-left">
          <Link to="/" className="link-brand text-sm font-medium">
            Student dashboard
          </Link>
        </div>
        Loading reports…
      </main>
    );
  }

  if (catalogError) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="mb-6">
          <Link to="/" className="link-brand text-sm font-medium">
            Student dashboard
          </Link>
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
          <Link to="/" className="link-brand text-sm font-medium">
            Student dashboard
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-700 shadow-soft">
          <p className="font-semibold text-slate-900">No reports available</p>
          <p className="mt-2 text-sm">
            Your account does not have any training reports in the catalog yet.
          </p>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-4">
          <Link to="/" className="link-brand text-sm font-medium">
            Student dashboard
          </Link>
        </div>
        <header className="surface-card surface-card-lift p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Training session
              </span>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
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
        <Link to="/" className="link-brand text-sm font-medium">
          Student dashboard
        </Link>
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
            {report.dateTime}
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
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium normal-case text-slate-800"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">View Mode</span>
          <button
            type="button"
            onClick={() => setViewMode("student")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "student"
                ? "bg-brand-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Student View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("instructor")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === "instructor"
                ? "bg-brand-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Instructor View
          </button>
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
                  <span className="font-semibold text-emerald-600">{report.delta}</span>
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

      {viewMode === "instructor" ? (
        <InstructorReportFeedbackSection data={report} />
      ) : (
        <StudentReportFeedbackReflectionSection data={report} />
      )}
    </main>
  );
}

export default TrainingReportPage;
