import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AssistantChat } from "./AssistantChat";

interface AssistantButtonProps {
  variant?: "floating" | "header";
}

export function AssistantButton({ variant = "floating" }: AssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (variant === "header") {
    return (
      <>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          className="h-10 rounded-full flex items-center gap-2 px-4"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="hidden md:inline">AI</span>
        </Button>

        <AssistantChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        size="icon"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <AssistantChat isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

export default AssistantButton;
