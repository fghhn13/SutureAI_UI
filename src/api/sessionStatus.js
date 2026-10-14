/** Training session lifecycle (mirrors server/app/models.py SessionStatus). */

export const STATUS_LABELS = {
  created: "Waiting for video",
  uploaded: "Queued for scoring",
  scoring: "Scoring video",
  scored: "Queued for report",
  generating: "Writing report",
  ready: "Report ready",
  failed: "Failed",
};

export const TERMINAL_STATUSES = new Set(["ready", "failed"]);

/** Steps shown while a session is processed. */
export const PROCESSING_STEPS = ["Upload video", "Score video", "Generate report"];

/** Index of the step currently running for a status (== length when everything is done). */
export const STATUS_STEP_INDEX = {
  created: 0,
  uploaded: 1,
  scoring: 1,
  scored: 2,
  generating: 2,
  ready: 3,
};
