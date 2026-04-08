import type { Transition, Variants } from "framer-motion";

// ── Shared easing ──
export const easings = {
  snappy: [0.22, 1, 0.36, 1] as [number, number, number, number],
  smooth: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

// ── Page transition ──
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
};

export const pageSpring: Transition = {
  duration: 0.25,
  ease: easings.snappy,
};

// ── Stagger container ──
export function staggerContainer(staggerDelay = 0.05): Variants {
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: staggerDelay },
    },
  };
}

// ── Stagger item ──
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easings.snappy },
  },
};

// ── Hover presets (for whileHover/whileTap) ──
export const hoverScale = {
  whileHover: { scale: 1.015 },
  whileTap: { scale: 0.985 },
  transition: { duration: 0.15 },
};

export const hoverScaleSubtle = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15 },
};

// ── Modal / Overlay ──
export const modalOverlay: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContent: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const modalTransition: Transition = {
  duration: 0.2,
  ease: easings.smooth,
};

// ── Dropdown ──
export const dropdown: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const dropdownTransition: Transition = {
  duration: 0.15,
  ease: easings.smooth,
};

// ── Sidebar collapse spring ──
export const sidebarSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};
