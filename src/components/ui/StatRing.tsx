import { cn } from './Card';

interface StatRingProps {
  value: number;
  max?: number;
  label: string;
  subLabel?: string;
  className?: string;
  color?: string; // Tailwind color class like 'text-primary'
}

export function StatRing({ 
  value, 
  max = 100, 
  label, 
  subLabel,
  className,
  color = 'text-primary' 
}: StatRingProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const strokeDashoffset = circumference - percentage * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Background circle */}
        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            className="text-border/40"
          />
          {/* Progress circle */}
          <circle
            cx="48"
            cy="48"
            r={radius}
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn("transition-all duration-1000 ease-out", color)}
          />
        </svg>
        <div className="text-center">
          <span className="text-xl font-bold text-text block leading-none">{value}</span>
          {subLabel && <span className="text-xs text-muted mt-1">{subLabel}</span>}
        </div>
      </div>
      <span className="text-sm font-medium text-muted mt-3">{label}</span>
    </div>
  );
}
