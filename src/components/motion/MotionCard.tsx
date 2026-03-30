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
      whileHover={disableHover ? undefined : { y: -2, boxShadow: "0 8px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -6px rgba(0,0,0,0.05)" }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
