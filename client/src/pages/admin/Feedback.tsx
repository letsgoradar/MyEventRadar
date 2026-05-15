import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/Layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bug,
  Lightbulb,
  HelpCircle,
  FileText,
  Star,
  Eye,
  CheckCircle2,
  MessageSquare,
  Clock,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackItem {
  id: number;
  userId: number | null;
  pageUrl: string;
  feedbackType: string;
  message: string;
  rating: number | null;
  email: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  userName: string | null;
  userUsername: string | null;
}

interface FeedbackStats {
  statusCounts: { status: string; count: number }[];
  typeCounts: { feedbackType: string; count: number }[];
}

const TYPE_CONFIG: Record<string, { icon: typeof Bug; label: string; color: string }> = {
  bug: { icon: Bug, label: "Bug", color: "bg-red-100 text-red-700" },
  idee: { icon: Lightbulb, label: "Idee", color: "bg-amber-100 text-amber-700" },
  vraag: { icon: HelpCircle, label: "Vraag", color: "bg-blue-100 text-blue-700" },
  anders: { icon: FileText, label: "Anders", color: "bg-gray-100 text-gray-700" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  nieuw: { label: "Nieuw", color: "bg-blue-100 text-blue-700", icon: Clock },
  gelezen: { label: "Gelezen", color: "bg-yellow-100 text-yellow-700", icon: Eye },
  verwerkt: { label: "Verwerkt", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  gearchiveerd: { label: "Gearchiveerd", color: "bg-gray-100 text-gray-500", icon: Archive },
};

export default function AdminFeedback() {
  const [statusFilter, setStatusFilter] = useState<string>("alle");
  const [typeFilter, setTypeFilter] = useState<string>("alle");
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: stats } = useQuery<FeedbackStats>({
    queryKey: ["/api/admin/feedback/stats"],
  });

  const queryParams = new URLSearchParams();
  if (statusFilter !== "alle") queryParams.set("status", statusFilter);
  if (typeFilter !== "alle") queryParams.set("feedbackType", typeFilter);
  const queryString = queryParams.toString();

  const { data: feedbackItems, isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ["/api/admin/feedback", queryString],
    queryFn: () => fetch(`/api/admin/feedback${queryString ? `?${queryString}` : ""}`, { credentials: "include" }).then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; status?: string; adminNotes?: string }) => {
      return apiRequest(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback/stats"] });
    },
    onError: (err: any) => {
      console.error("[Feedback] Update fout:", err);
    },
  });

  const newCount = stats?.statusCounts?.find((s) => s.status === "nieuw")?.count || 0;
  const totalCount = stats?.statusCounts?.reduce((sum, s) => sum + Number(s.count), 0) || 0;

  const handleOpenDetail = (item: FeedbackItem) => {
    setSelectedItem(item);
    setAdminNotes(item.adminNotes || "");
    if (item.status === "nieuw") {
      updateMutation.mutate({ id: item.id, status: "gelezen" });
    }
  };

  const handleSaveNotes = () => {
    if (!selectedItem) return;
    updateMutation.mutate({ id: selectedItem.id, adminNotes });
  };

  const handleMarkProcessed = () => {
    if (!selectedItem) return;
    updateMutation.mutate({ id: selectedItem.id, status: "verwerkt", adminNotes });
    setSelectedItem(null);
  };

  const handleArchive = () => {
    if (!selectedItem) return;
    updateMutation.mutate({ id: selectedItem.id, status: "gearchiveerd", adminNotes });
    setSelectedItem(null);
  };

  // Inline quick action (from table row directly, without opening dialog)
  const handleQuickStatus = (e: React.MouseEvent, item: FeedbackItem, status: string) => {
    e.stopPropagation();
    updateMutation.mutate({ id: item.id, status });
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Beta Feedback</h1>
            <p className="text-muted-foreground">
              {totalCount} feedback items, waarvan {newCount} nieuw
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(TYPE_CONFIG).map(([key, config]) => {
              const count = stats?.typeCounts?.find((t) => t.feedbackType === key)?.count || 0;
              const Icon = config.icon;
              return (
                <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter(typeFilter === key ? "alle" : key)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{config.label}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {["alle", "nieuw", "gelezen", "verwerkt", "gearchiveerd"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
                    statusFilter === s ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s === "alle" ? "Alle" : STATUS_CONFIG[s]?.label || s}
                  {s === "nieuw" && newCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-blue-600 text-white">
                      {newCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle types</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="idee">Idee</SelectItem>
                <SelectItem value="vraag">Vraag</SelectItem>
                <SelectItem value="anders">Anders</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Laden...</div>
          ) : !feedbackItems?.length ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Geen feedback gevonden</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Datum</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Bericht</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Pagina</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Gebruiker</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">Rating</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackItems.map((item) => {
                    const typeConf = TYPE_CONFIG[item.feedbackType];
                    const statusConf = STATUS_CONFIG[item.status];
                    const Icon = typeConf?.icon || FileText;
                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleOpenDetail(item)}
                        className={cn(
                          "border-t cursor-pointer hover:bg-muted/30 transition-colors",
                          item.status === "nieuw" && "bg-blue-50/50",
                          item.status === "gearchiveerd" && "opacity-60"
                        )}
                      >
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("nl-NL", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={cn("gap-1", typeConf?.color)}>
                            <Icon className="w-3 h-3" />
                            {typeConf?.label || item.feedbackType}
                          </Badge>
                        </td>
                        <td className="p-3 max-w-[300px]">
                          <p className="truncate">{item.message}</p>
                        </td>
                        <td className="p-3 hidden md:table-cell text-muted-foreground text-xs font-mono">
                          {item.pageUrl}
                        </td>
                        <td className="p-3 hidden lg:table-cell text-muted-foreground">
                          {item.userName || item.userUsername || (item.email ? item.email : "Anoniem")}
                        </td>
                        <td className="p-3 hidden lg:table-cell">
                          {item.rating ? (
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={cn("w-3 h-3", s <= item.rating! ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={statusConf?.color}>
                            {statusConf?.label || item.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            {item.status !== "verwerkt" && item.status !== "gearchiveerd" && (
                              <button
                                onClick={(e) => handleQuickStatus(e, item, "verwerkt")}
                                className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors"
                                title="Markeer als verwerkt"
                                disabled={updateMutation.isPending}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            {item.status !== "gearchiveerd" && (
                              <button
                                onClick={(e) => handleQuickStatus(e, item, "gearchiveerd")}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                                title="Archiveer (niet relevant)"
                                disabled={updateMutation.isPending}
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedItem && TYPE_CONFIG[selectedItem.feedbackType] && (() => {
                  const Icon = TYPE_CONFIG[selectedItem.feedbackType].icon;
                  return <Icon className="w-5 h-5" />;
                })()}
                {selectedItem && (TYPE_CONFIG[selectedItem.feedbackType]?.label || selectedItem.feedbackType)}
              </DialogTitle>
            </DialogHeader>

            {selectedItem && (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{selectedItem.message}</p>
                </div>

                {selectedItem.rating && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rating:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={cn("w-4 h-4", s <= selectedItem.rating! ? "fill-amber-400 text-amber-400" : "text-gray-300")} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Pagina:</span>
                    <p className="font-mono text-xs">{selectedItem.pageUrl}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gebruiker:</span>
                    <p>{selectedItem.userName || selectedItem.userUsername || "Anoniem"}</p>
                  </div>
                  {selectedItem.email && (
                    <div>
                      <span className="text-muted-foreground">E-mail:</span>
                      <p>{selectedItem.email}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Datum:</span>
                    <p>{new Date(selectedItem.createdAt).toLocaleString("nl-NL")}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Admin notities</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Interne notities over deze feedback..."
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2 justify-end flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleSaveNotes} disabled={updateMutation.isPending}>
                    Notities opslaan
                  </Button>
                  {selectedItem.status !== "gearchiveerd" && (
                    <Button variant="outline" size="sm" onClick={handleArchive} disabled={updateMutation.isPending} className="gap-1 text-gray-600">
                      <Archive className="w-4 h-4" />
                      Archiveer
                    </Button>
                  )}
                  {selectedItem.status !== "verwerkt" && (
                    <Button size="sm" onClick={handleMarkProcessed} disabled={updateMutation.isPending} className="gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Markeer als verwerkt
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
