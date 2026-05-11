/** Report ids from public/reports/catalog.json that each demo user may open (UI filter). */

export const REPORT_IDS_ALL = ["report-default", "report-alt", "report-video-demo"];

/** @param {string} userId */
export function getAllowedReportIds(userId) {
  const map = {
    alex: REPORT_IDS_ALL,
    jordan: ["report-default", "report-alt"],
  };
  return map[userId] ?? REPORT_IDS_ALL;
}
