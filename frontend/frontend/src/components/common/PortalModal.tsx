import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useModalBodyLock } from "../../hooks/useModalBodyLock";
import { modalCard, modalOverlay } from "../../motion/presets";

interface Props {
  open?: boolean;
  children: ReactNode;
  onClose?: () => void;
  cardClassName?: string;
}

/** Full-viewport modal portaled to document.body — above sidebar & chat. */
export default function PortalModal({
  open = true,
  children,
  onClose,
  cardClassName = "",
}: Props) {
  useModalBodyLock(open);
  const reducedMotion = useReducedMotion();

  const overlayMotion = reducedMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : modalOverlay;
  const cardMotion = reducedMotion
    ? { initial: false, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1 } }
    : modalCard;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="app-modal-overlay"
          className="app-modal-overlay"
          role="dialog"
          aria-modal="true"
          initial={overlayMotion.initial}
          animate={overlayMotion.animate}
          exit={overlayMotion.exit}
          transition={reducedMotion ? { duration: 0 } : modalOverlay.transition}
          onClick={
            onClose
              ? (e) => {
                  if (e.target === e.currentTarget) onClose();
                }
              : undefined
          }
        >
          <motion.div
            className={`app-modal-center ${cardClassName}`}
            initial={cardMotion.initial}
            animate={cardMotion.animate}
            exit={cardMotion.exit}
            transition={reducedMotion ? { duration: 0 } : modalCard.transition}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
