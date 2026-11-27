import { motion } from "motion/react";
import { EASE } from "../motion/index.jsx";

/**
 * Decorative incision that gets stitched closed, drawn like a pen line: the cut first, then
 * each stitch crosses it in turn. Purely ornamental (aria-hidden); used behind hero headers.
 */
const CUT = "M10 70 C 70 30, 130 95, 190 55 S 300 30, 350 60";
// Stitch crossings sampled along the cut, each a short slanted stroke.
const STITCHES = [
  [38, 42, 50, 70],
  [76, 46, 84, 72],
  [114, 56, 120, 82],
  [152, 58, 156, 84],
  [190, 44, 192, 70],
  [228, 34, 232, 60],
  [266, 30, 272, 56],
  [304, 38, 312, 62],
];

export default function SutureLine({ className = "", delay = 0.2 }) {
  return (
    <svg viewBox="0 0 360 110" className={className} fill="none" aria-hidden="true">
      <motion.path
        d={CUT}
        stroke="#c5d1f0"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1], delay }}
      />
      {STITCHES.map(([x1, y1, x2, y2], i) => (
        <motion.line
          key={x1}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#4f69c2"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity={0.45 + (i / STITCHES.length) * 0.45}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, ease: EASE, delay: delay + 0.9 + i * 0.1 }}
        />
      ))}
    </svg>
  );
}
