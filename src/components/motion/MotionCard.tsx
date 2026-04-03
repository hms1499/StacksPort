"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { staggerItem } from "./StaggerChildren";

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  disableHover?: boolean;
}

export default function MotionCard({ children, className }: MotionCardProps) {
  return (
    <motion.div
      variants={staggerItem}
      className={className}
    >
      {children}
    </motion.div>
  );
}
