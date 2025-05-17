import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

// Hook simples para media query
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);

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
  
  let mainPaddingLeft = 'md:pl-64'; // Largura da sidebar expandida em desktop
  if (isMobile) {
    mainPaddingLeft = 'pl-0'; // Sem padding fixo em mobile, sidebar é overlay
  } else if (isDesktopSidebarCollapsed) {
    mainPaddingLeft = 'md:pl-20'; // Largura da sidebar colapsada em desktop (ex: w-20)
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
        <main className={`flex-1 p-4 md:p-6 overflow-y-auto ${mainPaddingLeft} transition-all duration-300 ease-in-out`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
