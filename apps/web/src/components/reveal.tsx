"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

const shown = { opacity: 1, y: 0 };
const hidden = { opacity: 0, y: 18 };

/**
 * Fades a section in as it scrolls into view. The server HTML is always visible: the
 * fade is armed only after hydration, and only for sections still below the fold, so
 * slow or blocked JavaScript costs the animation, never the content.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: "some", margin: "0px 0px -12% 0px" });
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (reduce || !el) return;
    if (el.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, [reduce]);

  const waiting = armed && !inView;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={waiting ? hidden : shown}
      transition={waiting ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}
