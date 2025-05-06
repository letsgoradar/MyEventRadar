import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

type Step = {
  id: number;
  title: string;
};

interface StepperTimelineProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepId: number) => void;
}

export function StepperTimeline({ 
  steps, 
  currentStep, 
  onStepClick 
}: StepperTimelineProps) {
  return (
    <div className="w-full py-4 px-2">
      {/* Stap indicators zonder zichtbare lijn */}
      <div className="relative flex items-center w-full mb-3">
        {/* De voortgangslijn en achtergrondlijn zijn nu onzichtbaar maar behouden de layout */}
        <div className="absolute w-full h-1 opacity-0"></div>
        <motion.div 
          className="absolute h-1 opacity-0"
          style={{ 
            width: `${(Math.max(0.5, currentStep - 1) / (steps.length - 1)) * 100}%`,
            originX: 0 
          }}
        />

        {/* Stap indicators */}
        <div className="relative flex justify-between w-full">
          {steps.map((step) => {
            // Bepaal de status van elke stap
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const isPending = currentStep < step.id;
            
            return (
              <div key={step.id} className="flex flex-col items-center">
                <button
                  onClick={() => onStepClick && onStepClick(step.id)}
                  className={cn(
                    "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 shadow-sm border-2",
                    {
                      // Voor nog niet bereikte stappen
                      "bg-background border-muted hover:border-muted-foreground": isPending,
                      
                      // Voor actieve stap
                      "bg-primary border-primary text-primary-foreground scale-110 shadow": isActive,
                      
                      // Voor voltooide stappen
                      "bg-primary border-primary text-primary-foreground": isCompleted
                    }
                  )}
                >
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Check className="h-5 w-5 text-white" />
                    </motion.div>
                  ) : (
                    <span className={cn(
                      "text-sm font-medium",
                      {
                        "text-muted-foreground": isPending,
                        "text-white": isActive || isCompleted
                      }
                    )}>
                      {step.id}
                    </span>
                  )}
                  
                  {/* Pulserende ring rond actieve stap */}
                  {isActive && (
                    <motion.div
                      className="absolute -inset-1 rounded-full border border-primary opacity-70"
                      animate={{ opacity: [0.2, 0.5, 0.2] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </button>
                
                {/* Stap naam */}
                <span 
                  className={cn(
                    "text-xs mt-2 font-medium truncate w-16 text-center",
                    {
                      "text-muted-foreground": isPending,
                      "text-primary": isActive,
                      "text-primary/80": isCompleted
                    }
                  )}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default StepperTimeline;