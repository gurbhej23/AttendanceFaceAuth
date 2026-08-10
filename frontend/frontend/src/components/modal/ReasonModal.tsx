import React from "react";
import PortalModal from "../common/PortalModal";
import Button from "../common/Button";

interface ReasonModalProps {
  open?: boolean;
  reason: string | null;
  onClose: () => void;
}

const ReasonModal: React.FC<ReasonModalProps> = ({
  open = true,
  reason,
  onClose,
}) => {
  return (
    <PortalModal open={open} onClose={onClose}>
      <div className="dash-modal-card w-full max-w-md rounded-4xl border border-white/10 bg-[#111827] p-8 shadow-2xl">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/20 flex items-center justify-center text-3xl mx-auto mb-5">
          📝
        </div>
        <h2 className="text-2xl text-white font-bold text-center mb-4">
          Full Reason
        </h2>
        <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 min-h-[100px] flex items-center justify-center">
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap break-words w-full text-left">
            {reason || "No reason provided."}
          </p>
        </div>
        <Button
          text="Close"
          onClick={onClose}
          className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-2xl font-semibold transition cursor-pointer"
        />
      </div>
    </PortalModal>
  );
};

export default ReasonModal;
