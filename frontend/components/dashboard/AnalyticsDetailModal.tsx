'use client';

import { useQuery } from '@tanstack/react-query';
import { getAnalyticsDetails } from '@/lib/api';
import { X, ExternalLink, MessageSquare, UserPlus, Reply, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ReactNode } from 'react';

const TYPE_LABELS: Record<string, { title: string; icon: ReactNode }> = {
  connections: { title: 'Connections Sent', icon: <UserPlus size={16} /> },
  comments: { title: 'Feed Comments', icon: <MessageSquare size={16} /> },
  replies: { title: 'Replies Sent', icon: <Reply size={16} /> },
  messages: { title: 'First Messages', icon: <Send size={16} /> },
};

interface Props {
  type: string;
  onClose: () => void;
}

export function AnalyticsDetailModal({ type, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-details', type],
    queryFn: () => getAnalyticsDetails(type),
  });

  const meta = TYPE_LABELS[type] ?? { title: type, icon: null };
  const items: any[] = data?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-base">
            <span className="text-primary">{meta.icon}</span>
            {meta.title}
            <span className="ml-2 text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
              {items.length} records
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading...</div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No data yet.</div>
          ) : (
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600 transition-colors">
                  {type === 'connections' && (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200 truncate">{item.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                            item.state === 'connected' ? 'bg-emerald-500/15 text-emerald-400' :
                            item.state === 'request_sent' ? 'bg-blue-500/15 text-blue-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>{item.state?.replace(/_/g, ' ')}</span>
                        </div>
                        {item.headline && <p className="text-xs text-slate-400 mt-0.5 truncate">{item.headline}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500">
                          {item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ''}
                        </span>
                        {item.profileUrl && (
                          <a href={item.profileUrl} target="_blank" rel="noreferrer" className="text-slate-500 hover:text-primary transition-colors">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {type === 'comments' && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400 italic border-l-2 border-slate-600 pl-2 leading-relaxed">
                        "{item.postSnippet || '—'}"
                      </p>
                      {item.comment && (
                        <p className="text-sm text-slate-200 leading-snug">{item.comment}</p>
                      )}
                      <span className="text-[10px] text-slate-500">
                        {item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ''}
                      </span>
                    </div>
                  )}

                  {(type === 'replies' || type === 'messages') && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-200">{item.name}</span>
                        <span className="text-[10px] text-slate-500">
                          {item.date ? formatDistanceToNow(new Date(item.date), { addSuffix: true }) : ''}
                        </span>
                      </div>
                      {(item.reply || item.message) && (
                        <p className="text-xs text-slate-400 leading-relaxed">{item.reply || item.message}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
