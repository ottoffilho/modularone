import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { generateCsrfToken, storeCsrfToken } from "@/lib/supabase";
import routes from "./routes";

const queryClient = new QueryClient();

// Page transition wrapper
const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  
  return (
    <div className="transition-opacity duration-300 animate-fade-in">
      {children}
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {routes.map((route, i) => {
        // For routes with children (nested routes)
        if (route.children) {
          return (
            <Route key={i} path={route.path} element={route.element}>
              {route.children.map((childRoute, j) => (
                <Route
                  key={`${i}-${j}`}
                  path={childRoute.path.replace(route.path, '')}
                  element={
                    <PageTransition>
                      {childRoute.element}
                    </PageTransition>
                  }
                />
              ))}
            </Route>
          );
        }
        
        // For simple routes
        return (
          <Route
            key={i}
            path={route.path}
            element={
              <PageTransition>
                {route.element}
              </PageTransition>
            }
          />
        );
      })}
    </Routes>
  );
};

const App = () => {
  // Inicializar token CSRF na inicialização da aplicação
  useEffect(() => {
    const token = generateCsrfToken();
    storeCsrfToken(token);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <div className="min-h-screen bg-background">
                <AppRoutes />
              </div>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
