'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleToggleProps {
  title: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  isLoading?: boolean;
}

export function ModuleToggle({ 
  title, 
  description, 
  icon: Icon, 
  enabled, 
  onToggle, 
  isLoading 
}: ModuleToggleProps) {
  return (
    <Card className={cn("transition-all duration-200", enabled ? "border-primary/50 bg-primary/5" : "bg-card/50")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg transition-colors",
            enabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
          )}>
            <Icon size={20} />
          </div>
          <div>
            <CardTitle className="text-base font-bold tracking-tight">{title}</CardTitle>
            <CardDescription className="text-xs line-clamp-1">{description}</CardDescription>
          </div>
        </div>
        <Switch 
          checked={enabled} 
          onCheckedChange={onToggle} 
          disabled={isLoading}
        />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mt-2">
          <div className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-green-500 animate-pulse" : "bg-muted")} />
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {enabled ? "Monitoring Active" : "Disabled"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
