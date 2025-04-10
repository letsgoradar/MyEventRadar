import * as React from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";

const ResizablePanelGroup = ({ 
  children, 
  direction = "horizontal", 
  className, 
  ...props 
}: { 
  children: React.ReactNode;
  direction?: "horizontal" | "vertical";
  className?: string;
  [key: string]: any;
}) => {
  return (
    <PanelGroup
      direction={direction}
      className={cn(
        "flex h-full w-full",
        direction === "vertical" && "flex-col",
        className
      )}
      {...props}
    >
      {children}
    </PanelGroup>
  );
};

const ResizablePanel = ({ 
  children, 
  defaultSize = 50, 
  minSize = 20, 
  className, 
  ...props 
}: { 
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <Panel
      defaultSize={defaultSize}
      minSize={minSize}
      className={cn("relative h-full", className)}
      {...props}
    >
      {children}
    </Panel>
  );
};

const ResizableHandle = ({ 
  withHandle = false, 
  className, 
  ...props 
}: { 
  withHandle?: boolean;
  className?: string;
  [key: string]: any;
}) => {
  return (
    <PanelResizeHandle
      className={cn(
        "relative flex w-px items-center justify-center bg-border hover:bg-primary focus:bg-primary", 
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <svg 
            width="10" 
            height="10" 
            viewBox="0 0 10 10" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="h-2.5 w-2.5"
          >
            <circle cx="2" cy="2" r="1" fill="currentColor" />
            <circle cx="5" cy="2" r="1" fill="currentColor" />
            <circle cx="8" cy="2" r="1" fill="currentColor" />
            <circle cx="2" cy="5" r="1" fill="currentColor" />
            <circle cx="5" cy="5" r="1" fill="currentColor" />
            <circle cx="8" cy="5" r="1" fill="currentColor" />
            <circle cx="2" cy="8" r="1" fill="currentColor" />
            <circle cx="5" cy="8" r="1" fill="currentColor" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
          </svg>
        </div>
      )}
    </PanelResizeHandle>
  );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };