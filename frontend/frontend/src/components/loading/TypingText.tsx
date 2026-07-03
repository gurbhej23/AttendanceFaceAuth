import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface TypingTextProps {
  text: string;
  className?: string;
  startDelay?: number;
  charDelay?: number;
}

export default function TypingText({
  text,
  className = "",
  startDelay = 0.35,
  charDelay = 0.045,
}: TypingTextProps) {
  const [visible, setVisible] = useState("");

  useEffect(() => {
    setVisible("");
    let index = 0;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    const startId = window.setTimeout(() => {
      intervalId = setInterval(() => {
        index += 1;
        setVisible(text.slice(0, index));
        if (index >= text.length && intervalId) {
          clearInterval(intervalId);
        }
      }, charDelay * 1000);
    }, startDelay * 1000);

    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [text, startDelay, charDelay]);

  return (
    <motion.p
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: startDelay }}
    >
      {visible}
      <motion.span
        className="ml-0.5 inline-block w-[2px] translate-y-px bg-cyan-400/80"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        style={{ height: "1em" }}
        aria-hidden
      />
    </motion.p>
  );
}
