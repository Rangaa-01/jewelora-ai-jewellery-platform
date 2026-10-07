"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./use-reduced-motion";
import { cn } from "@/lib/utils";

interface SparkleProps {
  className?: string;
  /** Maximum simultaneous particles (capped at 60). */
  count?: number;
  color?: string;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

/**
 * Decorative canvas sparkle field. Paused when offscreen, when the tab is hidden and under
 * reduced motion (where it renders a static faint pattern instead). aria-hidden always.
 */
export function Sparkle({ className, count = 28, color = "#e4c77f" }: SparkleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const max = Math.min(count, 60);
    let particles: Particle[] = [];
    let raf = 0;
    let visible = true;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (): Particle => {
      const maxLife = 90 + Math.random() * 120;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.6 + Math.random() * 1.6,
        life: Math.random() * maxLife,
        maxLife,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.05 - Math.random() * 0.12,
      };
    };

    const drawStar = (p: Particle, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.r > 1.4) {
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillRect(p.x - p.r * 3, p.y - 0.3, p.r * 6, 0.6);
        ctx.fillRect(p.x - 0.3, p.y - p.r * 3, 0.6, p.r * 6);
      }
    };

    const renderStatic = () => {
      resize();
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < max; i++) drawStar(spawn(), 0.35);
    };

    const tick = () => {
      if (!visible) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;
        const t = p.life / p.maxLife;
        const alpha = Math.sin(Math.min(1, t) * Math.PI);
        drawStar(p, alpha * 0.9);
      }
      particles = particles.map((p) => (p.life >= p.maxLife || p.y < -4 ? spawn() : p));
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reduced) {
        renderStatic();
        return;
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(raf);

    resize();
    particles = Array.from({ length: max }, spawn);

    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting && document.visibilityState === "visible";
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) renderStatic();
    });
    ro.observe(canvas);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [count, color, reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    />
  );
}
