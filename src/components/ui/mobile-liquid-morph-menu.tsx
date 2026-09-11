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
  return (
    <div
      className={`grid px-4 transition-[grid-template-rows,opacity,padding-bottom] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        open
          ? "grid-rows-[1fr] pb-3 opacity-100"
          : "pointer-events-none grid-rows-[0fr] pb-0 opacity-0"
      }`}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={`relative overflow-hidden rounded-[24px] border border-black/10 bg-[#202124] shadow-[0_10px_28px_rgba(17,24,39,0.14)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-2 scale-[0.985] opacity-0"
          }`}
          style={{ contain: "layout paint" }}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0 h-1 w-24 rounded-b-full bg-red-600 transition-[width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              origin === "left" ? "left-5" : "right-5"
            } ${open ? "w-24 opacity-100" : "w-10 opacity-0"}`}
          />

          <div className="px-4 pb-4 pt-4">
            <div className="mb-3 flex items-center gap-3 px-1">
              <p
                className={`text-[11px] font-black uppercase tracking-[0.15em] text-white/55 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                  open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
              >
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
                    tabIndex={open ? 0 : -1}
                    className={`group flex min-h-11 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 text-left text-[12px] font-extrabold leading-4 tracking-[-0.01em] text-[#f7f1ed] transition-[transform,opacity,background-color] duration-200 ease-out active:scale-[0.985] active:bg-white/[0.12] motion-reduce:transition-none ${
                      open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                    } ${
                      items.length % 2 === 1 && index === items.length - 1 ? "col-span-2" : ""
                    }`}
                    style={{ transitionDelay: open ? `${Math.min(index, 6) * 18 + 45}ms` : "0ms" }}
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
    </div>
  );
}
