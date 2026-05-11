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

interface AnalyticsChartsProps {
  data: any;
}

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaignData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
              <XAxis dataKey="name" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend verticalAlign="top" height={36}/>
              <Bar dataKey="sent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="accepted" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="replies" fill="#eab308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
