"use client";

import { useEffect, useState } from "react";
import { use } from "react";

const PHONE_W = 1440;
const PHONE_H = 2560;
const TABLET_W = 1600;
const TABLET_H = 2560;

const THEME = {
  bgTop: "#1a0f3d",
  bgBottom: "#0a0014",
  accent: "#ff5e8a",
  accentWarm: "#ffa86b",
  accentCool: "#7c5cff",
  accentGreen: "#2ed573",
  text: "#ffffff",
};

function AndroidPhone({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", aspectRatio: "9/19.5", ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "12% / 6%",
          background:
            "linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 50%, #111 100%)",
          position: "relative",
          overflow: "hidden",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), 0 12px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Punch-hole camera */}
        <div
          style={{
            position: "absolute",
            top: "3%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "2.8%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.06)",
            zIndex: 20,
          }}
        />
        {/* Screen */}
        <div
          style={{
            position: "absolute",
            left: "3%",
            top: "1.8%",
            width: "94%",
            height: "96.5%",
            borderRadius: "10% / 5%",
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

// Tablet portrait mockup with 9:16 screen aspect (matches the tablet10 raws)
// Outer frame aspect 10:17 leaves a slim bezel.
function AndroidTablet({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: "relative", aspectRatio: "10/17", ...style }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "5% / 3%",
          background:
            "linear-gradient(160deg, #2a2a2a 0%, #1a1a1a 50%, #111 100%)",
          position: "relative",
          overflow: "hidden",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), 0 12px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Front camera */}
        <div
          style={{
            position: "absolute",
            top: "1.2%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "1.2%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.06)",
            zIndex: 20,
          }}
        />
        {/* Screen — 9:16 aspect, centered with even bezel */}
        <div
          style={{
            position: "absolute",
            left: "5%",
            top: "3%",
            width: "90%",
            height: "94%",
            borderRadius: "3% / 1.8%",
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

type LayoutVariant = "hero" | "centered" | "left" | "right";

type SlideConfig = {
  label: string;
  head: string[];
  variant: LayoutVariant;
  accent?: string;
};

type LocaleSlides = Record<string, SlideConfig>;

const SLIDES: Record<string, LocaleSlides> = {
  en: {
    "01_home_screen": {
      label: "7 GAMES IN ONE",
      head: ["7 Games", "One Phone", "No Wi-Fi"],
      variant: "hero",
      accent: THEME.accent,
    },
    "02_forbidden_words": {
      label: "FORBIDDEN WORDS",
      head: ["Two Teams", "One Word", "No Hints"],
      variant: "centered",
      accent: THEME.accent,
    },
    "03_forbidden_words_game": {
      label: "FORBIDDEN WORDS",
      head: ["Describe It", "Without The", "Banned Words"],
      variant: "centered",
      accent: THEME.accent,
    },
    "04_who_am_i_game": {
      label: "WHO AM I?",
      head: ["Ask Yes Or No", "Until You", "Guess Who"],
      variant: "centered",
      accent: THEME.accentCool,
    },
    "05_5_seconds_game": {
      label: "5 SECONDS",
      head: ["Name 3 Things", "In Just", "5 Seconds"],
      variant: "centered",
      accent: THEME.accentWarm,
    },
    "06_settings": {
      label: "MADE FOR EVERYONE",
      head: ["Family Friendly", "Works Offline", "No Accounts"],
      variant: "centered",
      accent: THEME.accentGreen,
    },
  },
  pl: {
    "01_home_screen": {
      label: "7 GIER W JEDNYM",
      head: ["7 Gier", "Jeden Telefon", "Bez Wi-Fi"],
      variant: "hero",
      accent: THEME.accent,
    },
    "02_forbidden_words": {
      label: "ZAKAZANE SŁOWA",
      head: ["Dwie Drużyny", "Jedno Słowo", "Bez Podpowiedzi"],
      variant: "centered",
      accent: THEME.accent,
    },
    "03_forbidden_words_game": {
      label: "ZAKAZANE SŁOWA",
      head: ["Opisz Hasło", "Bez Słów", "Zakazanych"],
      variant: "centered",
      accent: THEME.accent,
    },
    "04_who_am_i_game": {
      label: "KIM JESTEM",
      head: ["Pytaj Tak Lub Nie", "Aż", "Zgadniesz"],
      variant: "centered",
      accent: THEME.accentCool,
    },
    "05_5_seconds_game": {
      label: "5 SEKUND",
      head: ["Wymień 3 Rzeczy", "W Zaledwie", "5 Sekund"],
      variant: "centered",
      accent: THEME.accentWarm,
    },
    "06_settings": {
      label: "DLA KAŻDEGO",
      head: ["Bezpieczna", "Działa Offline", "Bez Kont"],
      variant: "centered",
      accent: THEME.accentGreen,
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

function getDeviceStyle(
  variant: LayoutVariant,
  W: number,
  H: number,
  isTablet: boolean
): React.CSSProperties {
  const baseShadow = `drop-shadow(0 ${W * 0.04}px ${W * 0.06}px rgba(0,0,0,0.55))`;
  // Constrain by HEIGHT so the device never overlaps the caption area at top.
  // Tablet frame is 10:17 (wider, shorter). Phone is 9:19.5 (narrower, taller).
  // Sized to match App Store phone prominence (phone fills ~75% of canvas height).
  const aspect = isTablet ? 10 / 17 : 9 / 19.5;
  const targetHeight = H * 0.8;
  const deviceWidth = targetHeight * aspect;

  switch (variant) {
    case "hero":
      return {
        position: "absolute",
        left: "50%",
        bottom: H * -0.04,
        width: deviceWidth,
        transform: "translateX(-50%)",
        filter: baseShadow,
      };
    case "centered":
      return {
        position: "absolute",
        left: "50%",
        bottom: H * -0.04,
        width: deviceWidth,
        transform: "translateX(-50%)",
        filter: baseShadow,
      };
    case "left":
      return {
        position: "absolute",
        left: isTablet ? "6%" : "4%",
        bottom: H * -0.02,
        width: deviceWidth,
        transform: "rotate(-4deg)",
        filter: baseShadow,
      };
    case "right":
      return {
        position: "absolute",
        right: isTablet ? "6%" : "4%",
        bottom: H * -0.02,
        width: deviceWidth,
        transform: "rotate(4deg)",
        filter: baseShadow,
      };
  }
}

export default function RawPlaySlide({
  params,
}: {
  params: Promise<{ device: string; locale: string; slide: string }>;
}) {
  const { device, locale, slide } = use(params);
  const isTablet = device === "tablet10";
  const W = isTablet ? TABLET_W : PHONE_W;
  const H = isTablet ? TABLET_H : PHONE_H;

  const cfg = SLIDES[locale]?.[slide] ?? SLIDES.en["01_home_screen"];
  const deviceStyle = getDeviceStyle(cfg.variant, W, H, isTablet);

  const sourceDir = isTablet ? "screenshots-play-tablet" : "screenshots-play";
  const src = `/${sourceDir}/${locale}/${slide}.png`;

  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    const imgs = [src];
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
              fontSize: W * 0.026,
              fontWeight: 700,
              letterSpacing: W * 0.0035,
              color: cfg.accent ?? THEME.accent,
              marginBottom: W * 0.02,
              textTransform: "uppercase",
            }}
          >
            {cfg.label}
          </div>
          <div
            style={{
              fontSize: W * (isTablet ? 0.07 : 0.078),
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

        {/* Device */}
        {isTablet ? (
          <AndroidTablet src={src} alt="tablet" style={deviceStyle} />
        ) : (
          <AndroidPhone src={src} alt="phone" style={deviceStyle} />
        )}
      </div>
    </div>
  );
}
