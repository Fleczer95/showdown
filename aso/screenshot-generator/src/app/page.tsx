"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";

const LOCALES = ["en", "pl"] as const;
type Locale = (typeof LOCALES)[number];

const IPHONE_W = 1320;
const IPHONE_H = 2868;

const IPHONE_SIZES = [
  { label: '6.9"', w: 1320, h: 2868 },
  { label: '6.5"', w: 1284, h: 2778 },
  { label: '6.3"', w: 1206, h: 2622 },
  { label: '6.1"', w: 1125, h: 2436 },
] as const;

const THEME = {
  bgTop: "#1a0f3d",
  bgBottom: "#0a0014",
  accent: "#ff5e8a",
  accentWarm: "#ffa86b",
  accentCool: "#7c5cff",
  text: "#ffffff",
  textMuted: "rgba(255,255,255,0.62)",
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
  className = "",
}: {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ aspectRatio: `${MK_W}/${MK_H}`, ...style }}
    >
      <img
        src="/mockup.png"
        alt=""
        className="block w-full h-full"
        draggable={false}
      />
      <div
        className="absolute z-10 overflow-hidden"
        style={{
          left: `${SC_L}%`,
          top: `${SC_T}%`,
          width: `${SC_W}%`,
          height: `${SC_H}%`,
          borderRadius: `${SC_RX}% / ${SC_RY}%`,
        }}
      >
        <img
          src={src}
          alt={alt}
          className="block w-full h-full object-cover object-top"
          draggable={false}
        />
      </div>
    </div>
  );
}

