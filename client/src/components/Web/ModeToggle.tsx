import * as React from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { MdDevices, MdSmartphone } from "react-icons/md";

export function ModeToggle() {
  const isMobile = useIsMobile();
  const [isWebMode, setIsWebMode] = React.useState(true);

  React.useEffect(() => {
    // Check if web version is enabled in localStorage
    const storedPref = localStorage.getItem('useWebVersion');
    setIsWebMode(storedPref === 'true');
  }, []);

  const toggleMode = () => {
    const newMode = !isWebMode;
    setIsWebMode(newMode);
    
    // Store preference and redirect
    localStorage.setItem('useWebVersion', newMode ? 'true' : 'false');
    
    if (newMode) {
      window.location.href = '/?web=true';
    } else {
      window.location.href = '/';
    }
  };

  if (isMobile) {
    return null; // Don't show on mobile devices
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