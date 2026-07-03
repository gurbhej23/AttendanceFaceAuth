import { motion, type HTMLMotionProps } from "framer-motion";
import {
  buttonPop,
  imageReveal,
  messageBubble,
  navDrop,
  staggerContainer,
  staggerItem,
} from "../../motion/presets";

type MotionDivProps = HTMLMotionProps<"div">;

export function StaggerGroup({
  children,
  className = "",
  ...rest
}: MotionDivProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({ children, className = "", ...rest }: MotionDivProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

export function MotionNav({ children, className = "", ...rest }: MotionDivProps) {
  return (
    <motion.div
      variants={navDrop}
      initial="hidden"
      animate="visible"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionCard({ children, className = "", ...rest }: MotionDivProps) {
  return (
    <motion.div variants={staggerItem} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

export function MotionButton({ children, className = "", ...rest }: MotionDivProps) {
  return (
    <motion.div
      variants={buttonPop}
      initial="hidden"
      animate="visible"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionImage({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <motion.img
      src={src}
      alt={alt}
      variants={imageReveal}
      className={`will-change-transform ${className}`.trim()}
      loading="lazy"
    />
  );
}

export function MotionMessageBubble({
  children,
  className = "",
  ...rest
}: MotionDivProps) {
  return (
    <motion.div
      initial={messageBubble.initial}
      animate={messageBubble.animate}
      transition={messageBubble.transition}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
