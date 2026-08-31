import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const colors = {
  graphite: "#2f2d2d",
  graphite2: "#454a52",
  paper: "#eef2f7",
  white: "#ffffff",
  silver: "#d8e2ec",
  ice: "#bbcde8",
  blue: "#2563eb",
  mint: "#88bba2",
  mintSoft: "rgba(136, 187, 162, 0.18)",
  text2: "#5c5a57",
  text3: "#8a8783",
  border: "rgba(47,45,45,0.08)",
};

const wordmarkPath =
  "M0 10.5C0 8.29086 1.79086 6.5 4 6.5H179C181.209 6.5 183 8.29086 183 10.5V37C183 39.2091 184.791 41 187 41H367.5C369.709 41 371.5 39.2091 371.5 37V4C371.5 1.79086 373.291 0 375.5 0H551.014C552.785 0 554.345 1.16472 554.849 2.86275L595.477 139.863C596.237 142.427 594.316 145 591.642 145H413.17C412.406 145 411.658 144.781 411.015 144.37L369.985 118.13C369.342 117.719 368.594 117.5 367.83 117.5H187C184.791 117.5 183 119.291 183 121.5V146.5C183 148.709 181.209 150.5 179 150.5H4C1.79086 150.5 0 148.709 0 146.5V10.5Z";

const ease = {
  easing: Easing.out(Easing.cubic),
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const baseText = {
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  color: colors.graphite,
};

function t(frame: number, from: number, to: number) {
  return interpolate(frame, [from, to], [0, 1], ease);
}

function fade(frame: number, inFrom: number, inTo: number, outFrom: number, outTo: number) {
  return Math.min(t(frame, inFrom, inTo), 1 - t(frame, outFrom, outTo));
}

function HypherMark({ color = colors.graphite, width = 220 }: { color?: string; width?: number }) {
  return (
    <svg width={width} viewBox="0 0 596 151" fill="none">
      <path d={wordmarkPath} fill={color} />
    </svg>
  );
}

function Background() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = interpolate(frame, [0, 12 * fps], [0, -88], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: colors.paper }}>
      <AbsoluteFill
        style={{
          opacity: 0.64,
          backgroundImage: `
            linear-gradient(to right, rgba(47,45,45,0.055) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(47,45,45,0.055) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
          transform: `translate(${drift}px, ${drift * 0.5}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 22%, rgba(187,205,232,0.65), transparent 32%), radial-gradient(circle at 78% 68%, rgba(136,187,162,0.32), transparent 34%)",
        }}
      />
    </AbsoluteFill>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 22,
        letterSpacing: 3,
        textTransform: "uppercase",
        color: colors.text3,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function Card({
  title,
  body,
  accent = colors.border,
  style,
}: {
  title: string;
  body: string;
  accent?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: 420,
        minHeight: 160,
        border: `2px solid ${accent}`,
        background: "rgba(255,255,255,0.86)",
        borderRadius: 18,
        boxShadow: "0 24px 70px rgba(47,45,45,0.09), inset 0 1px 0 rgba(255,255,255,0.95)",
        padding: 28,
        ...style,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 750, color: colors.graphite }}>{title}</div>
      <div style={{ marginTop: 14, fontSize: 22, lineHeight: 1.35, color: colors.text2 }}>{body}</div>
    </div>
  );
}

function IntroScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, durationInFrames: 38, config: { damping: 200 } });
  const headline = t(frame, 22, 52);
  const out = t(frame, 82, 106);

  return (
    <AbsoluteFill
      style={{
        ...baseText,
        alignItems: "center",
        justifyContent: "center",
        opacity: 1 - out,
        transform: `translateY(${-out * 42}px)`,
      }}
    >
      <div style={{ transform: `scale(${0.86 + mark * 0.14})`, opacity: mark }}>
        <HypherMark width={310} />
      </div>
      <div
        style={{
          marginTop: 36,
          fontSize: 86,
          lineHeight: 1.02,
          fontWeight: 780,
          letterSpacing: 0,
          opacity: headline,
          transform: `translateY(${(1 - headline) * 30}px)`,
        }}
      >
        Capture first.
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 44,
          color: colors.text2,
          opacity: t(frame, 42, 68),
        }}
      >
        Hypher sorts the rest.
      </div>
    </AbsoluteFill>
  );
}

