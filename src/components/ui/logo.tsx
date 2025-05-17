
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <Zap className="h-6 w-6 text-primary" />
    </div>
  );
}
