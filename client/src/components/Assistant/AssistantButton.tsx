import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { AssistantChat } from "./AssistantChat";

export function AssistantButton() {
  const [isOpen, setIsOpen] = useState(false);

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
