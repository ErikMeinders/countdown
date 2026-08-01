// A simple person glyph, one figure or two, used on the Single / Together
// actions and the "back to single" control. Drawn, not from an icon font.
export function PersonIcon({ variant = "single", size = 20, color = "currentColor" }) {
  if (variant === "double") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3.3" fill={color} />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="1.9" strokeLinecap="round" fill="none" />
        <circle cx="16.5" cy="8.5" r="2.7" fill={color} opacity="0.9" />
        <path d="M14.5 14.2c1-.5 1.9-.7 2.9-.7 2.6 0 4.6 1.8 4.6 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none" opacity="0.9" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" fill={color} />
      <path d="M5 19.5c0-3.4 3-6 7-6s7 2.6 7 6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
