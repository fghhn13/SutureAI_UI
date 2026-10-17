/**
 * Training session lifecycle (mirrors server/app/models.py SessionStatus).
 * Display labels live in the i18n dictionaries: `status.<status>` (see statusLabel() in
 * src/i18n/domain.js).
 */

export const TERMINAL_STATUSES = new Set(["ready", "failed"]);

/**
 * Processing stages, in order (mirrors server/app/providers/base.py STAGES).
 * Each stage's label and rotating "currently doing…" lines are in the dictionaries under
 * `processing.stages.<key>.label` / `.details`. The lines are presentational: placeholders
 * like {frame} are filled with plausible values client-side (ProcessingPanel).
 */
export const STAGES = [
  "verify",
  "detect_instruments",
  "track_hands",
  "segment_steps",
  "score_dimensions",
  "write_report",
  "link_evidence",
].map((key) => ({ key }));

export const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

/** Index of the active stage for a session (STAGES.length when everything is done). */
export function activeStageIndex(session) {
  if (session.status === "ready") return STAGES.length;
  if (session.stage && session.stage in STAGE_INDEX) return STAGE_INDEX[session.stage];
  if (session.status === "scored" || session.status === "generating") return STAGE_INDEX.write_report;
  return 0;
}
