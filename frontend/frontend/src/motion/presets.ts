/** Shared motion tokens — Apple / Linear / Vercel style easing */
export const EASE_IN_OUT: [number, number, number, number] = [0.42, 0, 0.58, 1];

export const LOADER_DURATION_S = 2.5;
export const PAGE_REVEAL_MS = 800;
export const STAGGER_DELAY_S = 0.1;

export const loaderExit = {
  opacity: 0,
  scale: 0.96,
  filter: "blur(10px)",
};

export const pageReveal = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: PAGE_REVEAL_MS / 1000, ease: EASE_IN_OUT },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_DELAY_S,
      delayChildren: 0.12,
    },
  },
};

export const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: PAGE_REVEAL_MS / 1000, ease: EASE_IN_OUT },
  },
};

export const navDrop = {
  hidden: { opacity: 0, y: -24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: PAGE_REVEAL_MS / 1000, ease: EASE_IN_OUT },
  },
};

export const buttonPop = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE_IN_OUT },
  },
};

export const imageReveal = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: PAGE_REVEAL_MS / 1000, ease: EASE_IN_OUT },
  },
};

export const MODAL_MS = 220;

export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: MODAL_MS / 1000, ease: EASE_IN_OUT },
};

export const modalCard = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: { duration: MODAL_MS / 1000, ease: EASE_IN_OUT },
};

export const routeReveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: EASE_IN_OUT },
};

export const messageBubble = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: EASE_IN_OUT },
};

export const chatPanelSlide = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.98 },
  transition: { duration: 0.28, ease: EASE_IN_OUT },
};

export const chatWindowSlide = {
  initial: { opacity: 0, y: 20, x: 12 },
  animate: { opacity: 1, y: 0, x: 0 },
  exit: { opacity: 0, y: 12, x: 8 },
  transition: { duration: 0.26, ease: EASE_IN_OUT },
};

export const emptyStateReveal = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: EASE_IN_OUT },
};

export const toastEnter = {
  initial: { opacity: 0, x: 24, scale: 0.96 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 24, scale: 0.96 },
  transition: { duration: MODAL_MS / 1000, ease: EASE_IN_OUT },
};

export const sidebarOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: MODAL_MS / 1000, ease: EASE_IN_OUT },
};

export const sidebarDrawer = {
  initial: { x: "-100%" },
  animate: { x: 0 },
  exit: { x: "-100%" },
  transition: { duration: 0.3, ease: EASE_IN_OUT },
};
