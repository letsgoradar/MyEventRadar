import { useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, HelpCircle, FileText, Star, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug", icon: Bug, color: "text-red-500 bg-red-50 border-red-200 hover:bg-red-100" },
  { value: "idee", label: "Idee", icon: Lightbulb, color: "text-amber-500 bg-amber-50 border-amber-200 hover:bg-amber-100" },
  { value: "vraag", label: "Vraag", icon: HelpCircle, color: "text-blue-500 bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { value: "anders", label: "Anders", icon: FileText, color: "text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100" },
] as const;

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const resetForm = () => {
    setFeedbackType("");
    setMessage("");
    setRating(0);
    setHoverRating(0);
    setEmail("");
  };

  const handleSubmit = async () => {
    if (!feedbackType || message.length < 5) return;

    setIsSubmitting(true);
    try {
      await apiRequest("/api/feedback", {
        method: "POST",
        data: {
          pageUrl: window.location.pathname,
          feedbackType,
          message,
          rating: rating > 0 ? rating : null,
          email: email || null,
        },
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsOpen(false);
        resetForm();
      }, 2000);
    } catch (error) {
      toast({
        title: "Fout",
        description: "Kon feedback niet verzenden. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = feedbackType && message.length >= 5 && !isSubmitting;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-[90]" onClick={() => { setIsOpen(false); resetForm(); }} />
      )}

      {isOpen && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 z-[95] w-[calc(100vw-2rem)] max-w-sm bg-card border rounded-xl shadow-2xl overflow-hidden">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold">Bedankt!</p>
              <p className="text-sm text-muted-foreground text-center">
                Je feedback helpt ons Evenementenradar.nl te verbeteren.
              </p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-primary text-primary-foreground">
                <h3 className="font-semibold text-sm">Geef feedback</h3>
                <p className="text-xs opacity-80 mt-0.5">Wat wil je ons laten weten?</p>
              </div>

              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  {FEEDBACK_TYPES.map((type) => {
                    const Icon = type.icon;
                    const selected = feedbackType === type.value;
                    return (
                      <button
                        key={type.value}
                        onClick={() => setFeedbackType(type.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all text-xs font-medium",
                          selected
                            ? type.color + " border-current ring-2 ring-current/20"
                            : "border-transparent bg-muted/50 hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {type.label}
                      </button>
                    );
                  })}
                </div>

                <Textarea
                  placeholder="Beschrijf je feedback... (min. 5 tekens)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                />

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Hoe bevalt de app? (optioneel)</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(star === rating ? 0 : star)}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          className={cn(
                            "w-6 h-6 transition-colors",
                            (hoverRating || rating) >= star
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-300"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {!user && (
                  <Input
                    type="email"
                    placeholder="Je e-mail (optioneel, voor reactie)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-sm"
                  />
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="w-full gap-2"
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Verzenden..." : "Verstuur feedback"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-20 lg:bottom-6 right-4 z-[85] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110",
          isOpen
            ? "bg-muted text-muted-foreground rotate-45"
            : "bg-primary text-primary-foreground"
        )}
        aria-label="Feedback geven"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>
    </>
  );
}
