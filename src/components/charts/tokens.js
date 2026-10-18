/**
 * Chart tokens (dataviz reference palette, light mode — the app has no dark theme).
 * Text never uses series colours; marks carry identity, text uses ink tokens.
 */
export const CHART = {
  surface: "#ffffff",
  inkPrimary: "#2b2924",
  inkSecondary: "#4a463f",
  inkMuted: "#6f6a60",
  grid: "#e8e3d8",
  axis: "#d9d3c6",
  series: "#4f69c2", // categorical slot 1 (brand blue)
  deEmphasis: "#d9d3c6", // sparkline body; the latest point takes the accent
  upGood: "#4a7456",
  downBad: "#a24e36",
};

/** Sequential blue ramp (100 → 700) for magnitude, e.g. the score heatmap. */
export const BLUE_RAMP = [
  "#cde2fb",
  "#b7d3f6",
  "#9ec5f4",
  "#86b6ef",
  "#6da7ec",
  "#5598e7",
  "#3987e5",
  "#2a78d6",
  "#256abf",
  "#1c5cab",
  "#184f95",
  "#104281",
  "#0d366b",
];

/** Map a value in [lo, hi] onto the ramp; returns fill + an ink that clears contrast on it. */
export function rampColor(value, lo, hi) {
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  const i = Math.round(t * (BLUE_RAMP.length - 1));
  return { fill: BLUE_RAMP[i], ink: i >= 6 ? "#ffffff" : CHART.inkPrimary };
}