function CaptureScene() {
  const frame = useCurrentFrame();
  const capture = t(frame, 0, 32);
  const sort = t(frame, 44, 92);
  const out = t(frame, 114, 142);

  const notes: Array<[string, string, number, string]> = [
    ["Voice memo", "Launch idea while walking home", 0, colors.blue],
    ["Screenshot", "Pricing table from competitor", 12, colors.ice],
    ["Note", "Digest tone should feel calm", 24, colors.mint],
  ];

  return (
    <AbsoluteFill
      style={{
        ...baseText,
        opacity: 1 - out,
        padding: "116px 150px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Label>Input</Label>
          <div style={{ marginTop: 18, fontSize: 64, fontWeight: 760 }}>Drop anything in.</div>
        </div>
        <HypherMark width={170} color={colors.graphite2} />
      </div>

      <div style={{ position: "relative", marginTop: 84, height: 620 }}>
        {notes.map(([title, body, delay, accent], index) => {
          const p = t(frame, Number(delay), Number(delay) + 28);
          const x = interpolate(sort, [0, 1], [0, 520 + index * 86], ease);
          const y = interpolate(sort, [0, 1], [index * 148, 42 + index * 138], ease);
          return (
            <Card
              key={title}
              title={title}
              body={body}
              accent={accent}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                opacity: p,
                transform: `translate(${x}px, ${y + (1 - p) * 36}px) scale(${0.96 + p * 0.04})`,
              }}
            />
          );
        })}

        <div
          style={{
            position: "absolute",
            right: 0,
            top: 24,
            width: 540,
            height: 500,
            borderRadius: 24,
            border: `2px solid ${colors.border}`,
            background: "rgba(255,255,255,0.76)",
            padding: 34,
            opacity: t(frame, 54, 86),
          }}
        >
          <Label>Suggested projects</Label>
          <div style={{ marginTop: 30, display: "grid", gap: 18 }}>
            {[
              ["Essays", "82%", colors.mint],
              ["Ship v1", "14%", colors.silver],
              ["Research", "4%", colors.silver],
            ].map(([name, score, color], index) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "22px 24px",
                  borderRadius: 14,
                  background: index === 0 ? colors.mintSoft : "rgba(238,242,247,0.85)",
                  border: `2px solid ${index === 0 ? colors.mint : colors.border}`,
                  fontSize: 28,
                  fontWeight: 720,
                  transform: `translateX(${(1 - t(frame, 74 + index * 8, 100 + index * 8)) * 28}px)`,
                  opacity: t(frame, 74 + index * 8, 100 + index * 8),
                }}
              >
                <span>{name}</span>
                <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function MemoryScene() {
  const frame = useCurrentFrame();
  const inP = t(frame, 0, 34);
  const out = t(frame, 82, 112);
  const pulse = interpolate(frame % 70, [0, 35, 70], [0.35, 1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ ...baseText, padding: "112px 140px", opacity: Math.min(inP, 1 - out) }}>
      <div style={{ width: 720 }}>
        <Label>Project memory</Label>
        <div style={{ marginTop: 18, fontSize: 62, lineHeight: 1.05, fontWeight: 780 }}>
          Work comes back with context.
        </div>
      </div>

      <div style={{ position: "absolute", inset: "270px 140px 120px 140px" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path
            d="M310 170 C520 90 700 210 880 140 S1210 130 1370 270"
            fill="none"
            stroke={colors.mint}
            strokeWidth="5"
            strokeDasharray="16 18"
            opacity={0.45 + pulse * 0.35}
          />
          <path
            d="M330 390 C590 330 720 440 910 380 S1210 340 1420 430"
            fill="none"
            stroke={colors.ice}
            strokeWidth="5"
            opacity={0.45}
          />
        </svg>

        <Card
          title="Essays"
          body="Reader trust, digest tone, export limits."
          accent={colors.mint}
          style={{ position: "absolute", left: 80, top: 40, transform: `translateY(${(1 - inP) * 40}px)` }}
        />
        <Card
          title="Open questions"
          body="What should the first digest explain?"
          accent={colors.ice}
          style={{ position: "absolute", left: 670, top: 6, transform: `translateY(${(1 - inP) * 54}px)` }}
        />
        <Card
          title="Next action"
          body="Draft digest intro for first-time readers."
          accent={colors.mint}
          style={{
            position: "absolute",
            right: 80,
            bottom: 28,
            width: 500,
            background: "rgba(136,187,162,0.2)",
            transform: `translateY(${(1 - t(frame, 40, 76)) * 46}px)`,
            opacity: t(frame, 40, 76),
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function OutroScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, durationInFrames: 44, config: { damping: 200 } });
  const line = t(frame, 26, 58);

  return (
    <AbsoluteFill style={{ ...baseText, alignItems: "center", justifyContent: "center" }}>
      <div style={{ opacity: enter, transform: `translateY(${(1 - enter) * 44}px) scale(${0.95 + enter * 0.05})` }}>
        <HypherMark width={300} />
      </div>
      <div style={{ marginTop: 34, fontSize: 74, fontWeight: 780, opacity: line }}>
        Signal in motion.
      </div>
      <div style={{ marginTop: 18, fontSize: 34, color: colors.text2, opacity: t(frame, 54, 84) }}>
        Capture. Sort. Remember. Return.
      </div>
    </AbsoluteFill>
  );
}

export function HypherShowcaseIntro() {
  return (
    <AbsoluteFill>
      <Background />
      <Sequence from={0} durationInFrames={118} premountFor={30}>
        <IntroScene />
      </Sequence>
      <Sequence from={92} durationInFrames={158} premountFor={30}>
        <CaptureScene />
      </Sequence>
      <Sequence from={220} durationInFrames={160} premountFor={30}>
        <MemoryScene />
      </Sequence>
      <Sequence from={308} durationInFrames={52} premountFor={30}>
        <OutroScene />
      </Sequence>
    </AbsoluteFill>
  );
}
