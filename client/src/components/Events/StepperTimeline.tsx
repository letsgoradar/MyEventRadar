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
    <div className="w-full py-2">
      {/* Stap labels */}
      <div className="flex justify-between mb-3">
        {steps.map((step) => (
          <div 
            key={step.id} 
            className={cn(
              "flex flex-col items-center text-center cursor-pointer transition-colors",
              {
                "text-primary font-medium": currentStep === step.id,
                "text-muted-foreground": currentStep !== step.id,
                "text-primary/80": currentStep > step.id
              }
            )}
            onClick={() => onStepClick && onStepClick(step.id)}
          >
            <span className="text-sm truncate w-16">{step.title}</span>
          </div>
        ))}
      </div>

      {/* Stap indicators en voortgangslijn */}
      <div className="relative flex items-center w-full">
        {/* Achtergrond lijn (volledige breedte) */}
        <div className="absolute w-full h-1 bg-muted"></div>

        {/* Voortgangslijn (dynamische breedte) */}
        <motion.div 
          className="absolute h-1 bg-primary"
          style={{ 
            width: `${(Math.max(0.5, currentStep - 1) / (steps.length - 1)) * 100}%`,
            originX: 0 
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        />

        {/* Stap indicators */}
        <div className="relative flex justify-between w-full">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => onStepClick && onStepClick(step.id)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full border-2 transition-all",
                {
                  "bg-white border-muted-foreground": currentStep < step.id,
                  "bg-primary border-primary text-primary-foreground": currentStep === step.id,
                  "bg-primary border-primary text-primary-foreground": currentStep > step.id
                }
              )}
            >
              {currentStep > step.id ? (
                <Check className="h-4 w-4 text-white" />
              ) : (
                <span className="text-xs">{step.id}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StepperTimeline;