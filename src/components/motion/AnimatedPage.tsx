"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { pageTransition, pageSpring } from "@/lib/animations";

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

export default function AnimatedPage({ children, className }: AnimatedPageProps) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageSpring}
      className={className}
    >
      {children}
    </motion.div>
  );
}
