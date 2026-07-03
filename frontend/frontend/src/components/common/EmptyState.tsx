import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { emptyStateReveal } from "../../motion/presets";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  className = "",
}: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={`py-12 text-center ${className}`.trim()}
      initial={emptyStateReveal.initial}
      animate={emptyStateReveal.animate}
      transition={emptyStateReveal.transition}
    >
      {icon && (
        <motion.span
          className="empty-state-icon mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03]"
          animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
          transition={
            reducedMotion
              ? undefined
              : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
        >
          {icon}
        </motion.span>
      )}
      <p className="text-sm font-medium text-slate-400">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </motion.div>
  );
}
