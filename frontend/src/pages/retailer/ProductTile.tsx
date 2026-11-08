import type { ReactNode } from "react";
import { cx } from "../../ui";

type Shape = "pack" | "carton" | "bar" | "bottle" | "tall" | "pouch" | "soap" | "tube";
type Look = { shape: Shape; c: string; d: string; l: string; bg: string };

// Keyed by the product line in the SKU code (SKU-BS-075 -> BS). Product photos are not in the brief, so each line
// gets a drawn pack in its own colours; it is a few hundred bytes and needs no image download on 3G.
const LOOKS: Record<string, Look> = {
  BS: { shape: "pack", c: "#f0b429", d: "#c0392b", l: "#fde7a6", bg: "#fff5dc" },
  CR: { shape: "pack", c: "#5b3420", d: "#3b2214", l: "#f5e6c8", bg: "#f6ebe3" },
  MR: { shape: "pack", c: "#e8833a", d: "#b4541a", l: "#fbd9b5", bg: "#fdeee2" },
  SN: { shape: "pack", c: "#d64531", d: "#9e2a1c", l: "#ffd36b", bg: "#fde9e5" },
  DT: { shape: "carton", c: "#1f6fd1", d: "#154f99", l: "#8dbbf2", bg: "#e7f0fc" },
  DB: { shape: "bar", c: "#12a4a8", d: "#0b7477", l: "#a7e7e8", bg: "#e2f6f6" },
  DW: { shape: "bottle", c: "#3fae49", d: "#2b7f33", l: "#c4ecc7", bg: "#e8f6e9" },
  FC: { shape: "bottle", c: "#7c4dcc", d: "#57339a", l: "#dccdf5", bg: "#f0eafb" },
  TE: { shape: "pouch", c: "#8b1e2d", d: "#5e1220", l: "#e0b04a", bg: "#f8e8ea" },
  TD: { shape: "pouch", c: "#7a4a24", d: "#52311a", l: "#e0b04a", bg: "#f3ebe3" },
  SP: { shape: "soap", c: "#e86fa0", d: "#b84277", l: "#ffd5e6", bg: "#fdebf2" },
  SH: { shape: "tall", c: "#2f5bd3", d: "#1e3e99", l: "#cfdafb", bg: "#e9eefc" },
  TP: { shape: "tube", c: "#d62839", d: "#1f4fbf", l: "#ffffff", bg: "#fdeaec" },
};
const FALLBACK: Look = { shape: "carton", c: "#7a8580", d: "#4f5853", l: "#d5dbd7", bg: "#eef1ee" };

const zigzag = (x: number, dir: 1 | -1) =>
  Array.from({ length: 8 }, (_, i) => `${x + (i % 2 ? 4 * dir : 0)},${18 + i * 4}`).join(" ");

