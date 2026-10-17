/**
 * Client-side translation of values the API sends in English (dimension and task names,
 * reliability, review status, dashboard notices, attention items). Every helper takes the
 * `t` from useI18n() and falls back to the original string when the value is unknown.
 */

/** English dimension name (server/app/providers/dimensions.py) → dictionary slug. */
const DIMENSION_KEYS = {
  Efficiency: "efficiency",
  Accuracy: "accuracy",
  "Procedural Flow": "procedural_flow",
  Safety: "safety",
  "Product Quality": "product_quality",
};

/** English task name → task id (server/app/seed.py), for payloads that only carry the name. */
const TASK_IDS_BY_NAME = {
  "Simple Suturing Practice": "simple-suturing",
  "Knot Tying Basics": "knot-tying",
  "Needle Handling": "needle-handling",
};

const RELIABILITY_KEYS = { high: "high", medium: "medium", low: "low" };

export function dimensionName(t, name) {
  if (!name) return name ?? "—";
  const key = DIMENSION_KEYS[name];
  return key ? t(`domain.dimensions.${key}`, { defaultValue: name }) : name;
}

function taskId(idOrName) {
  return TASK_IDS_BY_NAME[idOrName] ?? idOrName;
}

/** Task name by id (preferred) or by its English name. */
export function taskName(t, idOrName, fallback) {
  if (!idOrName) return fallback ?? "—";
  const original = fallback ?? idOrName;
  return t(`domain.tasks.${taskId(idOrName)}.name`, { defaultValue: original });
}

/** Description of a task object from /api/tasks (or a session's `task`). */
export function taskDescription(t, task) {
  if (!task) return "";
  return t(`domain.tasks.${task.id}.description`, { defaultValue: task.description ?? "" });
}

/** "15–20 min" → localised unit; other formats are returned unchanged. */
export function durationLabel(t, text) {
  if (!text) return "—";
  return text.replace(/\bmin\b/, t("common.minutesShort"));
}

/** "High Confidence" → 高置信度, short "High" → 高. Unknown labels pass through. */
export function reliabilityLabel(t, label) {
  if (!label || label === "—") return "—";
  const m = /^(high|medium|low)(\s+confidence)?$/i.exec(label.trim());
  if (!m) return label;
  const level = RELIABILITY_KEYS[m[1].toLowerCase()];
  return t(m[2] ? `domain.reliability.${level}` : `domain.reliabilityShort.${level}`, { defaultValue: label });
}

/** Dashboard review status ("Reviewed" / "Pending", see server reviews.review_label). */
export function reviewStatusLabel(t, label) {
  if (label === "Reviewed") return t("domain.reviewStatus.reviewed");
  if (label === "Pending") return t("domain.reviewStatus.pending");
  return label ?? "—";
}

/**
 * Report review status (server reviews.report_view): the header badge sends "Reviewed" /
 * "Pending Instructor Review", the highlights card "Reviewed by {name}" / "Pending
 * instructor review". Unknown values pass through.
 */
export function reportStatusLabel(t, status) {
  if (!status) return status ?? "—";
  if (status === "Reviewed") return t("report.statusBadge.reviewed");
  if (status === "Pending Instructor Review") return t("report.statusBadge.pending");
  if (status === "Pending instructor review") return t("report.statusBadge.pendingShort");
  const m = /^Reviewed by (.+)$/.exec(status);
  if (m) return t("report.statusBadge.reviewedBy", { name: m[1] });
  return status;
}

/** Evidence clip type ("Error" / "Warning" / "Step", server template_report). */
export function clipTypeLabel(t, type) {
  if (!type) return type ?? "";
  return t(`report.clipType.${String(type).toLowerCase()}`, { defaultValue: type });
}

/** Session lifecycle status (server/app/models.py SessionStatus). */
export function statusLabel(t, status) {
  return t(`status.${status}`, { defaultValue: status });
}

/** Dashboard notice `{ code, params, text }`; unknown codes show the server's English text. */
export function notificationText(t, item) {
  if (typeof item === "string") return item;
  return t(`notifications.${item.code}`, { ...item.params, defaultValue: item.text });
}

/** Instructor attention item `{ kind, params, message }`. */
export function attentionText(t, item) {
  const p = item.params ?? {};
  let key = `attention.${item.kind}`;
  const params = { ...p, defaultValue: item.message };
  if (item.kind === "inactive" && p.days == null) key = "attention.inactiveNever";
  if (p.taskName) params.taskName = taskName(t, p.taskId ?? p.taskName, p.taskName);
  return t(key, params);
}
