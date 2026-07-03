import { motion } from "framer-motion";
import { pageReveal } from "../../motion/presets";

interface PageRevealProps {
  children: React.ReactNode;
}

/** One-time reveal shell after the intro loader exits. */
export default function PageReveal({ children }: PageRevealProps) {
  return (
    <motion.div
      className="min-h-screen will-change-transform"
      initial={pageReveal.initial}
      animate={pageReveal.animate}
      transition={pageReveal.transition}
    >
      {children}
    </motion.div>
  );
}
