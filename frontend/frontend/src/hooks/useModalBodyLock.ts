import { useEffect } from "react";

let lockCount = 0;

/** Hides sidebar/chat and locks scroll while any modal is open. */
export function useModalBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockCount += 1;
    document.body.classList.add("app-modal-open");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.classList.remove("app-modal-open");
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [active]);
}
