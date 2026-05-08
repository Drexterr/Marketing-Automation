'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Settings, MessageSquare, BarChart3, Power, Bell, Shield } from 'lucide-react';
import { StatusIndicator } from './status-indicator';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/automation', label: 'Automation', icon: Settings },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-card/50 backdrop-blur-xl flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-black">C</div>
        <div className="flex flex-col">
          <span className="font-bold text-lg tracking-tight">CUE AI</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Outreach System</span>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        <div className="text-[10px] font-bold text-muted-foreground uppercase px-2 mb-2 tracking-widest">Main Menu</div>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group",
              pathname === item.href 
                ? "bg-primary/10 text-primary font-medium" 
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon size={18} className={cn(
              "transition-colors",
              pathname === item.href ? "text-primary" : "group-hover:text-foreground"
            )} />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t bg-card/80 space-y-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
            <Bell size={12} className="text-muted-foreground" />
          </div>
          <StatusIndicator status="running" />
        </div>
        
        <Button 
          variant="destructive" 
          className="w-full justify-start gap-3 h-11 font-bold shadow-lg shadow-destructive/20"
        >
          <Power size={18} />
          <span>EMERGENCY STOP</span>
        </Button>
        
        <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground font-medium">
          <Shield size={10} />
          <span>Secure Session Active</span>
        </div>
      </div>
    </aside>
  );
}
