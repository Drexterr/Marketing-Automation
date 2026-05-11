'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivity } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  success: 'text-green-500',
  failure: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
};

export function ActivityFeed() {
  const { data: activities = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    refetchInterval: 5000,
  });

  return (
    <Card className="h-full bg-card/40 border-primary/5">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          Live Activity
        </CardTitle>
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Polling Every 5s</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[500px] overflow-auto pr-2 custom-scrollbar">        
          {activities.length === 0 ? (
            <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed">
               <p className="text-sm text-muted-foreground">No recent activity.</p> 
            </div>
          ) : (
            activities.map((item: any, index: number) => (
              <div key={index} className="flex gap-4 group">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-2 h-2 rounded-full mt-1.5",
                    COLORS[item.status] || 'bg-muted'
                  )} />
                  {index < activities.length - 1 && (
                    <div className="w-px h-full bg-border my-1" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold tracking-tight">{item.action}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">       
                      {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })} 
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.profile ? `Lead: ${item.profile}` : item.details?.description || 'System operation.'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
