'use client';

import { useQuery } from '@tanstack/react-query';
import { getActivity } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  success: 'bg-green-500',
  failure: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-400',
};

const ACTION_LABELS: Record<string, string> = {
  connection_sent: 'Connection request sent',
  connection_failed: 'Connection request failed',
  profile_evaluated: 'Profile evaluated',
  profile_skipped: 'Profile skipped (low score)',
  first_message_sent: 'First message sent',
  reply_sent: 'Reply sent',
  feed_comment: 'Feed comment posted',
};

export function ActivityFeed() {
  const { data: raw = [] } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    refetchInterval: 5000,
  });

  const activities = (raw as any[]).slice(0, 50);

  return (
    <Card className="bg-card/40 border-primary/5">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          Live Activity
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live · 5s</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 px-6 pb-6">
        <div className="overflow-y-auto max-h-[calc(100vh-260px)] pr-1 custom-scrollbar space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-12 bg-secondary/20 rounded-xl border border-dashed">
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            </div>
          ) : (
            activities.map((item: any, index: number) => (
              <ActivityItem key={index} item={item} isLast={index === activities.length - 1} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityItem({ item, isLast }: { item: any; isLast: boolean }) {
  const isFeedComment = item.action === 'feed_comment';
  const dot = COLORS[item.status] || 'bg-muted-foreground';

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', dot)} />
        {!isLast && <div className="w-px flex-1 bg-border my-1" />}
      </div>

      <div className="flex-1 pb-2 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-bold tracking-tight leading-tight">
            {ACTION_LABELS[item.action] ?? item.action}
          </span>
          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </span>
        </div>

        {isFeedComment ? (
          <FeedCommentDetail details={item.details} />
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {item.profile
              ? `${item.profile}${item.details?.score ? ` · Score ${item.details.score}` : ''}${item.details?.headline ? ` · ${item.details.headline}` : ''}`
              : item.details?.reason || item.module || ''}
          </p>
        )}
      </div>
    </div>
  );
}

function FeedCommentDetail({ details }: { details: any }) {
  if (!details) return null;
  const postText = details.postText || details.post_text || '';
  const comment = details.comment || details.text || '';

  return (
    <div className="mt-1.5 space-y-1.5">
      {postText && (
        <p className="text-[11px] text-muted-foreground italic border-l-2 border-slate-600 pl-2 leading-snug line-clamp-2">
          "{postText.slice(0, 100)}{postText.length > 100 ? '…' : ''}"
        </p>
      )}
      {comment && (
        <div className="flex items-start gap-1.5">
          <MessageSquare size={10} className="text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">{comment}</p>
        </div>
      )}
    </div>
  );
}
