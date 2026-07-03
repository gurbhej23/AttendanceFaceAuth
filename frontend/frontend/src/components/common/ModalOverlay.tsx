import type { ReactNode } from "react";
import PortalModal from "./PortalModal";

interface Props {
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  cardClassName?: string;
}

/** @deprecated Use PortalModal directly */
export default function ModalOverlay({
  children,
  onClose,
  cardClassName = "",
}: Props) {
  return (
    <PortalModal onClose={onClose} cardClassName={cardClassName}>
      {children}
    </PortalModal>
  );
}
