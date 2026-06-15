import Button from "../common/Button";

interface LogOutProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

function LogOutModal({ open, onClose, onLogout }: LogOutProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">👋 Leaving so soon?</h2>

        <p className="mt-3 text-slate-300">
          You're about to sign out from Attendance Face Auth.
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
            onClick={onLogout}
            className="bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          />
        </div>
      </div>
    </div>
  );
}

export default LogOutModal;
