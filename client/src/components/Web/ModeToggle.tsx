import * as React from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { MdDevices, MdSmartphone } from "react-icons/md";

export function ModeToggle() {
  const isMobile = useIsMobile();
  const [isWebMode, setIsWebMode] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Check if we're in web mode (from URL or localStorage)
    const urlParams = new URLSearchParams(window.location.search);
    const webParam = urlParams.get('web');
    
    if (webParam !== null) {
      // URL parameter takes precedence
      setIsWebMode(webParam === 'true');
    } else {
      // Fallback to localStorage
      const storedPref = localStorage.getItem('useWebVersion');
      setIsWebMode(storedPref === 'true');
    }
  }, []);

  const toggleMode = () => {
    if (isWebMode === null) return;
    
    const newMode = !isWebMode;
    // Store preference and redirect
    localStorage.setItem('useWebVersion', newMode ? 'true' : 'false');
    
    // Change URL without full page reload
    const currentUrl = new URL(window.location.href);
    if (newMode) {
      currentUrl.searchParams.set('web', 'true');
    } else {
      currentUrl.searchParams.delete('web');
    }
    
    window.history.pushState({}, '', currentUrl.toString());
    
    // Force a page reload to refresh the UI
    window.location.href = currentUrl.toString();
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