"use client";

import { useEffect, useState } from "react";
import { use } from "react";

// 13-inch iPad App Store screenshot canvas (portrait).
const W = 2064;
const H = 2752;

const THEME = {
  bgTop: "#1a0f3d",
  bgBottom: "#0a0014",
  accent: "#ff5e8a",
  accentWarm: "#ffa86b",
  accentCool: "#7c5cff",
  accentGreen: "#2ed573",
  text: "#ffffff",
};

// CSS-drawn iPad frame (portrait, width/height aspect 770/1000).
const MK_W = 770;
const MK_H = 1000;

function IPad({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", aspectRatio: `${MK_W}/${MK_H}`, ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "5% / 3.6%",
          background: "linear-gradient(180deg, #2C2C2E 0%, #1C1C1E 100%)",
          position: "relative",
          overflow: "hidden",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* Front camera dot */}
        <div
          style={{
            position: "absolute",
            top: "1.2%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "0.9%",
            height: "0.65%",
            borderRadius: "50%",
            background: "#111113",
            border: "1px solid rgba(255,255,255,0.08)",
            zIndex: 20,
          }}
        />
        {/* Bezel edge highlight */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "5% / 3.6%",
            border: "1px solid rgba(255,255,255,0.06)",
            pointerEvents: "none",
            zIndex: 15,
          }}
        />
        {/* Screen area */}
        <div
          style={{
            position: "absolute",
            left: "4%",
            top: "2.8%",
            width: "92%",
            height: "94.4%",
            borderRadius: "2.2% / 1.6%",
            overflow: "hidden",
            background: "#000",
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
            }}
          />
        </div>
      </div>
    </div>
  );
}

type LayoutVariant = "hero" | "centered";

type SlideConfig = {
  label: string;
  head: string[];
  variant: LayoutVariant;
  accent?: string;
  imageFile: string;
};

type LocaleSlides = Record<string, SlideConfig>;

