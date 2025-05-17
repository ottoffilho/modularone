import { cn } from "@/lib/utils";
// import { Zap } from "lucide-react"; // Zap não é mais usado
import AppLogoSrc from "@/assets/logo/modularlogo41.png"; // Importar a imagem do logo

interface LogoProps {
  className?: string;
  // showText?: boolean; // showText não é mais relevante se o logo é apenas gráfico
}

export function Logo({
  className
}: LogoProps) {
  return (
    <img 
      src={AppLogoSrc} 
      alt="ModularOne Logo"
      className={cn("object-contain", className)} // object-contain para manter proporções
    />
  );
}
