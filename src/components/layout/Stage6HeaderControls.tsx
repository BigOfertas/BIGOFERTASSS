import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import SwitchToggleThemeDemo from "@/components/ui/toggle-theme";

export function Stage6HeaderControls({ mobile = false }: { mobile?: boolean }) {
  if (mobile) {
    return (
      <div
        data-stage6-header-controls
        data-mobile-header-controls
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5"
      >
        <LanguageSwitcher mobile />
        <div className="flex h-12 items-center justify-center rounded-2xl border border-border bg-background/80 px-2 shadow-sm backdrop-blur-sm">
          <SwitchToggleThemeDemo />
        </div>
      </div>
    );
  }

  return (
    <div data-stage6-header-controls className="flex shrink-0 items-center gap-2">
      <div className="flex h-11 items-center rounded-2xl border border-border bg-background/80 px-1.5 shadow-sm backdrop-blur-sm">
        <SwitchToggleThemeDemo />
      </div>
      <LanguageSwitcher />
    </div>
  );
}