const SLIDES: Record<string, LocaleSlides> = {
  en: {
    home: {
      label: "CHALLENGE YOUR FRIENDS",
      head: ["3 Game Shows", "One Phone", "Beat Your Friends"],
      variant: "hero",
      accent: THEME.accent,
      imageFile: "home.png",
    },
    ladder: {
      label: "THE LADDER",
      head: ["Climb The", "15-Question", "Trivia Ladder"],
      variant: "centered",
      accent: THEME.accent,
      imageFile: "ladder.png",
    },
    drop: {
      label: "THE DROP",
      head: ["Risk Your", "Million On", "Every Answer"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "drop.png",
    },
    wheel: {
      label: "THE WHEEL",
      head: ["Spin, Guess", "And Solve", "The Puzzle"],
      variant: "centered",
      accent: THEME.accentCool,
      imageFile: "wheel.png",
    },
  },
  pl: {
    home: {
      label: "RZUĆ WYZWANIE ZNAJOMYM",
      head: ["3 Teleturnieje", "Jeden Telefon", "Pokonaj Znajomych"],
      variant: "hero",
      accent: THEME.accent,
      imageFile: "home.png",
    },
    ladder: {
      label: "DRABINA",
      head: ["Wespnij Się", "Po Drabinie", "15 Pytań"],
      variant: "centered",
      accent: THEME.accent,
      imageFile: "ladder.png",
    },
    drop: {
      label: "ZRZUT",
      head: ["Zaryzykuj", "Milion Przy", "Każdej Odpowiedzi"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "drop.png",
    },
    wheel: {
      label: "KOŁO",
      head: ["Kręć i Zgaduj", "Rozwiąż", "Hasło"],
      variant: "centered",
      accent: THEME.accentCool,
      imageFile: "wheel.png",
    },
  },
};

const confetti = [
  { x: 8, y: 12, s: 0.018, c: "#ff5e8a", r: true, rot: 25 },
  { x: 88, y: 7, s: 0.014, c: "#ffa86b", r: false, rot: 0 },
  { x: 14, y: 35, s: 0.011, c: "#7c5cff", r: false, rot: 0 },
  { x: 92, y: 28, s: 0.02, c: "#ff5e8a", r: true, rot: -40 },
  { x: 6, y: 58, s: 0.016, c: "#ffa86b", r: true, rot: 60 },
  { x: 94, y: 62, s: 0.013, c: "#7c5cff", r: false, rot: 0 },
  { x: 12, y: 82, s: 0.014, c: "#ff5e8a", r: false, rot: 0 },
  { x: 90, y: 88, s: 0.018, c: "#ffa86b", r: true, rot: -20 },
  { x: 50, y: 4, s: 0.011, c: "#7c5cff", r: false, rot: 0 },
];

// The iPad frame is height-constrained and centered horizontally,
// sitting near the bottom of the canvas below the caption.
function getDeviceStyle(variant: LayoutVariant): React.CSSProperties {
  const baseShadow = `drop-shadow(0 ${W * 0.025}px ${W * 0.04}px rgba(0,0,0,0.55))`;
  const targetHeightFrac = variant === "hero" ? 0.74 : 0.7;
  const deviceWidth = H * targetHeightFrac * (MK_W / MK_H);

  return {
    position: "absolute",
    left: "50%",
    bottom: variant === "hero" ? H * -0.03 : H * 0.015,
    width: deviceWidth,
    transform: "translateX(-50%)",
    filter: baseShadow,
  };
}

export default function RawIPadSlide({
  params,
}: {
  params: Promise<{ locale: string; slide: string }>;
}) {
  const { locale, slide } = use(params);
  const cfg = SLIDES[locale]?.[slide] ?? SLIDES.en.home;
  const deviceStyle = getDeviceStyle(cfg.variant);
  const src = `/screenshots/${locale}/${cfg.imageFile}`;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const im = new Image();
    im.onload = () => {
      if (mounted) setTimeout(() => setReady(true), 400);
    };
    im.onerror = () => {
      if (mounted) setTimeout(() => setReady(true), 400);
    };
    im.src = src;
    return () => {
      mounted = false;
    };
  }, [src]);

  const captionTop = cfg.variant === "hero" ? H * 0.05 : H * 0.045;

  return (
    <div style={{ background: "#000", minHeight: "100vh", padding: 0, margin: 0 }}>
      <div
        id="capture-root"
        data-ready={ready ? "1" : "0"}
        style={{
          position: "relative",
          width: W,
          height: H,
          overflow: "hidden",
          color: THEME.text,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 80% at 50% 0%, ${THEME.bgTop} 0%, ${THEME.bgBottom} 65%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: H * -0.08,
            left: W * -0.15,
            width: W * 0.9,
            height: W * 0.9,
            background: `radial-gradient(circle, rgba(255,94,138,0.32) 0%, rgba(255,94,138,0) 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: H * 0.25,
            right: W * -0.3,
            width: W * 0.85,
            height: W * 0.85,
            background: `radial-gradient(circle, rgba(255,168,107,0.26) 0%, rgba(255,168,107,0) 70%)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: H * -0.15,
            left: W * 0.05,
            width: W * 0.9,
            height: W * 0.9,
            background: `radial-gradient(circle, rgba(124,92,255,0.30) 0%, rgba(124,92,255,0) 70%)`,
          }}
        />
        {confetti.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: W * p.s,
              height: W * p.s * (p.r ? 0.32 : 1),
              background: p.c,
              borderRadius: p.r ? "999px" : "50%",
              transform: `rotate(${p.rot}deg)`,
              opacity: 0.85,
            }}
          />
        ))}

        {/* Caption */}
        <div
          style={{
            position: "absolute",
            top: captionTop,
            left: 0,
            right: 0,
            padding: `0 ${W * 0.07}px`,
            textAlign: "center",
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontSize: W * 0.021,
              fontWeight: 700,
              letterSpacing: W * 0.0028,
              color: cfg.accent ?? THEME.accent,
              marginBottom: W * 0.016,
              textTransform: "uppercase",
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: W * 0.058,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -W * 0.0015,
              color: THEME.text,
            }}
          >
            {cfg.head.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>

        {/* iPad */}
        <IPad src={src} alt="ipad" style={deviceStyle} />
      </div>
    </div>
  );
}
