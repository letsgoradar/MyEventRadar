import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Camera, User, Upload } from "lucide-react";

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
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
      
      // Upload de afbeelding
      const response = await fetch('/api/users/profile-photo', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Uploaden mislukt');
      }
      
      const data = await response.json();
      
      // Clean up preview URL
      URL.revokeObjectURL(objectUrl);
      
      // Set definitieve URL en callback
      onPhotoUploaded(data.photoUrl);
      
      toast({
        title: "Foto geüpload",
        description: "Je profielfoto is succesvol bijgewerkt",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload mislukt",
        description: "Er is iets misgegaan bij het uploaden van je foto",
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