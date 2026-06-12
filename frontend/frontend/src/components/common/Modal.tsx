import Button from "../common/Button";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export default function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-5">
      <div className="bg-slate-800 p-8 rounded-3xl w-full max-w-md border border-slate-700">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl text-white font-bold">{title}</h2>

          <Button
            text="✕"
            onClick={onClose}
            unstyled
            className="text-xl text-slate-400 hover:text-white"
          />
        </div>

        {children}
      </div>
    </div>
  );
}
