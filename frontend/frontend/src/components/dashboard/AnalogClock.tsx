import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface AnalogClockProps {
  className?: string;
  size?: number;
}

export default function AnalogClock({ className = "", size }: AnalogClockProps) {
  const [time, setTime] = useState(() => new Date());
  const requestRef = useRef<number>(0);

  // Smooth continuous time calculation using requestAnimationFrame
  useEffect(() => {
    let active = true;
    const update = () => {
      if (!active) return;
      setTime(new Date());
      requestRef.current = requestAnimationFrame(update);
    };
    requestRef.current = requestAnimationFrame(update);
    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Compute angles with continuous smooth sweeping for second hand
  const { hourDeg, minDeg, secDeg, isPm } = useMemo(() => {
    const ms = time.getMilliseconds();
    const s = time.getSeconds() + ms / 1000;
    const m = time.getMinutes() + s / 60;
    const h = (time.getHours() % 12) + m / 60;

    return {
      hourDeg: h * 30, // 360 / 12 = 30 deg/hr
      minDeg: m * 6,   // 360 / 60 = 6 deg/min
      secDeg: s * 6,   // 360 / 60 = 6 deg/sec
      isPm: time.getHours() >= 12,
    };
  }, [time]);

  // Subtle 3D Tilt / Parallax physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 220, mass: 0.5 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [10, -10]), springConfig);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // 12 numbers with exact coordinates
  const clockNumbers = useMemo(() => {
    const radius = 35; // percentage distance from center
    return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => {
      const angle = (num * 30 * Math.PI) / 180;
      const x = 50 + radius * Math.sin(angle);
      const y = 50 - radius * Math.cos(angle);
      const isMajor = num % 3 === 0;
      return { num, x, y, isMajor };
    });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`group relative select-none flex flex-col items-center justify-center ${className}`}
      style={{ perspective: 1000 }}
    >
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-blue-500/10 blur-lg transition-all duration-300 group-hover:bg-blue-400/20 group-hover:blur-xl dark:bg-cyan-500/10 dark:group-hover:bg-cyan-400/20" />

      {/* Main 3D Tilting Clock Body */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        whileHover={{ scale: 1.04 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative flex items-center justify-center rounded-full border border-slate-200/80 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-1.5 shadow-lg shadow-slate-200/50 backdrop-blur-2xl transition-colors duration-300 group-hover:border-blue-400/60 dark:border-white/20 dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-slate-950/95 dark:to-[#040814]/95 dark:shadow-xl dark:group-hover:border-cyan-400/40"
      >
        {/* Compact Dial Container */}
        <div
          className="relative aspect-square w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full border border-blue-500/20 bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#f8fafc_70%,#e2e8f0_100%)] shadow-[inset_0_2px_8px_rgba(59,130,246,0.12),inset_0_-2px_6px_rgba(0,0,0,0.06)] overflow-hidden dark:border-cyan-500/25 dark:bg-[radial-gradient(ellipse_at_center,#0e1a30_0%,#020617_75%,#000000_100%)] dark:shadow-[inset_0_2px_10px_rgba(6,182,212,0.18),inset_0_-2px_6px_rgba(0,0,0,0.85)]"
          style={{ width: size, height: size }}
        >
          {/* Inner decorative ring */}
          <div className="absolute inset-1.5 rounded-full border border-slate-300/40 dark:border-white/[0.05]" />

          {/* 12 Numbers */}
          {clockNumbers.map(({ num, x, y, isMajor }) => (
            <div
              key={num}
              className={`absolute -translate-x-1/2 -translate-y-1/2 font-sans leading-none select-none pointer-events-none ${isMajor
                ? "text-[9.5px] sm:text-[10.5px] text-blue-600 dark:text-cyan-300 font-black drop-shadow-xs dark:drop-shadow-[0_0_4px_rgba(6,182,212,0.6)]"
                : "text-[8px] sm:text-[9px] text-slate-700 dark:text-slate-200 font-bold"
                }`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
              }}
            >
              {num}
            </div>
          ))}

          {/* AM/PM Tag */}
          <div className="absolute left-1/2 bottom-[20%] -translate-x-1/2 pointer-events-none">
            <span className="rounded-full bg-blue-100 border border-blue-300 px-1 py-0.2 text-[6.5px] font-extrabold text-blue-700 font-mono tracking-wider dark:bg-cyan-500/20 dark:border-cyan-500/30 dark:text-cyan-300">
              {isPm ? "PM" : "AM"}
            </span>
          </div>

          {/* ── HOUR HAND ── */}
          <div
            className="absolute left-1/2 top-1/2 origin-bottom transition-transform will-change-transform"
            style={{
              transform: `translate(-50%, -100%) rotate(${hourDeg}deg)`,
              height: "23%",
              width: "2.5px",
            }}
          >
            <div className="h-full w-full rounded-full bg-gradient-to-t from-slate-700 via-slate-800 to-slate-900 shadow-sm dark:bg-gradient-to-t dark:from-slate-300 dark:via-white dark:to-slate-200 dark:shadow-[0_0_5px_rgba(0,0,0,0.9)]" />
          </div>

          {/* ── MINUTE HAND ── */}
          <div
            className="absolute left-1/2 top-1/2 origin-bottom transition-transform will-change-transform"
            style={{
              transform: `translate(-50%, -100%) rotate(${minDeg}deg)`,
              height: "33%",
              width: "1.8px",
            }}
          >
            <div className="h-full w-full rounded-full bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-500 shadow-sm dark:bg-gradient-to-t dark:from-cyan-400 dark:via-cyan-200 dark:to-white dark:shadow-[0_0_8px_rgba(6,182,212,0.7)]" />
          </div>

          {/* ── SECOND HAND (Continuous Smooth Sweep) ── */}
          <div
            className="absolute left-1/2 top-1/2 origin-bottom will-change-transform"
            style={{
              transform: `translate(-50%, -100%) rotate(${secDeg}deg)`,
              height: "39%",
              width: "1.2px",
            }}
          >
            {/* Needle */}
            <div className="h-full w-full rounded-full bg-gradient-to-t from-orange-500 via-amber-400 to-rose-500 shadow-sm dark:from-orange-500 dark:via-amber-400 dark:to-cyan-300 dark:shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
            {/* Counterweight */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 h-1.5 w-0.8 rounded-full bg-orange-500/80 dark:bg-amber-500/80" />
          </div>

          {/* Center Jewel / Cap */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-white bg-gradient-to-tr from-blue-500 to-cyan-500 shadow-sm z-20 flex items-center justify-center dark:border-slate-900 dark:bg-gradient-to-tr dark:from-cyan-400 dark:to-blue-500 dark:shadow-[0_0_6px_rgba(6,182,212,0.9)]">
            <div className="h-0.8 w-0.8 rounded-full bg-white opacity-90" />
          </div>

          {/* Subtle Glass Glare */}
          <div className="pointer-events-none absolute -inset-full bg-gradient-to-tr from-white/40 via-transparent to-transparent rotate-45 dark:from-white/[0.06]" />
        </div>
      </motion.div>
    </motion.div>
  );
}
