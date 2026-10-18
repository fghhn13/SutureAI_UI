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
  "#e2e8f8",
  "#d1dbf3",
  "#beccee",
  "#a7b8e6",
  "#8ea3de",
  "#758cd4",
  "#546ec4",
  "#4e67c0",
  "#445db1",
  "#3c53a1",
  "#354a91",
  "#2e4179",
  "#26365f",
];

/** Map a value in [lo, hi] onto the ramp; returns fill + an ink that clears contrast on it. */
export function rampColor(value, lo, hi) {
  const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
  const i = Math.round(t * (BLUE_RAMP.length - 1));
  return { fill: BLUE_RAMP[i], ink: i >= 6 ? "#ffffff" : CHART.inkPrimary };
}
