'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { UserPlus, CheckCircle2, MessageSquare, Sparkles, Reply, Send } from 'lucide-react';

interface AnalyticsChartsProps {
  data: any;
  onStatClick?: (type: string) => void;
}

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

const STATS = [
  { key: 'connections', label: 'Connections Sent', dataKey: 'funnel.sent', icon: <UserPlus size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { key: 'connections', label: 'Accepted', dataKey: 'funnel.accepted', icon: <CheckCircle2 size={16} />, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { key: 'replies', label: 'Replies', dataKey: 'funnel.replied', icon: <Reply size={16} />, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  { key: 'comments', label: 'Comments', dataKey: 'comments', icon: <MessageSquare size={16} />, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  { key: 'messages', label: 'First Messages', dataKey: 'firstMessages', icon: <Send size={16} />, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  { key: 'connections', label: 'Interested', dataKey: 'funnel.interested', icon: <Sparkles size={16} />, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
];

function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((acc, k) => acc?.[k], obj) ?? 0;
}

export function AnalyticsCharts({ data, onStatClick }: AnalyticsChartsProps) {
  const funnelData = [
    { name: 'Sent', value: data?.funnel?.sent || 0 },
    { name: 'Accepted', value: data?.funnel?.accepted || 0 },
    { name: 'Replied', value: data?.funnel?.replied || 0 },
    { name: 'Interested', value: data?.funnel?.interested || 0 },
  ];

  const campaignData = Object.entries(data?.byCampaign || {}).map(([name, stats]: [string, any]) => ({
    name,
    sent: stats.sent,
    accepted: stats.accepted,
    replies: stats.replies,
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATS.map((stat, i) => {
          const value = getNestedValue(data, stat.dataKey);
          return (
            <button
              key={i}
              onClick={() => onStatClick?.(stat.key)}
              className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border ${stat.bg} ${stat.border} hover:brightness-125 transition-all duration-150 text-left group cursor-pointer`}
            >
              <span className={`${stat.color} opacity-80 group-hover:opacity-100`}>{stat.icon}</span>
              <span className={`text-2xl font-black ${stat.color}`}>{value}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{stat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card/50 border rounded-xl p-6">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 text-center">Conversion Funnel</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={100} stroke="#888" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card/50 border rounded-xl p-6">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 text-center">Campaign Performance</h3>
          <div className="h-[300px] w-full">
            {campaignData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={campaignData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" fontSize={10} />
                  <YAxis stroke="#888" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="accepted" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="replies" fill="#eab308" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No campaign data yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
