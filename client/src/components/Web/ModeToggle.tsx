import * as React from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { MdDevices, MdSmartphone } from "react-icons/md";

export function ModeToggle() {
  const isMobile = useIsMobile();
  const [isWebMode, setIsWebMode] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Check if we're in web mode based on URL path
    const path = window.location.pathname;
    
    if (path.startsWith('/web')) {
      setIsWebMode(true);
    } else if (path.startsWith('/app')) {
      setIsWebMode(false);
    } else {
      // Fallback to localStorage for legacy URLs
      const storedPref = localStorage.getItem('useWebVersion');
      setIsWebMode(storedPref === 'true');
    }
  }, []);

  const toggleMode = () => {
    if (isWebMode === null) return;
    
    const newMode = !isWebMode;
    // Store preference and redirect
    localStorage.setItem('useWebVersion', newMode ? 'true' : 'false');
    
    // Get current path and determine target route
    const path = window.location.pathname;
    let targetPath: string;
    
    if (newMode) {
      // Switch to web view - replace /app with /web or add /web
      if (path.startsWith('/app/')) {
        targetPath = '/web/' + path.substring(5);
      } else if (path === '/app') {
        targetPath = '/web';
      } else {
        targetPath = '/web';
      }
    } else {
      // Switch to app view - replace /web with /app or add /app
      if (path.startsWith('/web/')) {
        targetPath = '/app/' + path.substring(5);
      } else if (path === '/web') {
        targetPath = '/app';
      } else {
        targetPath = '/app';
      }
    }
    
    // Navigate to new URL
    window.location.href = targetPath;
  };

  // Don't render if mode not determined yet or on mobile
  if (isWebMode === null || isMobile) {
    return null;
  }

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={toggleMode}
      className="fixed right-4 bottom-4 z-50 bg-background shadow-md flex items-center gap-2"
    >
      {isWebMode ? (
        <>
          <MdSmartphone className="h-4 w-4" />
          Mobiele weergave
        </>
      ) : (
        <>
          <MdDevices className="h-4 w-4" />
          Desktop weergave
        </>
      )}
    </Button>
  );
}

export default ModeToggle;