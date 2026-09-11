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
      className={`grid overflow-hidden px-4 transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        open
          ? "mb-3 grid-rows-[1fr] opacity-100"
          : "mb-0 grid-rows-[0fr] opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <div className="min-h-0">
        <div className="relative overflow-hidden rounded-[26px] border border-black/10 bg-red-600 shadow-[0_18px_45px_rgba(17,24,39,0.18)]">
          <div
            aria-hidden="true"
            className={`absolute top-0 h-[460px] w-[460px] rounded-full bg-[#242424] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
              origin === "left" ? "-left-52" : "-right-52"
            } ${open ? "scale-100" : "scale-0"}`}
          />

          <div className="relative z-10 px-4 pb-4 pt-3.5">
            <div className="mb-3 flex items-center justify-between gap-4 px-1">
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
                    tabIndex={open ? 0 : -1}
                    className={`group flex min-h-11 items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 text-left text-[12px] font-extrabold leading-4 tracking-[-0.01em] text-[#f7f1ed] transition duration-200 active:scale-[0.98] active:bg-white/10 motion-reduce:transition-none ${
                      items.length % 2 === 1 && index === items.length - 1
                        ? "col-span-2"
                        : ""
                    }`}
                  >
                    {Icon ? (
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-xl bg-white/10 text-white/85">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <span
                      className="h-1.5 w-1.5 flex-none rounded-full bg-red-500 opacity-0 transition-opacity group-active:opacity-100"
                      aria-hidden="true"
                    />
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
