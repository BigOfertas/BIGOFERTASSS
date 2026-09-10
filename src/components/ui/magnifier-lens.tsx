import React, { useRef } from "react";

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

const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";

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
  const overlayRef = useRef<HTMLDivElement>(null);

  const canUseLens = (event?: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window === "undefined" || isStatic) return false;
    if (event?.pointerType === "touch") return false;
    return window.matchMedia(FINE_POINTER_QUERY).matches;
  };

  const setLensVisible = (visible: boolean) => {
    if (overlayRef.current) overlayRef.current.style.opacity = visible ? "1" : "0";
  };

  const updateFocusPosition = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canUseLens(event)) return;

    const rect = boundsRef.current ?? event.currentTarget.getBoundingClientRect();
    boundsRef.current = rect;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    event.currentTarget.style.setProperty("--lens-x", `${x}px`);
    event.currentTarget.style.setProperty("--lens-y", `${y}px`);
  };

  const rootStyle = {
    "--lens-x": `${position.x}px`,
    "--lens-y": `${position.y}px`,
    contain: "paint",
  } as React.CSSProperties;

  const initiallyVisible = isStatic || hovering === true;

  return (
    <div
      className={`relative overflow-hidden ${!isStatic ? "cursor-none" : ""} ${className}`}
      style={rootStyle}
      onPointerEnter={(event) => {
        if (!canUseLens(event)) return;
        boundsRef.current = event.currentTarget.getBoundingClientRect();
        updateFocusPosition(event);
        setLensVisible(true);
        setHovering?.(true);
        isFocusing?.();
      }}
      onPointerLeave={() => {
        boundsRef.current = null;
        if (!isStatic) setLensVisible(false);
        setHovering?.(false);
      }}
      onPointerCancel={() => {
        boundsRef.current = null;
        if (!isStatic) setLensVisible(false);
        setHovering?.(false);
      }}
      onPointerMove={updateFocusPosition}
    >
      {children}

      <div
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-50"
        style={{
          opacity: initiallyVisible ? 1 : 0,
          willChange: "opacity, clip-path",
        }}
      >
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            clipPath: `circle(${lensSize / 2}px at var(--lens-x) var(--lens-y))`,
            WebkitClipPath: `circle(${lensSize / 2}px at var(--lens-x) var(--lens-y))`,
            willChange: "clip-path",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `scale3d(${zoomFactor}, ${zoomFactor}, 1)`,
              transformOrigin: "var(--lens-x) var(--lens-y)",
              willChange: "transform",
            }}
          >
            {children}
          </div>
        </div>

        <div
          className="absolute"
          style={{
            width: lensSize,
            height: lensSize,
            borderRadius: "50%",
            transform: `translate3d(calc(var(--lens-x) - ${lensSize / 2}px), calc(var(--lens-y) - ${lensSize / 2}px), 0)`,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2)",
            background:
              "radial-gradient(circle at center, transparent 60%, rgba(255, 255, 255, 0.1) 70%, rgba(255, 255, 255, 0.2) 80%, transparent 100%)",
            willChange: "transform",
          }}
        />
      </div>
    </div>
  );
};

export { Lens };
export default Lens;
