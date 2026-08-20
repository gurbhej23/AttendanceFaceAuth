import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import FloatingParticles from "./FloatingParticles";
import TypingText from "./TypingText";
import {
  EASE_IN_OUT,
  LOADER_DURATION_S,
  loaderExit,
} from "../../motion/presets";

const SITE_NAME = "Attendance Face Auth";

interface AppIntroProps {
  onComplete: () => void;
}

export default function AppIntro({ onComplete }: AppIntroProps) {
  const [phase, setPhase] = useState<"playing" | "exiting">("playing");
  const completedRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase("exiting"), LOADER_DURATION_S * 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleExitComplete = () => {
    if (phase === "exiting" && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  };

  return (
    <motion.div
      className="app-intro fixed inset-0 z-[200] flex items-center justify-center overflow-hidden will-change-transform text-white"
      style={{
        background: "linear-gradient(160deg, #020617 0%, #0b1220 45%, #111827 100%)",
      }}
      initial={{ opacity: 1 }}
      animate={phase === "exiting" ? loaderExit : { opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.65, ease: EASE_IN_OUT }}
      onAnimationComplete={handleExitComplete}
    >
      {/* Ambient glow */}
      <motion.div
        className="pointer-events-none absolute h-[min(70vw,520px)] w-[min(70vw,520px)] rounded-full will-change-transform"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.18) 0%, rgba(34,211,238,0.08) 35%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl will-change-transform"
        animate={{ x: [0, 18, 0], y: [0, -12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <FloatingParticles />

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Logo — Assemble / Fragment Reveal */}
        <motion.div
          className="relative will-change-transform"
          initial={{ opacity: 0, scale: 0.8, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE_IN_OUT }}
        >
          <div className="absolute inset-0 -m-4 rounded-[2rem] bg-blue-500/10 blur-2xl" />

          {/* Pulsing glow behind logo, fades in as fragments settle */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-cyan-400/20 blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0.6, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
          />

          {/* 3x3 fragment grid — each shows a slice of the logo, scattered then assembled */}
          <div className="relative h-[88px] w-[88px]">
            {Array.from({ length: 9 }).map((_, i) => {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const piece = 88 / 3;
              // Precomputed scatter offsets so the reveal looks deliberate, not random-jittery
              const scatter = [
                { x: -70, y: -60, r: -140 },
                { x: 10, y: -80, r: 120 },
                { x: 80, y: -55, r: -110 },
                { x: -90, y: 5, r: 160 },
                { x: 0, y: 0, r: 0 },
                { x: 90, y: 5, r: -160 },
                { x: -80, y: 60, r: 110 },
                { x: -10, y: 85, r: -120 },
                { x: 70, y: 65, r: 140 },
              ][i];
              return (
                <motion.div
                  key={i}
                  className="absolute rounded-[3px]"
                  style={{
                    width: piece,
                    height: piece,
                    left: col * piece,
                    top: row * piece,
                    backgroundImage: "url(/favicon.svg)",
                    backgroundSize: "88px 88px",
                    backgroundPosition: `-${col * piece}px -${row * piece}px`,
                    boxShadow: "0 0 6px 0 rgba(34,211,238,0.35)",
                  }}
                  initial={{ x: scatter.x, y: scatter.y, rotate: scatter.r, opacity: 0 }}
                  animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  transition={{
                    duration: 1.1,
                    ease: EASE_IN_OUT,
                    delay: 0.35 + (row + col) * 0.06,
                  }}
                />
              );
            })}
          </div>

          {/* Soft outer border settles in after assembly */}
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-[1.35rem] border border-cyan-300/40 shadow-2xl shadow-blue-500/20"
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE_IN_OUT, delay: 1.15 }}
          />
        </motion.div>

        {/* Site name — use intro-loader-text (not text-slate-*) so light theme stays readable */}
        <TypingText
          text={SITE_NAME}
          className="intro-loader-text mt-6 text-lg font-semibold tracking-[0.22em] uppercase sm:text-xl"
          startDelay={0.5}
        />

        {/* Loading line */}
        <div className="mt-8 h-px w-48 overflow-hidden rounded-full bg-white/10 sm:w-56">
          <motion.div
            className="h-full origin-left rounded-full bg-linear-to-r from-blue-500 via-cyan-400 to-blue-400 will-change-transform"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: LOADER_DURATION_S, ease: EASE_IN_OUT }}
          />
        </div>
      </div>
    </motion.div>
  );
}