/**
 * Chart tokens (dataviz reference palette, light mode — the app has no dark theme).
 * Text never uses series colours; marks carry identity, text uses ink tokens.
 */
export const CHART = {
  surface: "#fcfcfb",
  inkPrimary: "#0b0b0b",
  inkSecondary: "#52514e",
  inkMuted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
  series: "#2a78d6", // categorical slot 1 (blue)
  deEmphasis: "#c3c2b7", // sparkline body; the latest point takes the accent
  upGood: "#006300",
  downBad: "#d03b3b",
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
