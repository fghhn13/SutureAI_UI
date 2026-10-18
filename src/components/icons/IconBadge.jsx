/**
 * Line icon in a hairline circle: flat, no fill gradient. `icon` is any lucide or
 * DomainIcons component; `tone` only changes the stroke colour.
 */
const TONES = {
  brand: "border-brand-200 bg-brand-50 text-brand-600",
  soft: "border-line bg-white text-brand-500",
  amber: "border-warn/30 bg-warn/5 text-warn",
  rose: "border-bad/30 bg-bad/5 text-bad",
  emerald: "border-good/30 bg-good/5 text-good",
};

const SIZES = {
  sm: { box: "h-8 w-8", icon: 16 },
  md: { box: "h-10 w-10", icon: 19 },
  lg: { box: "h-14 w-14", icon: 24 },
};

export default function IconBadge({ icon: Icon, tone = "soft", size = "md", className = "" }) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${TONES[tone] ?? TONES.soft} ${s.box} ${className}`}
    >
      <Icon size={s.icon} strokeWidth={1.5} />
    </span>
  );
}
