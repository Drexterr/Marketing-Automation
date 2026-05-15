"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getReviewQueue, updateReviewItem } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { MessageSquare, Check, X, Search, Filter, ChevronDown, ChevronUp, Clock, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface ReviewItem {
  id: string;
  type: string;
  profile_name?: string;
  draft_content?: string;
  context?: string;
  created_at?: string;
}
export function ReviewQueue() {
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['reviewQueue'],
    queryFn: getReviewQueue,
    refetchInterval: 10000,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, response }: { id: string; status: string; response?: string }) =>
      updateReviewItem(id, status, response),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['reviewQueue'] });
      const previousQueue = queryClient.getQueryData(['reviewQueue']);
      queryClient.setQueryData(['reviewQueue'], (old: ReviewItem[]) =>
        old?.filter((item: ReviewItem) => item.id !== id)
      );
      return { previousQueue };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['reviewQueue'], context?.previousQueue);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewQueue'] });
    },
  });

  const filteredQueue = useMemo(() => {
    return queue.filter((item: ReviewItem) => {
      if (search) {
        const query = search.toLowerCase();
        return (
          item.profile_name?.toLowerCase().includes(query) ||
          item.draft_content?.toLowerCase().includes(query) ||
          item.type?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [queue, search]);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedItems(newSet);
  };

  if (isLoading) {
    return (
      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 shadow-sm h-full flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3 rounded" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (queue.length === 0) return null;

  return (
    <div className="bg-card/50 border border-border/50 rounded-2xl p-6 backdrop-blur-sm shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500 shadow-sm">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Review Queue</h2>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {queue.length} items awaiting manual approval
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search leads, contents, or type..."
            className="pl-9 bg-card/30 border-border/50 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9 border-border/50">
          <Filter size={14} className="text-muted-foreground" />
        </Button>
      </div>

      <div className="space-y-3 overflow-auto max-h-[500px] pr-2">
        {filteredQueue.map((item: ReviewItem) => {
          const isExpanded = expandedItems.has(item.id);
          const isHighPriority = item.type === 'objection' || item.type === 'escalation';

          return (
            <div key={item.id} className={`p-4 rounded-xl border transition-colors ${isHighPriority ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-900/50 border-slate-800'
              }`}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded text-white font-bold tracking-wider ${isHighPriority ? 'bg-rose-500' : 'bg-slate-700'
                      }`}>
                      {item.type.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-slate-200">
                      {item.profile_name || 'Unknown Lead'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                    <Clock size={10} />
                    {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                  </div>
                </div>

                <button onClick={() => toggleExpand(item.id)} className="p-1 hover:bg-slate-800 rounded">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm italic text-slate-300 mb-3 font-mono leading-relaxed">
                &quot;{item.draft_content}&quot;
              </div>

              {isExpanded && (
                <div className="mb-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-500 mb-2">
                    <ShieldAlert size={14} /> AI Context / History
                  </div>
                  <div className="text-xs text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
                    {item.context || 'No extended conversation history available.'}
                  </div>
                </div>
              )}

              <Textarea
                placeholder="Edit response before sending (optional)..."
                className="bg-slate-950 text-sm border-slate-800 focus:border-amber-500/50 mb-3 min-h-[60px]"
                value={responses[item.id] ?? item.draft_content}
                onChange={(e) => setResponses({ ...responses, [item.id]: e.target.value })}
              />

              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8 gap-2 font-bold text-xs"
                  onClick={() => reviewMutation.mutate({ id: item.id, status: 'approved', response: responses[item.id] ?? item.draft_content })}
                >
                  <Check size={14} /> Approve & Send
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 gap-2 font-bold text-xs border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                  onClick={() => reviewMutation.mutate({ id: item.id, status: 'rejected' })}
                >
                  <X size={14} /> Reject
                </Button>
              </div>
            </div>
          );
        })}
        {filteredQueue.length === 0 && (
          <div className="text-center p-8 text-slate-500 text-sm">
            No items match your search.
          </div>
        )}
      </div>
    </div>
  );
}
