
import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({
  className,
  showText = true
}: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <Zap className="h-6 w-6 text-primary" />
      {showText && <span className="ml-2 font-bold text-xl">ModularOne</span>}
    </div>
  );
}
