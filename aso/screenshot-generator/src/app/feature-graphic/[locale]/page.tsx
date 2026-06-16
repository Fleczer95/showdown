"use client";

import { use, useEffect, useState } from "react";

const W = 1024;
const H = 500;

const THEME = {
  bgTop: "#1a0f3d",
  bgBottom: "#0a0014",
  accent: "#ff5e8a",
  accentWarm: "#ffa86b",
  accentCool: "#7c5cff",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.72)",
};

const COPY: Record<string, { head: string; sub: string }> = {
  en: { head: "3 TV Game Shows. One Phone.", sub: "Challenge friends to beat your score." },
  pl: { head: "3 Teleturnieje. Jeden Telefon.", sub: "Rzuć wyzwanie znajomym i pobij wynik." },
};

const confetti = [
  { x: 10, y: 16, s: 0.02, c: "#ff5e8a", r: true, rot: 25 },
  { x: 90, y: 12, s: 0.016, c: "#ffa86b", r: false, rot: 0 },
  { x: 78, y: 30, s: 0.013, c: "#7c5cff", r: false, rot: 0 },
  { x: 95, y: 70, s: 0.022, c: "#ff5e8a", r: true, rot: -40 },
  { x: 6, y: 64, s: 0.018, c: "#ffa86b", r: true, rot: 60 },
  { x: 30, y: 88, s: 0.014, c: "#7c5cff", r: false, rot: 0 },
  { x: 64, y: 86, s: 0.016, c: "#ff5e8a", r: false, rot: 0 },
];

export default function FeatureGraphic({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  const copy = COPY[locale] ?? COPY.en;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const im = new Image();
    im.onload = im.onerror = () => setTimeout(() => setReady(true), 300);
    im.src = "/app-icon.png";
  }, []);

  return (
    <div style={{ background: "#000", margin: 0, padding: 0 }}>
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
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 120% at 50% 0%, ${THEME.bgTop} 0%, ${THEME.bgBottom} 70%)` }} />
        <div style={{ position: "absolute", top: H * -0.4, left: W * -0.1, width: W * 0.7, height: W * 0.7, background: `radial-gradient(circle, rgba(255,94,138,0.35) 0%, rgba(255,94,138,0) 70%)` }} />
        <div style={{ position: "absolute", bottom: H * -0.6, right: W * -0.1, width: W * 0.7, height: W * 0.7, background: `radial-gradient(circle, rgba(124,92,255,0.35) 0%, rgba(124,92,255,0) 70%)` }} />
        {confetti.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: W * p.s, height: W * p.s * (p.r ? 0.32 : 1), background: p.c, borderRadius: p.r ? "999px" : "50%", transform: `rotate(${p.rot}deg)`, opacity: 0.85 }} />
        ))}

        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", gap: W * 0.05, padding: `0 ${W * 0.07}px` }}>
          <img
            src="/app-icon.png"
            alt="ShowDown"
            style={{ width: H * 0.52, height: H * 0.52, borderRadius: H * 0.12, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: W * 0.072, fontWeight: 800, letterSpacing: -W * 0.001, lineHeight: 1.05 }}>
              Show<span style={{ color: THEME.accent }}>Down</span>
            </div>
            <div style={{ fontSize: W * 0.034, fontWeight: 700, marginTop: H * 0.04, lineHeight: 1.1 }}>{copy.head}</div>
            <div style={{ fontSize: W * 0.026, fontWeight: 500, marginTop: H * 0.025, color: THEME.textMuted, lineHeight: 1.1 }}>{copy.sub}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
