import { useCallback, useState, type MouseEvent } from "react";

export const springConfig3D = { stiffness: 300, damping: 24, mass: 0.8 };

export function use3DTilt(maxDegrees = 12) {
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, scale: 1 });

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;

    setTilt({
      rotateX: -yPct * maxDegrees,
      rotateY: xPct * maxDegrees,
      scale: 1.02,
    });
  }, [maxDegrees]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0, scale: 1 });
  }, []);

  return { tilt, handleMouseMove, handleMouseLeave };
}
