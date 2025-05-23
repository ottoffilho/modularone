import { defineConfig, ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { IncomingMessage, ServerResponse } from "http";

// Plugin para adicionar cabeçalhos de segurança
const securityHeaders = () => {
  return {
    name: 'security-headers',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((_req: IncomingMessage, res: ServerResponse, next: () => void) => {
        res.setHeader('Content-Security-Policy', 
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.gpteng.co; " +
          "connect-src 'self' https://*.supabase.co https://brasilapi.com.br https://api.brasilapi.com.br; " +
          "img-src 'self' data:; " +
          "style-src 'self' 'unsafe-inline'; " +
          "font-src 'self'; " +
          "frame-ancestors 'none';"
        );
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        next();
      });
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode: _mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    securityHeaders(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
