'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalytics } from '@/lib/api';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { AnalyticsDetailModal } from '@/components/dashboard/AnalyticsDetailModal';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <BarChart3 className="text-primary" size={32} />
            Analytics & Performance
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">
            Click any stat card to drill into the underlying data.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="font-bold gap-2"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          REFRESH DATA
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-[400px] w-full rounded-2xl" />
            <Skeleton className="h-[400px] w-full rounded-2xl" />
          </div>
        </div>
      ) : (
        <AnalyticsCharts data={data} onStatClick={setSelectedStat} />
      )}

      {selectedStat && (
        <AnalyticsDetailModal type={selectedStat} onClose={() => setSelectedStat(null)} />
      )}
    </div>
  );
}
