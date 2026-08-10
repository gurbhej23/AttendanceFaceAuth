import { useState, useCallback } from "react";
import { motion, useSpring } from "framer-motion";

export const springConfig3D = { stiffness: 300, damping: 24, mass: 0.8 };

export function use3DTilt(maxDegrees = 12) {
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, scale: 1 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = (mouseX / width) - 0.5;
    const yPct = (mouseY / height) - 0.5;

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

interface Card3DProps {
  children: React.ReactNode;
  className?: string;
  maxDegrees?: number;
  onClick?: () => void;
}

export function Card3D({ children, className = "", maxDegrees = 10, onClick }: Card3DProps) {
  const { tilt, handleMouseMove, handleMouseLeave } = use3DTilt(maxDegrees);

  const springX = useSpring(tilt.rotateX, springConfig3D);
  const springY = useSpring(tilt.rotateY, springConfig3D);
  const springScale = useSpring(tilt.scale, springConfig3D);

  return (
    <div className="perspective-1000">
      <motion.div
        className={`preserve-3d transition-shadow duration-300 ${className}`}
        style={{
          rotateX: springX,
          rotateY: springY,
          scale: springScale,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
      >
        {children}
      </motion.div>
    </div>
  );
}
