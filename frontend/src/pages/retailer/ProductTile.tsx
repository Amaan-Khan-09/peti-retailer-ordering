import { Coffee, Cookie, Droplets, Package, WashingMachine } from "lucide-react";
import { cx } from "../../ui";

const LOOK: Record<string, { icon: typeof Cookie; tint: string }> = {
  Biscuits: { icon: Cookie, tint: "bg-[#f5ead8] text-[#8a5a1c]" },
  "Home care": { icon: WashingMachine, tint: "bg-[#e5eef9] text-[#1f5fae]" },
  Tea: { icon: Coffee, tint: "bg-[#ebf1e2] text-[#4d6b1f]" },
  "Personal care": { icon: Droplets, tint: "bg-[#f2e8f4] text-[#7a3d8a]" },
};

/** Product photos are not in the brief; a consistent category tile with the pack size stands in for them. */
export default function ProductTile({ category, pack, size = "md" }: { category: string; pack: string; size?: "sm" | "md" }) {
  const look = LOOK[category] ?? { icon: Package, tint: "bg-canvas text-muted" };
  return (
    <div className={cx("flex shrink-0 flex-col items-center justify-center rounded-2xl", look.tint, size === "md" ? "size-20" : "size-12")} aria-hidden>
      <look.icon className={size === "md" ? "size-8" : "size-5"} strokeWidth={1.6} />
      {size === "md" && <span className="mt-1 text-[11px] font-semibold">{pack}</span>}
    </div>
  );
}
