import Button from "./Button";
import PortalModal from "./PortalModal";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export default function Modal({ title, children, onClose }: ModalProps) {
  return (
    <PortalModal onClose={onClose} cardClassName="max-w-md">
      <div className="w-full rounded-3xl border border-slate-700 bg-slate-800 p-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <Button
            text="✕"
            onClick={onClose}
            unstyled
            className="text-xl text-slate-400 hover:text-white"
          />
        </div>
        {children}
      </div>
    </PortalModal>
  );
}
