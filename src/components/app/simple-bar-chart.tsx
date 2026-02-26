import { cn } from "@/lib/utils";

type BarDatum = {
  label: string;
  value: number;
  secondaryValue?: number;
};

type SimpleBarChartProps = {
  data: BarDatum[];
  className?: string;
  primaryColorClass?: string;
  secondaryColorClass?: string;
  showSecondary?: boolean;
};

export function SimpleBarChart({
  data,
  className,
  primaryColorClass = "bg-sky-500",
  secondaryColorClass = "bg-emerald-500",
  showSecondary,
}: SimpleBarChartProps) {
  const maxValue = Math.max(1, ...data.flatMap((item) => [item.value, item.secondaryValue ?? 0]));

  return (
    <div className={cn("space-y-3", className)}>
      {data.map((item) => {
        const primaryWidth = Math.max((item.value / maxValue) * 100, item.value > 0 ? 4 : 0);
        const secondaryWidth = Math.max(((item.secondaryValue ?? 0) / maxValue) * 100, (item.secondaryValue ?? 0) > 0 ? 4 : 0);

        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{item.label}</span>
              <span>
                {item.value}
                {showSecondary ? ` / ${item.secondaryValue ?? 0}` : ""}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-100">
              <div className={cn("h-2 rounded", primaryColorClass)} style={{ width: `${primaryWidth}%` }} />
            </div>
            {showSecondary ? (
              <div className="h-2 overflow-hidden rounded bg-slate-100">
                <div className={cn("h-2 rounded", secondaryColorClass)} style={{ width: `${secondaryWidth}%` }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
