import { Logo } from "./logo";
import { cn } from "@/lib/utils";

interface AnimatedLogoLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  message?: string;
}

export function AnimatedLogoLoader({ size = 'md', className, message }: AnimatedLogoLoaderProps) {
  const logoSizeClasses = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-24 w-24",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4 p-4", className)}>
      <Logo className={cn("animate-pulse", logoSizeClasses[size])} />
      {message && <p className="text-muted-foreground text-sm animate-pulse">{message}</p>}
    </div>
  );
} 