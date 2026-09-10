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
  const boundsRef = useRef<DOMRect | null>(null);
  const focusRef = useRef({ x: 100, y: 100 });
  const [localIsHovering, setLocalIsHovering] = useState(false);
  const [canHover, setCanHover] = useState(false);
  const isHovering = hovering !== undefined ? hovering : localIsHovering;
  const setIsHovering = setHovering || setLocalIsHovering;

  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setCanHover(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const updateFocusPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canHover || isStatic) return;

    const rect = boundsRef.current ?? event.currentTarget.getBoundingClientRect();
    boundsRef.current = rect;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    focusRef.current = { x, y };
    event.currentTarget.style.setProperty("--lens-x", `${x}px`);
    event.currentTarget.style.setProperty("--lens-y", `${y}px`);
  };

  const showLens = isStatic || (canHover && isHovering);
  const focus = isStatic ? position : focusRef.current;
  const rootStyle = {
    "--lens-x": `${focus.x}px`,
    "--lens-y": `${focus.y}px`,
  } as React.CSSProperties;

  return (
    <div
      className={`relative overflow-hidden ${canHover && !isStatic ? "cursor-none" : ""} ${className}`}
      style={rootStyle}
      onPointerEnter={(event) => {
        if (!canHover || isStatic) return;
        boundsRef.current = event.currentTarget.getBoundingClientRect();
        updateFocusPosition(event);
        setIsHovering(true);
        isFocusing?.();
      }}
      onPointerLeave={() => {
        boundsRef.current = null;
        if (!isStatic) setIsHovering(false);
      }}
      onPointerCancel={() => {
        boundsRef.current = null;
        if (!isStatic) setIsHovering(false);
      }}
      onPointerMove={updateFocusPosition}
    >
      {children}

      {showLens ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-50">
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              maskImage: `radial-gradient(circle ${lensSize / 2}px at var(--lens-x) var(--lens-y), black 100%, transparent 100%)`,
              WebkitMaskImage: `radial-gradient(circle ${lensSize / 2}px at var(--lens-x) var(--lens-y), black 100%, transparent 100%)`,
              transformOrigin: "var(--lens-x) var(--lens-y)",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                transform: `scale(${zoomFactor})`,
                transformOrigin: "var(--lens-x) var(--lens-y)",
              }}
            >
              {children}
            </div>
          </div>

          <div
            className="absolute"
            style={{
              left: `calc(var(--lens-x) - ${lensSize / 2}px)`,
              top: `calc(var(--lens-y) - ${lensSize / 2}px)`,
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
