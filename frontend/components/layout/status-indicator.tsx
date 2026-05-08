'use client';

export function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-500',
    idle: 'bg-yellow-500',
    sleeping: 'bg-blue-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/50">
      <div className={`h-2.5 w-2.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)] ${colors[status] || 'bg-gray-500'}`} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{status}</span>
    </div>
  );
}
