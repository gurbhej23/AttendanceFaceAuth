import { motion, useReducedMotion } from "framer-motion";
import { routeReveal } from "../../motion/presets";

interface Props {
  children: React.ReactNode;
}

/** Fade + slide when navigating between authenticated app pages. */
export default function AnimatedPage({ children }: Props) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <motion.div
      className="min-h-screen will-change-transform"
      initial={routeReveal.initial}
      animate={routeReveal.animate}
      exit={routeReveal.exit}
      transition={routeReveal.transition}
    >
      {children}
    </motion.div>
  );
}
