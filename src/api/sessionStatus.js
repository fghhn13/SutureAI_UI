/** Training session lifecycle (mirrors server/app/models.py SessionStatus). */

export const STATUS_LABELS = {
  created: "Waiting for video",
  uploaded: "Queued for analysis",
  scoring: "Analysing video",
  scored: "Queued for report",
  generating: "Writing report",
  ready: "Report ready",
  failed: "Failed",
};

export const TERMINAL_STATUSES = new Set(["ready", "failed"]);

/**
 * Processing stages, in order (mirrors server/app/providers/base.py STAGES).
 * `details` are the rotating "currently doing…" lines shown while a stage runs. They are
 * presentational: placeholders like {frame} are filled with plausible values client-side.
 */
export const STAGES = [
  {
    key: "verify",
    label: "Verify recording",
    details: [
      "Reading container metadata…",
      "Checking video integrity ({mb} MB)…",
      "Decoding first keyframes…",
      "Normalising frame rate to 30 fps…",
      "Confirming camera angle and framing…",
    ],
  },
  {
    key: "detect_instruments",
    label: "Detect instruments",
    details: [
      "Scanning frame {frame} / {frames} for instruments…",
      "Needle holder located (confidence {conf})",
      "Forceps located (confidence {conf})",
      "Checking which tool is in the left hand…",
      "Locating needle tip in frame {frame}…",
      "Tracking suture thread…",
    ],
  },
  {
    key: "track_hands",
    label: "Track hands",
    details: [
      "Estimating hand keypoints in frame {frame}…",
      "Measuring tremor frequency ({hz} Hz)…",
      "Computing path length of the right hand…",
      "Detecting idle periods…",
      "Smoothing trajectories…",
    ],
  },
  {
    key: "segment_steps",
    label: "Segment procedure steps",
    details: [
      "Looking for task start…",
      "Detecting threading attempts…",
      "Counting knot throws…",
      "Matching steps against the procedure checklist…",
      "Aligning events to the timeline at {time}…",
    ],
  },
  {
    key: "score_dimensions",
    label: "Score dimensions",
    details: [
      "Scoring efficiency…",
      "Scoring accuracy…",
      "Scoring procedural flow…",
      "Scoring safety…",
      "Scoring product quality…",
      "Estimating confidence…",
    ],
  },
  {
    key: "write_report",
    label: "Write report",
    details: [
      "Comparing with your previous sessions…",
      "Drafting strengths and areas to improve…",
      "Writing practice suggestions…",
      "Summarising key findings…",
    ],
  },
  {
    key: "link_evidence",
    label: "Link evidence clips",
    details: [
      "Linking event at {time} to the recording…",
      "Selecting key clips…",
      "Building the timeline…",
      "Finalising report…",
    ],
  },
];

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/** Index of the active stage for a session (STAGES.length when everything is done). */
export function activeStageIndex(session) {
  if (session.status === "ready") return STAGES.length;
  if (session.stage && session.stage in STAGE_INDEX) return STAGE_INDEX[session.stage];
  if (session.status === "scored" || session.status === "generating") return STAGE_INDEX.write_report;
  return 0;
}
