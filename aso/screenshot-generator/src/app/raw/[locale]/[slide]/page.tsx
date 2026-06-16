"use client";

import { useEffect, useState } from "react";
import { use } from "react";

const W = 1320;
const H = 2868;

const THEME = {
  bgTop: "#1a0f3d",
  bgBottom: "#0a0014",
  accent: "#ff5e8a",
  accentWarm: "#ffa86b",
  accentCool: "#7c5cff",
  accentGreen: "#2ed573",
  text: "#ffffff",
};

const MK_W = 1022;
const MK_H = 2082;
const SC_L = (52 / MK_W) * 100;
const SC_T = (46 / MK_H) * 100;
const SC_W = (918 / MK_W) * 100;
const SC_H = (1990 / MK_H) * 100;
const SC_RX = (126 / 918) * 100;
const SC_RY = (126 / 1990) * 100;

function Phone({
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
      <img
        src="/mockup.png"
        alt=""
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div
        style={{
          position: "absolute",
          left: `${SC_L}%`,
          top: `${SC_T}%`,
          width: `${SC_W}%`,
          height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
          overflow: "hidden",
          zIndex: 10,
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
  );
}

type LayoutVariant = "hero" | "centered" | "left" | "right";

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
  { x: 8, y: 12, s: 0.022, c: "#ff5e8a", r: true, rot: 25 },
  { x: 88, y: 7, s: 0.018, c: "#ffa86b", r: false, rot: 0 },
  { x: 14, y: 35, s: 0.014, c: "#7c5cff", r: false, rot: 0 },
  { x: 92, y: 28, s: 0.024, c: "#ff5e8a", r: true, rot: -40 },
  { x: 6, y: 58, s: 0.02, c: "#ffa86b", r: true, rot: 60 },
  { x: 94, y: 62, s: 0.016, c: "#7c5cff", r: false, rot: 0 },
  { x: 12, y: 82, s: 0.018, c: "#ff5e8a", r: false, rot: 0 },
  { x: 90, y: 88, s: 0.022, c: "#ffa86b", r: true, rot: -20 },
  { x: 50, y: 4, s: 0.014, c: "#7c5cff", r: false, rot: 0 },
];

function getPhoneStyle(variant: LayoutVariant): React.CSSProperties {
  const baseShadow = `drop-shadow(0 ${W * 0.04}px ${W * 0.06}px rgba(0,0,0,0.55))`;
  switch (variant) {
    case "hero":
      return {
        position: "absolute",
        left: "50%",
        bottom: H * -0.04,
        width: W * 0.84,
        transform: "translateX(-50%)",
        filter: baseShadow,
      };
    case "centered":
      return {
        position: "absolute",
        left: "50%",
        bottom: H * 0.02,
        width: W * 0.8,
        transform: "translateX(-50%)",
        filter: baseShadow,
      };
    case "left":
      return {
        position: "absolute",
        left: "-6%",
        bottom: H * 0.04,
        width: W * 0.82,
        transform: "rotate(-4deg)",
        filter: baseShadow,
      };
    case "right":
      return {
        position: "absolute",
        right: "-6%",
        bottom: H * 0.04,
        width: W * 0.82,
        transform: "rotate(4deg)",
        filter: baseShadow,
      };
  }
}

export default function RawSlide({
  params,
}: {
  params: Promise<{ locale: string; slide: string }>;
}) {
  const { locale, slide } = use(params);
  const cfg = SLIDES[locale]?.[slide] ?? SLIDES.en.home;
  const phoneStyle = getPhoneStyle(cfg.variant);
  const src = `/screenshots/${locale}/${cfg.imageFile}`;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const imgs = [src, "/mockup.png"];
    Promise.all(
      imgs.map(
        (u) =>
          new Promise<void>((resolve) => {
            const im = new Image();
            im.onload = () => resolve();
            im.onerror = () => resolve();
            im.src = u;
          })
      )
    ).then(() => {
      if (mounted) setTimeout(() => setReady(true), 400);
    });
    return () => {
      mounted = false;
    };
  }, [src]);

  const captionTop = cfg.variant === "hero" ? H * 0.06 : H * 0.05;

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
              fontSize: W * 0.028,
              fontWeight: 700,
              letterSpacing: W * 0.0035,
              color: cfg.accent ?? THEME.accent,
              marginBottom: W * 0.022,
              textTransform: "uppercase",
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: W * 0.082,
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: -W * 0.002,
              color: THEME.text,
            }}
          >
            {cfg.head.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>

        {/* Phone */}
        <Phone src={src} alt="phone" style={phoneStyle} />
      </div>
    </div>
  );
}
