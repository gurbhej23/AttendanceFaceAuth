import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import AppIntro from "./AppIntro";
import PageReveal from "./PageReveal";

/** Prevents double intro in React StrictMode; resets on every full page refresh. */
let introPlayedThisPageLoad = false;

interface AppBootstrapProps {
  children: React.ReactNode;
}

export default function AppBootstrap({ children }: AppBootstrapProps) {
  const completedRef = useRef(false);
  const [showIntro, setShowIntro] = useState(() => !introPlayedThisPageLoad);

  const handleIntroComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    introPlayedThisPageLoad = true;
    document.documentElement.setAttribute("data-app-ready", "true");
    setShowIntro(false);
  }, []);
  return (
    <AnimatePresence mode="wait">
      {showIntro ? (
        <AppIntro key="app-intro" onComplete={handleIntroComplete} />
      ) : (
        <PageReveal key="app-content">{children}</PageReveal>
      )}
    </AnimatePresence>
  );
}
