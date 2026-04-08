"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { staggerItem } from "./StaggerChildren";

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  disableHover?: boolean;
}

export default function MotionCard({ children, className, disableHover }: MotionCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={disableHover ? undefined : {
        borderColor: "var(--border-default)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
