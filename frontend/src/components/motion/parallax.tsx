"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "./use-reduced-motion";

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  /** Vertical travel in px across the element's scroll through the viewport. */
  offset?: number;
  /** -1 moves against scroll, 1 moves with it. */
  direction?: 1 | -1;
}

export function Parallax({ children, className, offset = 60, direction = -1 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [offset * direction, -offset * direction]);
  return (
    <motion.div
      ref={ref}
      className={className}
      style={reduced ? undefined : { y, willChange: "transform" }}
    >
      {children}
    </motion.div>
  );
}
