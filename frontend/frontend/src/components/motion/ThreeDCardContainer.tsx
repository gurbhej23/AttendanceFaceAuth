import { useState, useCallback, useRef } from "react";
import { motion, useSpring } from "framer-motion";

interface ThreeDCardContainerProps {
  children: React.ReactNode;
  className?: string;
  maxDegrees?: number;
  depthZ?: number;
  onClick?: () => void;
}

export default function ThreeDCardContainer({
  children,
  className = "",
  maxDegrees = 8, 
  onClick,
}: ThreeDCardContainerProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, scale: 1, mouseXRatio: 0.5, mouseYRatio: 0.5 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mouseXRatio = mouseX / width;
    const mouseYRatio = mouseY / height;

    const xPct = mouseXRatio - 0.5;
    const yPct = mouseYRatio - 0.5;

    setTilt({
      rotateX: -yPct * maxDegrees,
      rotateY: xPct * maxDegrees,
      scale: 1.01,
      mouseXRatio,
      mouseYRatio,
    });
  }, [maxDegrees]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0, scale: 1, mouseXRatio: 0.5, mouseYRatio: 0.5 });
  }, []);

  const springConfig = { stiffness: 300, damping: 25 };
  const springRotateX = useSpring(tilt.rotateX, springConfig);
  const springRotateY = useSpring(tilt.rotateY, springConfig);
  const springScale = useSpring(tilt.scale, springConfig);

  // Dynamic light glare gradient calculation
  const glareX = tilt.mouseXRatio * 100;
  const glareY = tilt.mouseYRatio * 100;

  return (
    <div className="perspective-1000 w-full">
      <motion.div
        ref={cardRef}
        className={`relative transition-shadow duration-300 ${className}`}
        style={{
          rotateX: springRotateX,
          rotateY: springRotateY,
          scale: springScale,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
      >
        {/* Specular Light Reflection Glare */}
        <div
          className="pointer-events-none absolute inset-0 z-30 rounded-[36px] opacity-0 transition-opacity duration-300 hover:opacity-100"
          style={{
            background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.03) 45%, transparent 80%)`,
          }}
        />

        {/* Child Content - Fully Clickable */}
        <div className="relative z-10 pointer-events-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
