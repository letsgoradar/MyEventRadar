import * as React from "react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiX } from "react-icons/si";
import { Share2, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface ShareMenuProps {
  title: string;
  url: string;
  description?: string;
  variant?: "mobile" | "web";
  buttonSize?: "default" | "icon" | "sm";
  className?: string;
}

export function ShareMenu({ title, url, description = "", variant = "mobile", buttonSize = "icon", className = "" }: ShareMenuProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const shareText = `${title}${description ? ` - ${description}` : ""}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(shareText);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link gekopieerd",
        description: "De link is naar je klembord gekopieerd",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Kopiëren mislukt",
        description: "Kon de link niet kopiëren",
        variant: "destructive",
      });
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, "_blank");
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, "_blank");
  };

  const handleX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`, "_blank");
  };

  const handleInstagram = () => {
    handleCopyLink();
    toast({
      title: "Link gekopieerd voor Instagram",
      description: "Plak de link in je Instagram story of bericht",
    });
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${shareText}\n\nBekijk het evenement: ${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const mobileItems = [
    { icon: SiWhatsapp, label: "WhatsApp", onClick: handleWhatsApp, color: "text-[#25D366]" },
    { icon: SiInstagram, label: "Instagram", onClick: handleInstagram, color: "text-[#E4405F]" },
    { icon: SiFacebook, label: "Facebook", onClick: handleFacebook, color: "text-[#1877F2]" },
    { icon: SiX, label: "X", onClick: handleX, color: "text-black dark:text-white" },
  ];

  const webItems = [
    { icon: Mail, label: "E-mail", onClick: handleEmail, color: "text-gray-600" },
    { icon: SiInstagram, label: "Instagram", onClick: handleInstagram, color: "text-[#E4405F]" },
  ];

  const items = variant === "web" ? webItems : mobileItems;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={buttonSize}
          className={buttonSize === "icon" ? `h-12 w-12 ${className}` : `h-9 text-sm ${className}`}
          title="Delen"
        >
          <Share2 className={buttonSize === "icon" ? "h-5 w-5" : "h-4 w-4 mr-2"} />
          {buttonSize !== "icon" && "Delen"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item, index) => (
          <DropdownMenuItem key={index} onClick={item.onClick} className="cursor-pointer">
            <item.icon className={`h-4 w-4 mr-2 ${item.color}`} />
            {item.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Gekopieerd!" : "Link kopiëren"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="cursor-pointer">
          <Mail className="h-4 w-4 mr-2" />
          Verstuur via e-mail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
