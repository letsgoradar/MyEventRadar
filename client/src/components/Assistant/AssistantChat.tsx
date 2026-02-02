import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X, Send, Loader2, Sparkles, Crown, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation as useGeoLocation } from "@/hooks/useLocation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AssistantUsage {
  questionsUsed: number;
  questionsRemaining: number;
  isPremium: boolean;
  freeLimit: number;
}

interface AssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AssistantChat({ isOpen, onClose }: AssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { location } = useGeoLocation();

  const { data: usage } = useQuery<AssistantUsage>({
    queryKey: ["/api/assistant/usage"],
    enabled: isOpen,
    refetchOnWindowFocus: false,
  });

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question,
          lat: location?.lat,
          lng: location?.lng,
          radius: 20,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Er is een fout opgetreden");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/usage"] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Er is een fout opgetreden. Probeer het later opnieuw.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMessage },
      ]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askMutation.isPending) return;

    const question = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    askMutation.mutate(question);
  };

  if (!isOpen) return null;

  const isPremium = usage?.isPremium ?? false;
  const questionsRemaining = usage?.questionsRemaining ?? 5;
  const limitReached = !isPremium && questionsRemaining <= 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <Card className="relative w-full sm:max-w-md h-[70vh] sm:h-[500px] m-0 sm:m-4 rounded-t-2xl sm:rounded-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-full">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Radar Assistent</CardTitle>
              <p className="text-xs text-muted-foreground">
                Vraag me wat je wilt doen!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPremium ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                <Crown className="h-3 w-3 mr-1" />
                Premium
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {questionsRemaining === -1 ? "Onbeperkt" : `${questionsRemaining}/5 vragen`}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-2">Hoe kan ik je helpen?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Stel me een vraag over wat je wilt doen, waar je heen wilt, of welke evenementen interessant zijn.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "Wat kan ik dit weekend doen?",
                  "Zijn er evenementen voor kinderen?",
                  "Waar kan ik live muziek horen?",
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              {askMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <CardContent className="border-t p-3">
          {limitReached ? (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground mb-2">
                Je hebt je gratis vragen voor deze week opgebruikt.
              </p>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade naar Premium
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Stel je vraag..."
                disabled={askMutation.isPending}
                className="flex-1"
              />
              <Button 
                type="submit" 
                size="icon"
                disabled={!input.trim() || askMutation.isPending}
              >
                {askMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default AssistantChat;
