import type { LucideIcon } from "lucide-react";

export type MobileLiquidMorphMenuItem = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
};

type MobileLiquidMorphMenuProps = {
  open: boolean;
  title: string;
  items: MobileLiquidMorphMenuItem[];
  origin?: "left" | "right";
};

export function MobileLiquidMorphMenu({
  open,
  title,
  items,
  origin = "left",
}: MobileLiquidMorphMenuProps) {
  if (!open) return null;

  return (
    <div className="px-4 pb-3" aria-hidden={!open}>
      <div
        className="relative overflow-hidden rounded-[24px] border border-black/10 bg-[#202124] shadow-[0_10px_28px_rgba(17,24,39,0.14)]"
        style={{ contain: "layout paint" }}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0 h-1 w-24 rounded-b-full bg-red-600 ${
            origin === "left" ? "left-5" : "right-5"
          }`}
        />

        <div className="px-4 pb-4 pt-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-white/55">
              {title}
            </p>
            <span className="h-px flex-1 bg-white/10" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {items.map((item, index) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`group flex min-h-11 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 text-left text-[12px] font-extrabold leading-4 tracking-[-0.01em] text-[#f7f1ed] transition-colors duration-150 active:bg-white/[0.12] motion-reduce:transition-none ${
                    items.length % 2 === 1 && index === items.length - 1 ? "col-span-2" : ""
                  }`}
                >
                  {Icon ? (
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-xl bg-white/[0.08] text-white/75">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
