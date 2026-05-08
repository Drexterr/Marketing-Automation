'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  UserPlus, 
  MessageCircle, 
  Rss, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert,
  Search,
  Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id?: string;
  type: string;
  timestamp: string;
  profile?: string;
  action: string;
  details?: any;
  status: 'success' | 'failure' | 'warning' | 'info';
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const ICONS: Record<string, any> = {
  connection: UserPlus,
  message: MessageCircle,
  comment: Rss,
  safety: ShieldAlert,
  system: Search,
};

const COLORS: Record<string, string> = {
  success: 'text-green-500',
  failure: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <Card className="h-full border-0 bg-transparent shadow-none">
      <CardHeader className="px-0 pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          Recent Activity
        </CardTitle>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Real-time Stream</span>
      </CardHeader>
      <CardContent className="px-0">
        <div className="space-y-4 max-h-[600px] overflow-auto pr-2 custom-scrollbar">
          {activities.length === 0 ? (
            <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed">
               <p className="text-sm text-muted-foreground">No recent activity recorded.</p>
            </div>
          ) : (
            activities.map((item, index) => {
              const Icon = ICONS[item.type] || Search;
              return (
                <div key={index} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "p-2 rounded-full border bg-background group-hover:scale-110 transition-transform duration-200",
                      COLORS[item.status] || 'text-muted-foreground'
                    )}>
                      <Icon size={14} />
                    </div>
                    {index < activities.length - 1 && (
                      <div className="w-px h-full bg-border my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold tracking-tight">
                        {item.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {item.profile ? `Lead: ${item.profile}` : item.details?.description || 'System operation completed.'}
                    </p>
                    {item.details?.score && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          Score: {item.details.score}
                        </span>
                        <span className="text-[10px] text-muted-foreground italic truncate">
                          "{item.details.reason}"
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
