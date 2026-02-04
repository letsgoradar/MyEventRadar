import * as React from "react";
import { SiWhatsapp, SiFacebook, SiInstagram, SiX } from "react-icons/si";
import { MoreHorizontal, Mail, Link2, Copy, Check } from "lucide-react";
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
  className?: string;
}

export function ShareMenu({ title, url, description = "", variant = "mobile", className = "" }: ShareMenuProps) {
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

  if (variant === "web") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleEmail}
          className="flex items-center gap-2"
        >
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">E-mail</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstagram}
          className="flex items-center gap-2"
        >
          <SiInstagram className="h-4 w-4" />
          <span className="hidden sm:inline">Instagram</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="flex items-center gap-2"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Link2 className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? "Gekopieerd" : "Kopieer link"}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleWhatsApp}
        className="h-9 w-9 rounded-full bg-[#25D366]/10 hover:bg-[#25D366]/20"
        title="Deel via WhatsApp"
      >
        <SiWhatsapp className="h-5 w-5 text-[#25D366]" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleInstagram}
        className="h-9 w-9 rounded-full bg-gradient-to-br from-[#833AB4]/10 via-[#FD1D1D]/10 to-[#F77737]/10 hover:from-[#833AB4]/20 hover:via-[#FD1D1D]/20 hover:to-[#F77737]/20"
        title="Deel via Instagram"
      >
        <SiInstagram className="h-5 w-5 text-[#E4405F]" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleFacebook}
        className="h-9 w-9 rounded-full bg-[#1877F2]/10 hover:bg-[#1877F2]/20"
        title="Deel via Facebook"
      >
        <SiFacebook className="h-5 w-5 text-[#1877F2]" />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={handleX}
        className="h-9 w-9 rounded-full bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
        title="Deel via X"
      >
        <SiX className="h-4 w-4 text-black dark:text-white" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            title="Meer opties"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
            {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? "Gekopieerd!" : "Link kopiëren"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleEmail} className="cursor-pointer">
            <Mail className="h-4 w-4 mr-2" />
            Verstuur via e-mail
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
