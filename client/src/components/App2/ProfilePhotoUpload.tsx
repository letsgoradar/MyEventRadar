import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, User, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  onPhotoUploaded: (photoUrl: string) => void;
  size?: 'sm' | 'md' | 'lg';
  showUploadButton?: boolean;
}

export default function ProfilePhotoUpload({ 
  currentPhotoUrl, 
  onPhotoUploaded, 
  size = 'md',
  showUploadButton = true
}: ProfilePhotoUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  
  // Probeer eerst de opgeslagen foto uit localStorage te halen
  const savedPhotoUrl = typeof window !== 'undefined' ? localStorage.getItem('profilePhotoUrl') : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || savedPhotoUrl || null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bepaal avatar grootte op basis van size prop
  const avatarSize = size === 'sm' ? 'h-10 w-10' : size === 'md' ? 'h-20 w-20' : 'h-32 w-32';

  // Handle bestand selectie
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Controleer bestandstype
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ongeldig bestandstype",
        description: "Upload een afbeelding (JPG, PNG of GIF)",
        variant: "destructive",
      });
      return;
    }
    
    // Controleer bestandsgrootte (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Bestand te groot",
        description: "De afbeelding mag niet groter zijn dan 5MB",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      // Maak een tijdelijke preview URL
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      
      // Bereid de Form data voor
      const formData = new FormData();
      formData.append('photo', file);
      
      // Upload de afbeelding met apiRequest
      // Laat de browser de Content-Type header automatisch instellen
      const data = await apiRequest('/api/profile-photo', {
        method: 'POST',
        data: formData,
        // Geen Content-Type header instellen voor FormData
      });
      
      // Clean up preview URL
      URL.revokeObjectURL(objectUrl);
      
      console.log("Server response data:", data);
      
      // Verwerk de URL - zorg voor een absolute URL
      const absolutePhotoUrl = data.photoUrl.startsWith('http') 
        ? data.photoUrl 
        : window.location.origin + data.photoUrl;
      
      console.log("Absolute photo URL:", absolutePhotoUrl);
      
      // Set definitieve URL met absolute URL
      setPreviewUrl(absolutePhotoUrl);
      
      // Sla de photoUrl op in localStorage voor persistentie tussen pagina's
      if (typeof window !== 'undefined') {
        localStorage.setItem('profilePhotoUrl', absolutePhotoUrl);
        console.log("Saved to localStorage:", absolutePhotoUrl);
      }
      
      // Roep de callback aan met de absolute URL
      onPhotoUploaded(absolutePhotoUrl);
      
      toast({
        title: "Foto geüpload",
        description: "Je profielfoto is succesvol bijgewerkt",
      });
    } catch (error) {
      // Log gedetailleerde error informatie
      console.error("Upload error:", error);
      
      // Meer gedetailleerde foutmelding
      let errorMsg = "Er is iets misgegaan bij het uploaden van je foto";
      
      if (error instanceof Error) {
        errorMsg = error.message || errorMsg;
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
        
        // Probeer meer informatie te loggen als het een Axios error is
        if ('response' in error) {
          // @ts-ignore
          const axiosError = error.response?.data;
          console.error("Response data:", axiosError);
          if (axiosError?.message) {
            errorMsg = axiosError.message;
          }
        }
      }
      
      toast({
        title: "Upload mislukt",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Trigger file input click
  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="flex flex-col items-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      
      <div className="relative mb-3">
        <Avatar className={`${avatarSize} cursor-pointer`} onClick={handleButtonClick}>
          {previewUrl ? (
            <AvatarImage src={previewUrl} alt="Profielfoto" />
          ) : (
            <AvatarFallback>
              <User />
            </AvatarFallback>
          )}
        </Avatar>
        
        {/* Camera icon overlay */}
        <div 
          className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer"
          onClick={handleButtonClick}
        >
          <Camera className="h-4 w-4" />
        </div>
      </div>
      
      {showUploadButton && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleButtonClick}
          disabled={isUploading}
          className="mt-2"
        >
          {isUploading ? (
            <>Uploaden...</>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Foto uploaden
            </>
          )}
        </Button>
      )}
    </div>
  );
}