import { Menu } from "lucide-react";
import Button from "./Button";

interface Props {
  onClick: () => void;
}

export default function MobileMenuButton({ onClick }: Props) {
  return (
    <Button
      type="button"
      onClick={onClick}
      text={<Menu size={22} />}
      unstyled
      className="fixed right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-900/90 p-0 text-white shadow-lg backdrop-blur-md transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:border-white/20 hover:bg-slate-800 active:scale-95 lg:hidden"
      aria-label="Open menu"
    />
  );
}
