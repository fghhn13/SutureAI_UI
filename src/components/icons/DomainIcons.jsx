/**
 * Suturing icons lucide doesn't have, drawn on lucide's 24px grid with the same stroke props
 * (size, strokeWidth, currentColor) so they mix freely with lucide icons.
 */

function Svg({ size = 24, strokeWidth = 1.75, className = "", children, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Curved suture needle with a trailing thread. */
export function NeedleIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 15a8 8 0 0 1 15.5-2.8" />
      <path d="m19.5 12.2 1-3.2-3.3.6" />
      <circle cx="4" cy="15" r="1" />
      <path d="M4 16c0 2.5 1.5 4 3.5 4s3-1.5 5-1.5" />
    </Svg>
  );
}

/** Straight incision closed by interrupted stitches. */
export function StitchIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3v18" />
      <path d="m8.5 5.5 7 2" />
      <path d="m8.5 10 7 2" />
      <path d="m8.5 14.5 7 2" />
      <path d="m8.5 19 4 1" />
    </Svg>
  );
}

/** Needle holder (ringed handles, locking jaws). */
export function NeedleHolderIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="10.5" cy="18.5" r="2.5" />
      <path d="m7 16.5 7.5-9" />
      <path d="m9.5 16 6-7.5" />
      <path d="m14.5 7.5 4-4.5 1 1-3.5 4.5" />
    </Svg>
  );
}

/** Square knot: two crossing loops. */
export function KnotIcon(props) {
  return (
    <Svg {...props}>
      <path d="M3 12c3 0 4-4 7-4s3 8 6 8 2.5-4 5-4" />
      <path d="M3 16c3 0 4-8 7-8" opacity="0.55" />
      <path d="M14 8c3 0 3.5 4 7 4" opacity="0.55" />
    </Svg>
  );
}

/** AR glasses used for capture. */
export function ARGlassesIcon(props) {
  return (
    <Svg {...props}>
      <path d="M2 10h20" />
      <rect x="3" y="10" width="7.5" height="6" rx="2.5" />
      <rect x="13.5" y="10" width="7.5" height="6" rx="2.5" />
      <path d="M10.5 12.5c.5-.7 2.5-.7 3 0" />
      <path d="M6 6.5h2.5M17 4v4M15 6h4" />
    </Svg>
  );
}

/** Hand landmarks: the hand-tracking skeleton the scorer reads. */
export function HandTrackIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 20v-6" />
      <path d="M12 14 8 9.5V5" />
      <path d="m12 14 .5-6V3.5" />
      <path d="m12 14 4-4.5V5.5" />
      <path d="m12 14 6.5-2.5" />
      <circle cx="12" cy="20" r="1.2" fill="currentColor" />
      <circle cx="8" cy="5" r="1.2" fill="currentColor" />
      <circle cx="12.5" cy="3.5" r="1.2" fill="currentColor" />
      <circle cx="16" cy="5.5" r="1.2" fill="currentColor" />
      <circle cx="18.5" cy="11.5" r="1.2" fill="currentColor" />
    </Svg>
  );
}
