import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import CinematicThemeSwitcher from "@/components/ui/cinematic-theme-switcher";

export function Stage6HeaderControls({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      data-stage6-header-controls
      className={
        mobile
          ? "flex w-full items-center justify-between gap-3"
          : "flex shrink-0 items-center gap-2"
      }
    >
      <CinematicThemeSwitcher />
      <LanguageSwitcher mobile={mobile} />
    </div>
  );
}
