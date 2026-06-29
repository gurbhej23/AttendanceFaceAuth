import { useEffect, useRef, useState } from "react";
import Button from "../common/Button";

const LOGOUT_DELAY_MS = 1000;

interface LogOutProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

function LogOutModal({ open, onClose, onLogout }: LogOutProps) {
  const [loggingOut, setLoggingOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setLoggingOut(false);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [open]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleLogout = () => {
    if (loggingOut) return;
    setLoggingOut(true);
    timerRef.current = setTimeout(() => {
      onLogout();
    }, LOGOUT_DELAY_MS);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-99 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-busy={loggingOut}
        aria-labelledby="logout-modal-title"
      >
        {loggingOut ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div
              className="h-12 w-12 animate-spin rounded-full border-2 border-slate-700 border-t-red-400"
              aria-hidden
            />
            <h2
              id="logout-modal-title"
              className="mt-5 text-lg font-semibold text-white"
            >
              Signing you out…
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Please wait a moment
            </p>
          </div>
        ) : (
          <>
            <h2 id="logout-modal-title" className="text-xl font-bold text-white">
              👋 Leaving so soon?
            </h2>

            <p className="mt-3 text-slate-300">
              You&apos;re about to sign out from Attendance Face Auth.
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Any unsaved changes may be lost.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                text="Stay Logged In"
                onClick={onClose}
                className="bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
              />

              <Button
                text="Logout"
                onClick={handleLogout}
                className="bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default LogOutModal;
