// The Meridian brand mark: a rounded-square tile in the brand teal with a straight,
// geometric letter M cut out as negative space. Theme-aware through CSS tokens — the
// tile uses `fill-accent` (#0d9488 light / #14b8a6 dark) and the cut-out uses
// `fill-slate-50`, the app canvas color (#f8fafc light / #0a0f1a dark), so the M reads
// as a hole onto whatever sits behind it. Fixed 120×120 geometry, scaled via viewBox.
export default function MeridianMark({ size = 30, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="120" height="120" rx="28" className="fill-accent" />
      <path
        d="M30 88 L30 34 Q30 30 34 33 L60 62 L86 33 Q90 30 90 34 L90 88 L76 88 L76 52 L60 70 L44 52 L44 88 Z"
        className="fill-slate-50"
      />
    </svg>
  );
}
