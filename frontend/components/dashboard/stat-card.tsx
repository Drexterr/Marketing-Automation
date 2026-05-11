import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isUp: boolean;
  };
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  className 
}: StatCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <div className="p-2 bg-secondary/50 rounded-lg text-secondary-foreground">
          <Icon size={16} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={cn(
                "text-xs font-bold",
                trend.isUp ? "text-green-500" : "text-red-500"
              )}>
                {trend.isUp ? "+" : "-"}{trend.value}%
              </span>
            )}
            {description && (
              <p className="text-xs text-muted-foreground font-medium">
                {description}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
