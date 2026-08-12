import { motion, useSpring } from "framer-motion";
import { springConfig3D, use3DTilt } from "./motion3dUtils";

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
