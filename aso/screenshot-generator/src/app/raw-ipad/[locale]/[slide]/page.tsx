"use client";

import { useEffect, useState } from "react";
import { use } from "react";

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
    <div style={{ position: "relative", aspectRatio: "770/1000", ...style }}>
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
    "01_home": {
      label: "7 GAMES IN ONE",
      head: ["7 Games", "One iPad", "No Wi-Fi"],
      variant: "hero",
      accent: THEME.accent,
      imageFile: "01_home_en.png",
    },
    "02_setup": {
      label: "ZERO SETUP",
      head: ["Two Taps", "And You Are", "Playing"],
      variant: "centered",
      accent: THEME.accent,
      imageFile: "02_setup_en.png",
    },
    "03_icebreaker": {
      label: "ICEBREAKER",
      head: ["Deep Questions", "That Actually", "Connect"],
      variant: "centered",
      accent: THEME.accentGreen,
      imageFile: "03_icebreaker_en.png",
    },
    "04_would_you_rather": {
      label: "WOULD YOU RATHER",
      head: ["Hilarious", "Dilemmas", "Instant Debates"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "04_would_you_rather_en.png",
    },
    "05_forbidden_words": {
      label: "FORBIDDEN WORDS",
      head: ["Describe It", "Without The", "Banned Words"],
      variant: "centered",
      accent: THEME.accent,
      imageFile: "05_forbidden_words_en.png",
    },
    "06_letter_game": {
      label: "LETTER GAME",
      head: ["One Letter", "One Category", "Think Fast"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "06_letter_game_en.png",
    },
    "07_5_seconds": {
      label: "5 SECONDS",
      head: ["Name 3 Things", "In Just", "5 Seconds"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "07_5_seconds_en.png",
    },
    "08_spy_reveal": {
      label: "SPY",
      head: ["Find The Spy", "Before They", "Find You"],
      variant: "centered",
      accent: THEME.accentCool,
      imageFile: "08_spy_reveal_en.png",
    },
    "09_who_am_i": {
      label: "WHO AM I?",
      head: ["Ask Yes Or No", "Until You", "Guess Who"],
      variant: "centered",
      accent: THEME.accentCool,
      imageFile: "09_who_am_i_en.png",
    },
    "10_results": {
      label: "GAME NIGHT",
      head: ["Pass The iPad", "Keep The", "Party Going"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "10_results_en.png",
    },
  },
  pl: {
    "01_home": {
      label: "7 GIER W JEDNYM",
      head: ["7 Gier", "Jeden iPad", "Bez Wi-Fi"],
      variant: "hero",
      accent: THEME.accent,
      imageFile: "01_home_pl.png",
    },
    "02_setup": {
      label: "ZERO SETUPU",
      head: ["Dwa Tapnięcia", "I Już", "Gracie"],
      variant: "centered",
      accent: THEME.accent,
      imageFile: "02_setup_pl.png",
    },
    "03_icebreaker": {
      label: "LODOŁAMACZ",
      head: ["Głębokie Pytania", "Które Naprawdę", "Łączą"],
      variant: "centered",
      accent: THEME.accentGreen,
      imageFile: "03_icebreaker_pl.png",
    },
    "04_would_you_rather": {
      label: "CO WOLISZ",
      head: ["Zabawne", "Dylematy", "Burzliwe Spory"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "04_would_you_rather_pl.png",
    },
    "05_forbidden_words": {
      label: "ZAKAZANE SŁOWA",
      head: ["Opisz Hasło", "Bez Słów", "Zakazanych"],
      variant: "centered",
      accent: THEME.accent,
      imageFile: "05_forbidden_words_pl.png",
    },
    "06_letter_game": {
      label: "GRA NA LITERĘ",
      head: ["Jedna Litera", "Jedna Kategoria", "Myśl Szybko"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "06_letter_game_pl.png",
    },
    "07_5_seconds": {
      label: "5 SEKUND",
      head: ["Wymień 3 Rzeczy", "W Zaledwie", "5 Sekund"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "07_5_seconds_pl.png",
    },
    "08_spy_reveal": {
      label: "SZPIEG",
      head: ["Znajdź Szpiega", "Zanim On", "Znajdzie Ciebie"],
      variant: "centered",
      accent: THEME.accentCool,
      imageFile: "08_spy_reveal_pl.png",
    },
    "09_who_am_i": {
      label: "KIM JESTEM",
      head: ["Pytaj Tak Lub Nie", "Aż", "Zgadniesz"],
      variant: "centered",
      accent: THEME.accentCool,
      imageFile: "09_who_am_i_pl.png",
    },
    "10_results": {
      label: "WIECZÓR GIER",
      head: ["Podaj iPada", "I Graj", "Dalej"],
      variant: "centered",
      accent: THEME.accentWarm,
      imageFile: "10_results_pl.png",
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

// iPad is much wider relative to height than iPhone, so we constrain by height.
// Target: device fills ~78% of canvas height, centered horizontally, sitting near bottom.
function getDeviceStyle(variant: LayoutVariant): React.CSSProperties {
  const baseShadow = `drop-shadow(0 ${W * 0.025}px ${W * 0.04}px rgba(0,0,0,0.55))`;
  // CSS iPad frame uses aspectRatio 770/1000 (width/height).
  const targetHeightFrac = variant === "hero" ? 0.74 : 0.7;
  const targetHeight = H * targetHeightFrac;
  const deviceWidth = targetHeight * (770 / 1000);

  return {
    position: "absolute",
    left: "50%",
    bottom: variant === "hero" ? H * -0.03 : H * 0.01,
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
  const cfg = SLIDES[locale]?.[slide] ?? SLIDES.en["01_home"];
  const deviceStyle = getDeviceStyle(cfg.variant);
  const src = `/screenshots-ipad/${locale}/${cfg.imageFile}`;

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
              fontSize: W * 0.022,
              fontWeight: 700,
              letterSpacing: W * 0.003,
              color: cfg.accent ?? THEME.accent,
              marginBottom: W * 0.018,
              textTransform: "uppercase",
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: W * 0.062,
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
