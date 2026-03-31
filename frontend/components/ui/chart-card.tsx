import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { SectionHeader } from "@/components/layout";

interface ChartCardProps {
  title: string;
  icon: ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  minHeight?: string;
  children: ReactNode;
  className?: string;
  titleExtra?: ReactNode;
}

export function ChartCard({
  title,
  icon,
  isLoading,
  isEmpty,
  emptyMessage = "No data available",
  emptyDescription,
  emptyIcon,
  minHeight = "min-h-[220px]",
  children,
  className,
  titleExtra,
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col flex-1 min-h-0">
        <SectionHeader icon={icon} title={title} extra={titleExtra} />

        {isLoading ? (
          <div className={`${minHeight} flex items-center justify-center`}>
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
        ) : isEmpty ? (
          <div className={`${minHeight} flex flex-col items-center justify-center text-center`}>
            {emptyIcon && <div className="text-white/15 mb-3">{emptyIcon}</div>}
            <p className="text-sm font-medium text-white/60">{emptyMessage}</p>
            {emptyDescription && <p className="text-xs text-white/40 mt-1">{emptyDescription}</p>}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
