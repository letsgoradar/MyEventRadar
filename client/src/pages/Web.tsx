import * as React from "react";
import WebLayout from "@/components/Web/WebLayout";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";

export default function Web() {
  const [location, setLocation] = useLocation();
  const [isMobileView, setIsMobileView] = React.useState(false);

  React.useEffect(() => {
    // Force de web versie als de URLparam er niet staat
    if (!location.includes('web=true')) {
      setLocation('/?web=true', { replace: true });
    }
  }, [location, setLocation]);

  const toggleMobileView = () => {
    if (isMobileView) {
      window.location.href = '/?web=true';
    } else {
      window.location.href = '/';
    }
  };

  return (
    <>
      <WebLayout />
      <div className="fixed right-4 bottom-4 z-50">
        <Button 
          variant="outline" 
          className="shadow-md bg-background"
          onClick={toggleMobileView}
        >
          {isMobileView ? "Desktop weergave" : "Mobiele weergave"}
        </Button>
      </div>
    </>
  );
}