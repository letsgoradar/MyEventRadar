import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/Layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wrench,
  PlayCircle,
  RefreshCw,
  KeyRound,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface RepairLog {
  id: number;
  feedId: number | null;
  feedName: string | null;
  cause: string;
  track: string;
  outcome: string;
  message: string;
  aiCallsUsed: number;
  createdAt: string;
}

interface RepairCase {
  id: number;
  feedId: number | null;
  feedName: string | null;
  kind: "dossier" | "decision";
  cause: string;
  severity: string;
  decisionType: string | null;
  title: string;
  summary: string;
  diagnosis: Record<string, any> | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SelfHealConfig {
  id: number;
  autoRetryEnabled: boolean;
  aiFixEnabled: boolean;
  monthlyAiCallLimit: number;
  monthlyDossierLimit: number;
  maxRetriesPerRun: number;
  monthlyEuroLimitCents: number;
  aiCallCostCents: number;
}

function euro(cents: number) {
  return `€${(cents / 100).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ConfigResponse {
  config: SelfHealConfig;
  usage: { aiCallsUsed: number; dossiersCreated: number };
}

const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
  success: { label: "Hersteld", cls: "bg-green-100 text-green-700" },
  failed: { label: "Mislukt", cls: "bg-red-100 text-red-700" },
  rolled_back: { label: "Teruggedraaid", cls: "bg-amber-100 text-amber-700" },
  escalated: { label: "Geëscaleerd", cls: "bg-blue-100 text-blue-700" },
  pending: { label: "Overgeslagen", cls: "bg-gray-100 text-gray-600" },
};

const TRACK_LABEL: Record<string, string> = {
  retry: "Opnieuw geprobeerd",
  ai_fix: "AI-reparatie",
  dossier: "Dossier",
  decision: "Beslissing",
  skipped: "Overgeslagen",
};

function fmt(d: string) {
  return new Date(d).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SelfHeal() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"cases" | "log" | "settings">("cases");
  const [selected, setSelected] = useState<RepairCase | null>(null);
  const [response, setResponse] = useState("");

  const { data: cases = [], isLoading: casesLoading } = useQuery<RepairCase[]>({
    queryKey: ["/api/admin/self-heal/cases"],
  });
  const { data: log = [], isLoading: logLoading } = useQuery<RepairLog[]>({
    queryKey: ["/api/admin/self-heal/log"],
  });
  const { data: configData } = useQuery<ConfigResponse>({
    queryKey: ["/api/admin/self-heal/config"],
  });

  const [draft, setDraft] = useState<Partial<SelfHealConfig> | null>(null);
  const cfg = { ...(configData?.config ?? {}), ...(draft ?? {}) } as SelfHealConfig;

  const runMutation = useMutation({
    mutationFn: () => apiRequest("/api/admin/self-heal/run", { method: "POST" }),
    onSuccess: (res: any) => {
      if (res.alreadyRunning) {
        toast({ title: "Even geduld", description: "Zelf-herstel draait al — probeer het zo opnieuw." });
        return;
      }
      toast({
        title: "Zelf-herstel uitgevoerd",
        description: `Gecontroleerd: ${res.feedsChecked ?? 0} · Hersteld: ${res.retried ?? 0} · AI: ${res.aiFixed ?? 0} · Dossiers: ${res.dossiersCreated ?? 0} · Beslissingen: ${res.decisionsCreated ?? 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/config"] });
    },
    onError: (e: any) => toast({ title: "Fout", description: e?.message ?? "Mislukt", variant: "destructive" }),
  });

  const caseMutation = useMutation({
    mutationFn: ({ id, action, resolution }: { id: number; action: string; resolution?: string }) =>
      apiRequest(`/api/admin/self-heal/cases/${id}`, {
        method: "PATCH",
        data: { action, resolution },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/cases"] });
      setSelected(null);
      setResponse("");
    },
    onError: (e: any) => toast({ title: "Fout", description: e?.message ?? "Mislukt", variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/self-heal/cases/${id}/retry-verify`, {
        method: "POST",
      }),
    onSuccess: (result: any) => {
      if (result.case) setSelected(result.case);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/log"] });
      toast({
        title: result.passed ? "Feed hersteld en geverifieerd" : "Controle afgerond",
        description: result.passed
          ? "De nieuwe sync en kwaliteitscontrole zijn geslaagd. Het dossier is automatisch gesloten."
          : "De feed is opnieuw getest. Het rapport laat zien waarom verdere actie nodig is.",
        variant: result.passed ? "default" : "destructive",
      });
    },
    onError: (e: any) => toast({
      title: "Controle mislukt",
      description: e?.message ?? "De feed kon niet opnieuw worden getest.",
      variant: "destructive",
    }),
  });

  const configMutation = useMutation({
    mutationFn: (data: Partial<SelfHealConfig>) =>
      apiRequest("/api/admin/self-heal/config", { method: "PUT", data }),
    onSuccess: () => {
      toast({ title: "Opgeslagen", description: "Instellingen bijgewerkt." });
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/self-heal/config"] });
    },
    onError: (e: any) => toast({ title: "Fout", description: e?.message ?? "Mislukt", variant: "destructive" }),
  });

  const openCases = cases.filter((c) => c.status === "open" || c.status === "in_progress");
  const dossiers = openCases.filter((c) => c.kind === "dossier");
  const decisions = openCases.filter((c) => c.kind === "decision");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold">Zelfherstellende koppelingen</h1>
              <p className="text-sm text-muted-foreground">
                Automatische reparatie van ongezonde feeds. Wat niet automatisch lukt, komt hier als dossier of beslissing.
              </p>
            </div>
          </div>
          <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending} data-testid="button-run-self-heal">
            {runMutation.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Nu uitvoeren
          </Button>
        </div>

        <div className="flex gap-1 border-b">
          {([
            ["cases", `Open zaken (${openCases.length})`],
            ["log", "Logboek"],
            ["settings", "Instellingen"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === key ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              data-testid={`tab-${key}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "cases" && (
          <div className="space-y-6">
            {casesLoading ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : openCases.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                Geen open zaken — alle koppelingen zijn gezond of automatisch hersteld.
              </CardContent></Card>
            ) : (
              <>
                {decisions.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-purple-600" /> Beslissingen ({decisions.length})
                    </h2>
                    <div className="space-y-2">
                      {decisions.map((c) => <CaseRow key={c.id} c={c} onOpen={() => setSelected(c)} />)}
                    </div>
                  </section>
                )}
                {dossiers.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" /> Reparatie-dossiers ({dossiers.length})
                    </h2>
                    <div className="space-y-2">
                      {dossiers.map((c) => <CaseRow key={c.id} c={c} onOpen={() => setSelected(c)} />)}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {tab === "log" && (
          <Card>
            <CardContent className="p-0">
              {logLoading ? (
                <p className="text-sm text-muted-foreground p-6">Laden…</p>
              ) : log.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Nog geen reparatie-acties uitgevoerd.</p>
              ) : (
                <ul className="divide-y">
                  {log.map((entry) => {
                    const b = OUTCOME_BADGE[entry.outcome] ?? OUTCOME_BADGE.pending;
                    return (
                      <li key={entry.id} className="p-4 flex items-start gap-3" data-testid={`log-${entry.id}`}>
                        <Clock className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm truncate">{entry.feedName ?? `Feed #${entry.feedId}`}</span>
                            <Badge variant="outline" className="text-xs">{TRACK_LABEL[entry.track] ?? entry.track}</Badge>
                            <Badge className={cn("text-xs", b.cls)}>{b.label}</Badge>
                            {entry.aiCallsUsed > 0 && <span className="text-xs text-muted-foreground">· {entry.aiCallsUsed} AI-call(s)</span>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{entry.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(entry.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "settings" && configData && (
          <Card>
            <CardContent className="p-6 space-y-6 max-w-xl">
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Geschatte kosten deze maand</p>
                  <p className="text-lg font-semibold text-emerald-600">
                    {euro(configData.usage.aiCallsUsed * (cfg.aiCallCostCents ?? 0))} / {euro(cfg.monthlyEuroLimitCents ?? 0)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">AI-calls deze maand</p>
                  <p className="text-lg font-semibold">{configData.usage.aiCallsUsed} / {cfg.monthlyAiCallLimit}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Dossiers deze maand</p>
                  <p className="text-lg font-semibold">{configData.usage.dossiersCreated} / {cfg.monthlyDossierLimit}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatisch opnieuw proberen</Label>
                  <p className="text-xs text-muted-foreground">Gratis retry bij tijdelijke/netwerkfouten.</p>
                </div>
                <Switch
                  checked={cfg.autoRetryEnabled}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, autoRetryEnabled: v }))}
                  data-testid="switch-auto-retry"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatische AI-reparatie</Label>
                  <p className="text-xs text-muted-foreground">Alleen voor simpele config-feeds, binnen budget.</p>
                </div>
                <Switch
                  checked={cfg.aiFixEnabled}
                  onCheckedChange={(v) => setDraft((d) => ({ ...d, aiFixEnabled: v }))}
                  data-testid="switch-ai-fix"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Max AI-calls/maand</Label>
                  <Input type="number" min={0} value={cfg.monthlyAiCallLimit ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, monthlyAiCallLimit: parseInt(e.target.value) || 0 }))}
                    data-testid="input-ai-limit" />
                </div>
                <div>
                  <Label className="text-xs">Max dossiers/maand</Label>
                  <Input type="number" min={0} value={cfg.monthlyDossierLimit ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, monthlyDossierLimit: parseInt(e.target.value) || 0 }))}
                    data-testid="input-dossier-limit" />
                </div>
                <div>
                  <Label className="text-xs">Retries per run</Label>
                  <Input type="number" min={0} value={cfg.maxRetriesPerRun ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, maxRetriesPerRun: parseInt(e.target.value) || 0 }))}
                    data-testid="input-max-retries" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Max AI-kosten/maand (€)</Label>
                  <Input type="number" min={0} step={1} value={(cfg.monthlyEuroLimitCents ?? 0) / 100}
                    onChange={(e) => setDraft((d) => ({ ...d, monthlyEuroLimitCents: Math.round((parseFloat(e.target.value) || 0) * 100) }))}
                    data-testid="input-euro-limit" />
                  <p className="text-xs text-muted-foreground mt-1">Stopt AI-reparatie zodra de geschatte kosten deze grens bereiken. Strengste grens (aantal óf euro) wint.</p>
                </div>
                <div>
                  <Label className="text-xs">Geschatte kosten per AI-call (cent)</Label>
                  <Input type="number" min={0} value={cfg.aiCallCostCents ?? 0}
                    onChange={(e) => setDraft((d) => ({ ...d, aiCallCostCents: parseInt(e.target.value) || 0 }))}
                    data-testid="input-call-cost" />
                  <p className="text-xs text-muted-foreground mt-1">Gebruikt om de maandkosten te schatten.</p>
                </div>
              </div>

              <Button
                onClick={() => draft && configMutation.mutate(draft)}
                disabled={!draft || configMutation.isPending}
                data-testid="button-save-config"
              >
                Instellingen opslaan
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setResponse(""); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.kind === "decision" ? <KeyRound className="w-5 h-5 text-purple-600" /> : <FileText className="w-5 h-5 text-blue-600" />}
                  {selected.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={selected.severity === "error" ? "destructive" : "secondary"}>
                    {selected.severity === "error" ? "Verdacht" : "Waarschuwing"}
                  </Badge>
                  <Badge variant="outline">Oorzaak: {selected.cause}</Badge>
                  {selected.decisionType && <Badge variant="outline">{selected.decisionType}</Badge>}
                </div>
                <p className="text-sm">{selected.summary}</p>

                {selected.diagnosis?.lastVerification && (
                  <VerificationReport verification={selected.diagnosis.lastVerification} />
                )}

                {selected.diagnosis?.workOrder && (
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs font-semibold mb-2 text-muted-foreground">WERKORDER</p>
                    <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{selected.diagnosis.workOrder}</pre>
                  </div>
                )}

                {selected.diagnosis?.url && (
                  <a href={selected.diagnosis.url as string} target="_blank" rel="noreferrer"
                    className="text-sm text-blue-600 underline break-all">
                    {selected.diagnosis.url as string}
                  </a>
                )}

                <div>
                  <Label className="text-xs">Notitie / reactie (optioneel)</Label>
                  <Textarea value={response} onChange={(e) => setResponse(e.target.value)}
                    placeholder="Bijv. welke API-sleutel is aangevraagd, of wat je hebt aangepast…"
                    data-testid="textarea-response" />
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  {selected.feedId && (
                    <Button variant="outline" size="sm" asChild>
                      <a href="/admin/rss-feeds">
                        <ExternalLink className="w-4 h-4 mr-1" /> Open bronnenbeheer
                      </a>
                    </Button>
                  )}
                  {selected.status !== "resolved" && selected.status !== "dismissed" && (
                    <Button size="sm"
                      onClick={() => verifyMutation.mutate(selected.id)}
                      disabled={verifyMutation.isPending || caseMutation.isPending}
                      data-testid="button-retry-verify">
                      {verifyMutation.isPending
                        ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                        : <PlayCircle className="w-4 h-4 mr-1" />}
                      {verifyMutation.isPending ? "Testen en controleren…" : "Opnieuw testen en verifiëren"}
                    </Button>
                  )}
                  <Button variant="outline" size="sm"
                    onClick={() => caseMutation.mutate({ id: selected.id, action: "respond", resolution: response })}
                    disabled={caseMutation.isPending || verifyMutation.isPending} data-testid="button-respond">
                    <RotateCcw className="w-4 h-4 mr-1" /> In behandeling
                  </Button>
                  <Button variant="outline" size="sm"
                    onClick={() => caseMutation.mutate({ id: selected.id, action: "dismiss", resolution: response })}
                    disabled={caseMutation.isPending || verifyMutation.isPending} data-testid="button-dismiss">
                    <XCircle className="w-4 h-4 mr-1" /> Negeren
                  </Button>
                  <Button variant="outline" size="sm"
                    onClick={() => caseMutation.mutate({ id: selected.id, action: "resolve", resolution: response })}
                    disabled={caseMutation.isPending || verifyMutation.isPending} data-testid="button-resolve">
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Administratief sluiten
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function VerificationReport({ verification }: { verification: any }) {
  const sync = verification.sync ?? {};
  const quality = verification.quality ?? {};
  const health = verification.health;
  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3",
      verification.passed ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50",
    )}>
      <div className="flex items-center gap-2">
        {verification.passed
          ? <CheckCircle2 className="w-5 h-5 text-green-600" />
          : <AlertTriangle className="w-5 h-5 text-amber-600" />}
        <div>
          <p className="font-semibold text-sm">
            {verification.passed ? "Laatste controle geslaagd" : "Laatste controle vraagt aandacht"}
          </p>
          {verification.completedAt && (
            <p className="text-xs text-muted-foreground">{fmt(verification.completedAt)}</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="Verwerkt" value={sync.itemsProcessed ?? 0} />
        <Metric label="Nieuw" value={sync.eventsCreated ?? 0} />
        <Metric label="Bijgewerkt" value={sync.eventsUpdated ?? 0} />
        <Metric label="Afgekeurd" value={sync.eventsRejected ?? 0} />
        <Metric label="Kwaliteit" value={`${quality.score ?? 0}%`} />
        <Metric label="Gecontroleerd" value={quality.checked ?? 0} />
        <Metric label="Fouten" value={quality.errorIssues ?? 0} />
        <Metric label="Feedstatus" value={health?.status ?? "onbekend"} />
      </div>
      {health?.reason && <p className="text-xs text-muted-foreground">{health.reason}</p>}
      {sync.error && <p className="text-xs text-red-700">{sync.error}</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-white/80 border px-2 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}

function CaseRow({ c, onOpen }: { c: RepairCase; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-lg border p-3 hover:bg-accent transition-colors"
      data-testid={`case-${c.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {c.severity === "error" ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
            <span className="font-medium text-sm truncate">{c.title}</span>
            {c.status === "in_progress" && <Badge variant="outline" className="text-xs">In behandeling</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.summary}</p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(c.createdAt)}</span>
      </div>
    </button>
  );
}
