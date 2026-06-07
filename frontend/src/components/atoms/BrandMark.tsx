import { cn } from "@/lib/utils";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-semibold text-white shadow-sm">
        <span className="font-heading tracking-[0.2em]">OC</span>
      </div>
      <div className={cn("leading-tight", compact && "md:hidden")}>
        <div className="font-heading text-sm uppercase tracking-[0.26em] text-strong">
          OPENCLAW
        </div>
        <div className="text-[11px] font-medium text-quiet">Mission Control</div>
      </div>
    </div>
  );
}
