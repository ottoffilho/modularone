import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

// Helper function moved outside the hook for stability
const getMediaQueryMatches = (q: string): boolean => {
  // Check for window and matchMedia availability (for SSR or testing environments)
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia(q).matches;
  }
  return false; // Default value if not in a browser environment
};

// Hook simples para media query
const useMediaQuery = (query: string): boolean => {
  // Initialize state with the current match status for the initial query.
  const [matches, setMatches] = useState<boolean>(() => getMediaQueryMatches(query));

  useEffect(() => {
    // This effect runs when 'query' changes, or on mount.

    // Handle non-browser environments or environments without matchMedia.
    if (typeof window === 'undefined' || !window.matchMedia) {
      // If the query changes, ensure 'matches' state is updated accordingly.
      const currentExpectedMatches = getMediaQueryMatches(query);
      if (matches !== currentExpectedMatches) { // Avoid unnecessary state update if value is already correct
        setMatches(currentExpectedMatches);
      }
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    // Update the 'matches' state to the current result of the new 'query'.
    // This is crucial because the useState initializer only runs on mount with the initial 'query'.
    // If 'query' prop changes, this ensures 'matches' is updated to the new query's current state.
    // We also check if the state already matches to prevent a potentially unnecessary re-render if the
    // query changes but results in the same match status initially.
    if (matches !== mediaQueryList.matches) {
        setMatches(mediaQueryList.matches);
    }

    // Handler for when the media query status changes in the future.
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Subscribe to the 'change' event on the MediaQueryList.
    mediaQueryList.addEventListener('change', handleChange);

    // Cleanup: remove the event listener when the component unmounts
    // or when the `query` changes (before the effect for the new query runs).
    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query, matches]); // Only re-run when the `query` string changes.
                // `getMediaQueryMatches` is stable (defined outside).
                // `setMatches` is stable (from useState).
                // `matches` is intentionally not included to break the cycle;
                // its synchronization is handled by the logic within the effect.

  return matches;
};

export default function AppLayout() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  const isMobile = useMediaQuery('(max-width: 767px)'); // md breakpoint

  const toggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };
  
  let mainPaddingLeft = 'md:pl-4'; // Reduzido de 'md:pl-64' para ficar mais próximo da sidebar
  if (isMobile) {
    mainPaddingLeft = 'pl-0'; // Sem padding fixo em mobile, sidebar é overlay
  } else if (isDesktopSidebarCollapsed) {
    mainPaddingLeft = 'md:pl-2'; // Reduzido de 'md:pl-20' para aumentar o espaço útil
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar 
        isMobileMenuOpen={isMobileSidebarOpen} 
        setIsMobileMenuOpen={setIsMobileSidebarOpen}
        isDesktopCollapsed={isDesktopSidebarCollapsed}
        isMobile={isMobile}
      />
      <div className="flex flex-col flex-1 w-full">
        <Header 
          onToggleMobileSidebar={toggleMobileSidebar}
          onToggleDesktopSidebar={toggleDesktopSidebar}
          isDesktopSidebarCollapsed={isDesktopSidebarCollapsed}
        />
        <main className={`flex-1 p-2 md:p-3 overflow-y-auto ${mainPaddingLeft} transition-all duration-300 ease-in-out`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
