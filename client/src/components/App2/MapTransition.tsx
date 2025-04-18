import React from 'react';
import { motion } from 'framer-motion';

interface MapTransitionProps {
  isActive: boolean;
  children: React.ReactNode;
  onComplete?: () => void;
}

export function MapTransition({ isActive, children, onComplete }: MapTransitionProps) {
  // Animatievarianten voor de kaartcomponent
  const containerVariants = {
    initial: {
      opacity: 1,
      scale: 1,
      filter: "brightness(0.45) blur(0px)"
    },
    animate: {
      opacity: 1,
      scale: 1.2, // De kaart wordt groter
      filter: "brightness(1) blur(0px)", // De kaart wordt helderder
      transition: {
        duration: 1.2,
        ease: "easeInOut"
      }
    },
    exit: {
      opacity: 0,
      scale: 1.5,
      filter: "brightness(1) blur(4px)",
      transition: {
        duration: 0.5,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate={isActive ? "animate" : "initial"}
      exit="exit"
      onAnimationComplete={() => {
        if (isActive && onComplete) {
          onComplete();
        }
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}