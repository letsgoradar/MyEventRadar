import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileQuestion,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

interface SyncHistory {
  id: number;
  feedId: number;
  syncedAt: string;
  durationMs: number | null;
  totalFound: number | null;
  afterMerge: number | null;
  newEvents: number | null;
  updatedEvents: number | null;
  incompleteEvents: number | null;
  skippedEvents: number | null;
  incompleteReasons: Record<string, number> | null;
  errorMessage: string | null;
  success: boolean | null;
}

interface SyncHistoryResponse {
  latestSync: SyncHistory | null;
  history: SyncHistory[];
  avgDurationMs: number | null;
}

interface SyncHistoryTooltipProps {
  feedId: number;
  lastFetchedAt: string | null;
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function getSpeedIndicator(current: number | null, avg: number | null): { icon: React.ReactNode; label: string; color: string } {
  if (current === null || avg === null || avg === 0) {
    return { icon: <Minus className="w-3 h-3" />, label: 'Geen vergelijking', color: 'text-muted-foreground' };
  }
  
  const ratio = current / avg;
  
  if (ratio < 0.8) {
    return { icon: <TrendingUp className="w-3 h-3" />, label: 'Sneller dan gemiddeld', color: 'text-green-600' };
  } else if (ratio > 1.2) {
    return { icon: <TrendingDown className="w-3 h-3" />, label: 'Langzamer dan gemiddeld', color: 'text-orange-600' };
  } else {
    return { icon: <Minus className="w-3 h-3" />, label: 'Normaal', color: 'text-blue-600' };
  }
}

function translateReason(reason: string): string {
  const translations: Record<string, string> = {
    'location': 'Locatie ontbreekt',
    'startTime': 'Starttijd ontbreekt',
    'description': 'Beschrijving te kort',
    'title': 'Titel ontbreekt',
    'endTime': 'Eindtijd ontbreekt',
    'image': 'Afbeelding ontbreekt',
    'date': 'Datum ontbreekt'
  };
  return translations[reason] || reason;
}

export function SyncHistoryTooltip({ feedId, lastFetchedAt }: SyncHistoryTooltipProps) {
  const { data, isLoading } = useQuery<SyncHistoryResponse>({
    queryKey: [`/api/admin/rss-feeds/${feedId}/sync-history`],
    enabled: !!lastFetchedAt,
    staleTime: 30000,
  });

  if (!lastFetchedAt) {
    return <span className="text-muted-foreground">Nog niet opgehaald</span>;
  }

  const formattedDate = format(new Date(lastFetchedAt), 'dd MMM HH:mm', { locale: nl });

  if (!data?.latestSync) {
    return <span>{formattedDate}</span>;
  }

  const sync = data.latestSync;
  const speedInfo = getSpeedIndicator(sync.durationMs, data.avgDurationMs);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button className="text-left hover:underline hover:text-primary transition-colors cursor-help inline-flex items-center gap-1">
          <span>{formattedDate}</span>
          {sync.success === false && <XCircle className="w-3 h-3 text-red-500" />}
          {sync.incompleteEvents && sync.incompleteEvents > 0 && (
            <AlertTriangle className="w-3 h-3 text-amber-500" />
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="left" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Sync Details
            </h4>
            {sync.success ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Geslaagd
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                <XCircle className="w-3 h-3 mr-1" />
                Mislukt
              </Badge>
            )}
          </div>

          {sync.errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
              {sync.errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground">Gevonden</span>
              <span className="font-medium">{sync.totalFound ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
              <span className="text-muted-foreground flex items-center gap-1">
                Na merge <ArrowRight className="w-3 h-3" />
              </span>
              <span className="font-medium">{sync.afterMerge ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <span className="text-green-700">Nieuw</span>
              <span className="font-medium text-green-700">{sync.newEvents ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <span className="text-blue-700">Bijgewerkt</span>
              <span className="font-medium text-blue-700">{sync.updatedEvents ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-amber-50 rounded col-span-2">
              <span className="text-amber-700 flex items-center gap-1">
                <FileQuestion className="w-3 h-3" />
                Incompleet
              </span>
              <span className="font-medium text-amber-700">{sync.incompleteEvents ?? 0}</span>
            </div>
          </div>

          <div className="border-t pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Duur
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatDuration(sync.durationMs)}</span>
                <span className={`flex items-center gap-1 ${speedInfo.color}`}>
                  {speedInfo.icon}
                  <span className="text-[10px]">{speedInfo.label}</span>
                </span>
              </div>
            </div>
            {data.avgDurationMs && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-muted-foreground">Gemiddeld</span>
                <span className="text-muted-foreground">{formatDuration(data.avgDurationMs)}</span>
              </div>
            )}
          </div>

          {sync.incompleteReasons && Object.keys(sync.incompleteReasons).length > 0 && (
            <div className="border-t pt-2">
              <h5 className="text-xs font-medium mb-2 text-amber-700">Incomplete redenen:</h5>
              <div className="flex flex-wrap gap-1">
                {Object.entries(sync.incompleteReasons).map(([reason, count]) => (
                  <Badge key={reason} variant="outline" className="text-[10px] bg-amber-50 border-amber-200 text-amber-700">
                    {translateReason(reason)}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.history.length > 1 && (
            <div className="border-t pt-2">
              <h5 className="text-xs font-medium mb-2 text-muted-foreground">Recente syncs:</h5>
              <div className="space-y-1">
                {data.history.slice(1, 4).map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{format(new Date(h.syncedAt), 'dd MMM HH:mm', { locale: nl })}</span>
                    <span className="flex items-center gap-2">
                      {h.success ? (
                        <span className="text-green-600">+{h.newEvents ?? 0}</span>
                      ) : (
                        <span className="text-red-600">Mislukt</span>
                      )}
                      <span>{formatDuration(h.durationMs)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
