import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Button from "./Button";
import {
  clearAutoLockTimer,
  isAppLockEnabled,
  scheduleAutoLock,
  setAppLockEnabled,
  shouldShowLockScreen,
  tryBiometricUnlock,
  onAppBackgrounded,
} from "../../utils/biometricLock";
import { modalCard, modalOverlay } from "../../motion/presets";
import { Fingerprint } from "lucide-react";

export default function BiometricGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => shouldShowLockScreen());
  const [error, setError] = useState("");
  const reducedMotion = useReducedMotion();

  const syncLockState = useCallback(() => {
    setLocked(shouldShowLockScreen());
  }, []);

  useEffect(() => {
    if (locked) {
      document.body.classList.add("app-modal-open");
      document.body.style.overflow = "hidden";
    } else {
      document.body.classList.remove("app-modal-open");
      document.body.style.overflow = "";
    }
    return () => {
      document.body.classList.remove("app-modal-open");
      document.body.style.overflow = "";
    };
  }, [locked]);

  useEffect(() => {
    const onLockRequired = () => setLocked(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        onAppBackgrounded();
      } else {
        syncLockState();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        onAppBackgrounded();
        syncLockState();
      }
    };

    window.addEventListener("app-lock-required", onLockRequired);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", syncLockState);

    return () => {
      window.removeEventListener("app-lock-required", onLockRequired);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", syncLockState);
    };
  }, [syncLockState]);

  useEffect(() => {
    if (locked || !isAppLockEnabled()) {
      clearAutoLockTimer();
      return;
    }

    const resetIdle = () => scheduleAutoLock();
    resetIdle();

    const events = ["click", "keydown", "touchstart", "mousemove", "scroll"] as const;
    events.forEach((event) =>
      window.addEventListener(event, resetIdle, { passive: true }),
    );

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdle));
      clearAutoLockTimer();
    };
  }, [locked]);

  const unlock = async () => {
    setError("");
    const ok = await tryBiometricUnlock();
    if (ok) {
      setLocked(false);
    } else {
      setError("Unlock failed. Try again or disable app lock in Profile.");
    }
  };

  const lockScreen = createPortal(
    <AnimatePresence>
      {locked && (
        <motion.div
          key="app-lock-overlay"
          className="app-modal-overlay app-lock-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="App locked"
          initial={reducedMotion ? false : modalOverlay.initial}
          animate={reducedMotion ? { opacity: 1 } : modalOverlay.animate}
          exit={modalOverlay.exit}
          transition={modalOverlay.transition}
        >
          <motion.div
            className="app-modal-center max-w-sm"
            initial={reducedMotion ? false : modalCard.initial}
            animate={reducedMotion ? { opacity: 1, scale: 1 } : modalCard.animate}
            exit={modalCard.exit}
            transition={modalCard.transition}
          >
            <div className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
              <Fingerprint className="mx-auto mb-4 h-12 w-12 text-blue-400" />
              <h2 className="mb-2 text-xl font-bold text-white">App locked</h2>
              <p className="mb-6 text-sm text-slate-400">
                Use device biometrics to continue
              </p>
              {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
              <Button
                text="Unlock"
                onClick={unlock}
                className="mb-3 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white cursor-pointer"
              />
              <button
                type="button"
                onClick={() => {
                  setAppLockEnabled(false);
                  setLocked(false);
                }}
                className="text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                Disable app lock
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );

  return (
    <>
      {children}
      {lockScreen}
    </>
  );
}
