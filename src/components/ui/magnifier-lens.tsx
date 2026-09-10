import React, { useEffect, useRef, useState } from "react";

interface LensProps {
  children: React.ReactNode;
  zoomFactor?: number;
  lensSize?: number;
  position?: {
    x: number;
    y: number;
  };
  isStatic?: boolean;
  isFocusing?: () => void;
  hovering?: boolean;
  setHovering?: (hovering: boolean) => void;
  className?: string;
}

const Lens: React.FC<LensProps> = ({
  children,
  zoomFactor = 2,
  lensSize = 150,
  isStatic = false,
  position = { x: 200, y: 150 },
  isFocusing,
  hovering,
  setHovering,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localIsHovering, setLocalIsHovering] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 100, y: 100 });
  const isHovering = hovering !== undefined ? hovering : localIsHovering;
  const setIsHovering = setHovering || setLocalIsHovering;

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!canHover || isStatic) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  const focusPosition = isStatic ? position : mousePosition;
  const showLens = isStatic || (canHover && isHovering);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${canHover && !isStatic ? "cursor-none" : ""} ${className}`}
      onMouseEnter={() => {
        if (!canHover || isStatic) return;
        setIsHovering(true);
        isFocusing?.();
      }}
      onMouseLeave={() => {
        if (!isStatic) setIsHovering(false);
      }}
      onMouseMove={handleMouseMove}
    >
      {children}

      {showLens ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50">
          <div
            className="absolute inset-0 overflow-hidden animate-in fade-in zoom-in-50 duration-300 motion-reduce:animate-none"
            style={{
              maskImage: `radial-gradient(circle ${lensSize / 2}px at ${focusPosition.x}px ${focusPosition.y}px, black 100%, transparent 100%)`,
              WebkitMaskImage: `radial-gradient(circle ${lensSize / 2}px at ${focusPosition.x}px ${focusPosition.y}px, black 100%, transparent 100%)`,
              transformOrigin: `${focusPosition.x}px ${focusPosition.y}px`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${zoomFactor})`,
                transformOrigin: `${focusPosition.x}px ${focusPosition.y}px`,
              }}
            >
              {children}
            </div>
          </div>

          <div
            className="absolute animate-in fade-in zoom-in-50 duration-300 motion-reduce:animate-none"
            style={{
              left: focusPosition.x - lensSize / 2,
              top: focusPosition.y - lensSize / 2,
              width: lensSize,
              height: lensSize,
              borderRadius: "50%",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2)",
              background:
                "radial-gradient(circle at center, transparent 60%, rgba(255, 255, 255, 0.1) 70%, rgba(255, 255, 255, 0.2) 80%, transparent 100%)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
};

export { Lens };
export default Lens;
