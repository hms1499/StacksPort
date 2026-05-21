"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  /** Color accent for icon container + breathing rings. Defaults to brand accent. */
  accentColor?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  accentColor,
}: EmptyStateProps) {
  const color = accentColor ?? "var(--accent)";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      {/* Icon stack: breathing rings + container */}
      <div className="relative mb-5">
        {/* Outer breathing rings */}
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{ backgroundColor: color, opacity: 0.08 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0.10, 0, 0.10] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-2xl"
          style={{ backgroundColor: color, opacity: 0.06 }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.08, 0, 0.08] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
        />
        {/* Icon container */}
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
          }}
        >
          {icon}
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-base font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </motion.p>

      {/* Tiny accent underline — adds polish without text noise */}
      <motion.span
        aria-hidden
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 0.6 }}
        transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
        className="block h-px w-8 my-2 rounded-full origin-center"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-sm max-w-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        {description}
      </motion.p>

      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="mt-5"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