function Background({ W, H }: { W: number; H: number }) {
  return (
    <>
      {/* Base radial gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 80% at 50% 0%, ${THEME.bgTop} 0%, ${THEME.bgBottom} 65%)`,
        }}
      />
      {/* Top pink glow */}
      <div
        style={{
          position: "absolute",
          top: H * -0.08,
          left: W * -0.15,
          width: W * 0.9,
          height: W * 0.9,
          background: `radial-gradient(circle, rgba(255,94,138,0.35) 0%, rgba(255,94,138,0) 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Right warm glow */}
      <div
        style={{
          position: "absolute",
          top: H * 0.25,
          right: W * -0.3,
          width: W * 0.85,
          height: W * 0.85,
          background: `radial-gradient(circle, rgba(255,168,107,0.28) 0%, rgba(255,168,107,0) 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Bottom violet glow */}
      <div
        style={{
          position: "absolute",
          bottom: H * -0.15,
          left: W * 0.05,
          width: W * 0.9,
          height: W * 0.9,
          background: `radial-gradient(circle, rgba(124,92,255,0.32) 0%, rgba(124,92,255,0) 70%)`,
          pointerEvents: "none",
        }}
      />
      {/* Confetti dots */}
      {confettiPositions.map((p, i) => (
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
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

const confettiPositions = [
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

/* ---------------- Slides ---------------- */

const COPY = {
  en: {
    hero: { label: "SHOWDOWN", head: ["3 Game Shows. One Phone.", "Beat Your Friends."] },
  },
  pl: {
    hero: { label: "SHOWDOWN", head: ["3 Teleturnieje. Jeden Telefon.", "Pokonaj Znajomych."] },
  },
} as const;

function HeroSlide({ base, locale, W, H }: { base: string; locale: Locale; W: number; H: number }) {
  const copy = COPY[locale].hero;
  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        overflow: "hidden",
        color: THEME.text,
      }}
    >
      <Background W={W} H={H} />

      {/* Caption block */}
      <div
        style={{
          position: "absolute",
          top: H * 0.06,
          left: 0,
          right: 0,
          padding: `0 ${W * 0.08}px`,
          textAlign: "center",
          zIndex: 5,
        }}
      >
        <div
          style={{
            fontSize: W * 0.028,
            fontWeight: 700,
            letterSpacing: W * 0.0035,
            color: THEME.accent,
            marginBottom: W * 0.018,
            textTransform: "uppercase",
          }}
        >
          {copy.label}
        </div>
        <div
          style={{
            fontSize: W * 0.085,
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: -W * 0.002,
            color: THEME.text,
          }}
        >
          {copy.head.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      {/* Phone */}
      <Phone
        src={`${base}/home_en.png`}
        alt="ShowDown home"
        style={{
          position: "absolute",
          left: "50%",
          bottom: H * -0.04,
          width: W * 0.84,
          transform: "translateX(-50%)",
          filter: `drop-shadow(0 ${W * 0.04}px ${W * 0.06}px rgba(0,0,0,0.55))`,
        }}
      />
    </div>
  );
}

/* Slide registry — start with just the hero */

type SlideDef = {
  id: string;
  filename: string;
  Component: React.FC<{ base: string; locale: Locale; W: number; H: number }>;
};

const IPHONE_SLIDES: SlideDef[] = [
  { id: "home", filename: "home", Component: HeroSlide },
];

/* ---------------- Preview ---------------- */

function ScreenshotPreview({
  children,
  W,
  H,
  onExport,
  busy,
}: {
  children: React.ReactNode;
  W: number;
  H: number;
  onExport: () => void;
  busy: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const cw = el.clientWidth;
      setScale(cw / W);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [W]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
      style={{ aspectRatio: `${W}/${H}` }}
    >
      <div
        style={{
          width: W,
          height: H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
      <button
        onClick={onExport}
        disabled={busy}
        className="absolute bottom-2 right-2 z-20 rounded-full bg-white/10 px-3 py-1 text-xs text-white backdrop-blur hover:bg-white/20 disabled:opacity-50"
      >
        {busy ? "…" : "Export PNG"}
      </button>
    </div>
  );
}

/* ---------------- Page ---------------- */

const resizeDataUrl = async (dataUrl: string, tw: number, th: number): Promise<Blob> => {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((r) => {
    img.onload = () => r();
  });
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, tw, th);
  return new Promise<Blob>((r) =>
    canvas.toBlob((b) => r(b!), "image/png")
  );
};

export default function ScreenshotsPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [sizeIdx, setSizeIdx] = useState(0);
  const [renderKey, setRenderKey] = useState<{ locale: Locale; index: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState("");

  const exportContainerRef = useRef<HTMLDivElement>(null);
  const captureResolveRef = useRef<((d: string | null) => void) | null>(null);

  const base = `/screenshots/${locale}`;
  const W = IPHONE_W;
  const H = IPHONE_H;
  const exportSize = IPHONE_SIZES[sizeIdx];

  useEffect(() => {
    if (!renderKey) return;
    const el = exportContainerRef.current;
    if (!el) {
      captureResolveRef.current?.(null);
      return;
    }
    const timer = setTimeout(async () => {
      const opts = { width: W, height: H, pixelRatio: 1, cacheBust: true };
      try {
        await toPng(el, opts);
        const dataUrl = await toPng(el, opts);
        captureResolveRef.current?.(dataUrl);
      } catch (e) {
        console.error(e);
        captureResolveRef.current?.(null);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [renderKey, W, H]);

  const renderAndCapture = useCallback(
    (loc: Locale, index: number): Promise<string | null> =>
      new Promise((resolve) => {
        captureResolveRef.current = resolve;
        setRenderKey({ locale: loc, index });
      }),
    []
  );

  const exportSingle = async (index: number) => {
    setExporting(true);
    setProgress(`${locale} ${index + 1}/${IPHONE_SLIDES.length}`);
    const dataUrl = await renderAndCapture(locale, index);
    setRenderKey(null);
    if (dataUrl) {
      const blob = await resizeDataUrl(dataUrl, exportSize.w, exportSize.h);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const name = IPHONE_SLIDES[index].filename;
      a.download = `${String(index + 1).padStart(2, "0")}-${name}_${locale}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
    setExporting(false);
    setProgress("");
  };

  const exportAll = async () => {
    setExporting(true);
    const zip = new JSZip();
    for (const loc of LOCALES) {
      for (let i = 0; i < IPHONE_SLIDES.length; i++) {
        setProgress(`${loc} ${i + 1}/${IPHONE_SLIDES.length}`);
        const dataUrl = await renderAndCapture(loc, i);
        if (!dataUrl) continue;
        for (const size of IPHONE_SIZES) {
          const blob = await resizeDataUrl(dataUrl, size.w, size.h);
          const folder = `app-store/${loc}/${size.label}`;
          const filename = `${String(i + 1).padStart(2, "0")}-${IPHONE_SLIDES[i].filename}_${loc}.png`;
          zip.file(`${folder}/${filename}`, blob);
        }
      }
    }
    setRenderKey(null);
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(zipBlob);
    a.download = "showdown-app-store.zip";
    a.click();
    URL.revokeObjectURL(a.href);
    setExporting(false);
    setProgress("");
  };

  const ActiveSlide = renderKey ? IPHONE_SLIDES[renderKey.index].Component : null;
  const activeBase = renderKey ? `/screenshots/${renderKey.locale}` : base;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="mr-4 text-lg font-semibold">ShowDown — App Store</h1>

          <div className="flex gap-1 rounded-full bg-white/5 p-1">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className="rounded-full px-3 py-1 text-xs"
                style={{
                  background: locale === l ? "#fff" : "transparent",
                  color: locale === l ? "#000" : "#fff",
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={sizeIdx}
            onChange={(e) => setSizeIdx(Number(e.target.value))}
            className="rounded-full bg-white/5 px-3 py-1 text-xs"
          >
            {IPHONE_SIZES.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label} — {s.w}×{s.h}
              </option>
            ))}
          </select>

          <a
            href="/play-store"
            className="rounded-full bg-white/5 px-3 py-1 text-xs hover:bg-white/10"
          >
            → Play Store
          </a>

          <div className="ml-auto flex gap-2">
            <button
              onClick={exportAll}
              disabled={exporting}
              className="rounded-full bg-pink-500 px-4 py-1.5 text-xs font-semibold hover:bg-pink-400 disabled:opacity-50"
            >
              {exporting ? `Exporting… ${progress}` : "Export ALL (ZIP)"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {IPHONE_SLIDES.map((s, i) => {
            const C = s.Component;
            return (
              <div key={s.id}>
                <ScreenshotPreview
                  W={W}
                  H={H}
                  onExport={() => exportSingle(i)}
                  busy={exporting}
                >
                  <C base={base} locale={locale} W={W} H={H} />
                </ScreenshotPreview>
                <div className="mt-2 text-xs text-white/60">
                  {String(i + 1).padStart(2, "0")} · {s.filename}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Offscreen export container — always mounted, content controlled by renderKey */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: -1,
          pointerEvents: "none",
          opacity: 0,
        }}
      >
        <div ref={exportContainerRef} style={{ width: W, height: H }}>
          {ActiveSlide && renderKey && (
            <ActiveSlide base={activeBase} locale={renderKey.locale} W={W} H={H} />
          )}
        </div>
      </div>
    </div>
  );
}
