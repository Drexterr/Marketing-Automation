'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReviewQueue, updateReviewItem } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X } from 'lucide-react';

export function ReviewQueue() {
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});

  const { data: queue = [] } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: getReviewQueue,
    refetchInterval: 10000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, response }: { id: string; status: string; response?: string }) => 
      updateReviewItem(id, status, response),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reviewQueue'] }),
  });

  if (queue.length === 0) return null;

  return (
    <Card className="bg-card/40 border-amber-500/20">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <MessageSquare size={18} className="text-amber-500" />
          Review Queue ({queue.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {queue.map((item: any) => (
          <div key={item.id} className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.type}</p>
                <p className="text-sm font-bold">{item.profile_name || 'Unknown Lead'}</p>
              </div>
              <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full font-bold">AWAITING REVIEW</span>
            </div>
            
            <div className="bg-background/50 p-3 rounded-lg border border-border/50 text-sm italic text-muted-foreground">
              "{item.draft_content}"
            </div>

            <Textarea 
              placeholder="Edit response before sending..."
              className="bg-background/50 text-sm border-border/50 focus:border-amber-500/50"
              value={responses[item.id] ?? item.draft_content}
              onChange={(e) => setResponses({ ...responses, [item.id]: e.target.value })}
            />

            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 bg-green-600 hover:bg-green-700 h-9 gap-2 font-bold"
                onClick={() => reviewMutation.mutate({ id: item.id, status: 'approved', response: responses[item.id] ?? item.draft_content })}
                disabled={reviewMutation.isPending}
              >
                <Check size={16} /> Approve
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-9 gap-2 font-bold border-red-500/20 hover:bg-red-500/10 hover:text-red-500"
                onClick={() => reviewMutation.mutate({ id: item.id, status: 'rejected' })}
                disabled={reviewMutation.isPending}
              >
                <X size={16} /> Reject
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
