const MARK_PATH =
  "M0 10.5C0 8.29086 1.79086 6.5 4 6.5H179C181.209 6.5 183 8.29086 183 10.5V37C183 39.2091 184.791 41 187 41H367.5C369.709 41 371.5 39.2091 371.5 37V4C371.5 1.79086 373.291 0 375.5 0H551.014C552.785 0 554.345 1.16472 554.849 2.86275L595.477 139.863C596.237 142.427 594.316 145 591.642 145H413.17C412.406 145 411.658 144.781 411.015 144.37L369.985 118.13C369.342 117.719 368.594 117.5 367.83 117.5H187C184.791 117.5 183 119.291 183 121.5V146.5C183 148.709 181.209 150.5 179 150.5H4C1.79086 150.5 0 148.709 0 146.5V10.5Z";

export function HypherMark({ className = "hypher-signal-mark" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 596 151"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d={MARK_PATH} />
    </svg>
  );
}

export function HypherLockup({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm";
}) {
  const classes = ["hypher-lockup", size === "sm" ? "hypher-lockup--sm" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <img className="hypher-lockup-img" src="/hypher-lockup.png" alt="" aria-hidden />
    </span>
  );
}