function art({ shape, c, d, l }: Look): ReactNode {
  switch (shape) {
    case "pack":
      return <>
        <polygon points={`12,18 ${zigzag(12, -1)} 12,46`} fill={d} />
        <polygon points={`52,18 ${zigzag(52, 1)} 52,46`} fill={d} />
        <rect x="11" y="18" width="42" height="28" rx="4" fill={c} />
        <rect x="11" y="18" width="42" height="7" rx="3" fill="#fff" opacity=".22" />
        <rect x="11" y="37" width="42" height="5" fill={d} opacity=".85" />
        <circle cx="39" cy="31" r="8.5" fill={l} stroke={d} strokeOpacity=".25" />
        {[[36, 28], [42, 29], [38, 34], [42, 34]].map(([x, y]) => <circle key={x * y} cx={x} cy={y} r="1" fill={d} opacity=".55" />)}
        <circle cx="21" cy="29" r="5" fill="#fff" />
        <text x="21" y="31.3" textAnchor="middle" fontSize="6.5" fontWeight="800" fill={d}>K</text>
      </>;
    case "carton":
      return <>
        <path d="M17 15 L25 10 L49 10 L41 15 Z" fill={l} />
        <path d="M41 15 L49 10 L49 47 L41 52 Z" fill={d} />
        <rect x="17" y="15" width="24" height="37" rx="1.5" fill={c} />
        <circle cx="29" cy="30" r="8" fill="#fff" opacity=".95" />
        <circle cx="29" cy="30" r="4.5" fill={l} />
        <circle cx="26" cy="27" r="1.6" fill="#fff" />
        <rect x="17" y="42" width="24" height="5" fill={d} opacity=".7" />
      </>;
    case "bar":
      return <>
        <path d="M13 26 L19 20 L57 20 L51 26 Z" fill={l} />
        <path d="M51 26 L57 20 L57 36 L51 42 Z" fill={d} />
        <rect x="9" y="26" width="42" height="16" rx="2" fill={c} />
        <rect x="9" y="31" width="42" height="3" fill="#fff" opacity=".35" />
        <ellipse cx="30" cy="34" rx="10" ry="4.8" fill="#fff" />
        <text x="30" y="36.2" textAnchor="middle" fontSize="6" fontWeight="800" fill={d}>K</text>
      </>;
    case "bottle":
      return <>
        <rect x="27" y="8" width="10" height="7" rx="2" fill={d} />
        <path d="M28 15 h8 v5 q8 3 8 11 v18 q0 5 -5 5 h-14 q-5 0 -5 -5 v-18 q0 -8 8 -11 Z" fill={c} />
        <path d="M23 31 q0 -6 5 -9" stroke="#fff" strokeOpacity=".45" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <rect x="23" y="33" width="18" height="13" rx="2.5" fill="#fff" opacity=".95" />
        <path d="M32 35.5 q3.4 4 3.4 6 a3.4 3.4 0 0 1 -6.8 0 q0 -2 3.4 -6 Z" fill={c} />
      </>;
    case "tall":
      return <>
        <path d="M27 6 h10 l1.5 6 h-13 Z" fill={d} />
        <rect x="23" y="12" width="18" height="43" rx="7" fill={c} />
        <rect x="26" y="15" width="3" height="34" rx="1.5" fill="#fff" opacity=".35" />
        <rect x="25" y="28" width="14" height="15" rx="3" fill={l} />
        <path d="M29 33 q3 -3 6 0 M29 37 q3 -3 6 0" stroke={d} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>;
    case "pouch":
      return <>
        <path d="M18 15 h28 l3 37 q0.3 4 -4 4 h-26 q-4.3 0 -4 -4 Z" fill={c} />
        <rect x="18" y="12" width="28" height="5" rx="1" fill={d} />
        {[21, 25, 29, 33, 37, 41].map((x) => <rect key={x} x={x} y="12.5" width="1.2" height="4" fill="#fff" opacity=".25" />)}
        <rect x="16.5" y="38" width="31" height="6" fill={l} />
        <path d="M32 21 q8 3 4 13 q-9 -2 -4 -13 Z" fill="#5fa84f" />
        <path d="M32.5 23 q1.5 5 3 10" stroke="#2f6b26" strokeWidth=".9" fill="none" />
        <path d="M27 24 q-6 4 -2 10 q5 -3 2 -10 Z" fill="#7cc06b" />
      </>;
    case "soap":
      return <>
        <rect x="10" y="21" width="44" height="24" rx="9" fill={c} />
        <rect x="10" y="21" width="44" height="8" rx="6" fill="#fff" opacity=".2" />
        <ellipse cx="32" cy="33" rx="13" ry="7" fill={l} />
        <ellipse cx="32" cy="33" rx="8" ry="3.6" fill="#fff" opacity=".7" />
        <circle cx="47" cy="16" r="2.2" fill="#fff" stroke={c} strokeWidth="1" />
        <circle cx="52" cy="12" r="1.4" fill="#fff" stroke={c} strokeWidth="1" />
      </>;
    case "tube":
      return <>
        <path d="M8 23 l3 2 -3 2 3 2 -3 2 3 2 -3 2 3 2 -3 2 3 2 -3 2" stroke="#c9ced3" strokeWidth="1.5" fill="none" />
        <path d="M10 22 L44 25 L44 41 L10 44 Q8 33 10 22 Z" fill={l} stroke="#e2e6ea" />
        <path d="M10 30 L44 31 L44 36 L10 37 Z" fill={c} />
        <rect x="44" y="27" width="11" height="12" rx="2" fill={d} />
        <rect x="46" y="28.5" width="1.5" height="9" rx=".75" fill="#fff" opacity=".35" />
      </>;
  }
}

export const lookFor = (code: string) => LOOKS[code.split("-")[1]] ?? FALLBACK;

/** A drawn pack for the product line, with the pack size. */
export default function ProductTile({ code, pack, size = "md" }: { code: string; pack: string; size?: "sm" | "md" | "lg" }) {
  const look = lookFor(code);
  const box = { sm: "size-12 rounded-xl", md: "size-[88px] rounded-2xl", lg: "size-28 rounded-3xl" }[size];
  return (
    <div className={cx("relative flex shrink-0 items-center justify-center overflow-hidden", box)}
      style={{ background: `radial-gradient(circle at 30% 20%, #ffffff 0%, ${look.bg} 70%)` }} aria-hidden>
      <svg viewBox="0 0 64 64" className={size === "sm" ? "size-10" : "-mt-2 size-[82%]"}>
        <ellipse cx="32" cy="58" rx="19" ry="2.6" fill="#13201a" opacity=".1" />
        {art(look)}
      </svg>
      {size !== "sm" && (
        <span className="num absolute bottom-1.5 rounded-full bg-white/90 px-1.5 text-[10px] leading-4 font-bold text-ink shadow-sm">{pack}</span>
      )}
    </div>
  );
}
