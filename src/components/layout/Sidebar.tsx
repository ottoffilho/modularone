import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Zap, 
  Upload, 
  Settings,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Logo } from '@/components/ui/logo';

interface NavItemProps {
  to: string;
  icon: React.ReactElement;
  label: string;
  isDesktopCollapsed: boolean;
  isActive: boolean;
  iconColor: string;
}

const NavItem = ({ to, icon, label, isDesktopCollapsed, isActive, iconColor }: NavItemProps) => {
  const coloredIcon = React.cloneElement(icon, {
    color: isActive ? 'currentColor' : iconColor,
    className: cn(icon.props.className, 'h-5 w-5')
  });

  return (
    <NavLink
      to={to}
      className={({ isActive: navLinkIsActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-in-out",
          navLinkIsActive
            ? "bg-[#daa916] text-primary-foreground shadow-md"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          isDesktopCollapsed && "justify-center"
        )
      }
      title={isDesktopCollapsed ? label : undefined}
    >
      <span className={cn(isDesktopCollapsed && "mx-auto")}>{coloredIcon}</span>
      {!isDesktopCollapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
};

interface SidebarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
  isDesktopCollapsed: boolean;
  isMobile: boolean;
}

const Sidebar = ({ 
  isMobileMenuOpen, 
  setIsMobileMenuOpen, 
  isDesktopCollapsed, 
  isMobile 
}: SidebarProps) => {
  
  const location = useLocation();

  const handleLinkClick = () => {
    if (isMobile) {
      setIsMobileMenuOpen(false);
    }
  };

  const sidebarWidthClass = isMobile ? 'w-64' : (isDesktopCollapsed ? 'w-20' : 'w-64');

  const sidebarClasses = cn(
    "fixed md:sticky inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300 ease-in-out",
    sidebarWidthClass,
    isMobile ? (isMobileMenuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full") : "translate-x-0"
  );

  const overlayClasses = cn(
    "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-in-out md:hidden",
    isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
  );
  
  const navItems = [
    { to: "/dashboard", icon: <LayoutDashboard />, label: "Dashboard", color: "#3B82F6" },
    { to: "/clientes", icon: <Users />, label: "Clientes", color: "#22C55E" },
    { to: "/ucs", icon: <Zap />, label: "Unidades Consumidoras", color: "#F59E0B" },
    { to: "/faturas", icon: <Upload />, label: "Faturas", color: "#6366F1" },
    { to: "/configuracoes", icon: <Settings />, label: "Configurações", color: "#6B7280" },
  ];

  return (
    <>
      <aside className={sidebarClasses}>
        <div className={cn(
          "flex h-16 items-center border-b px-4 shrink-0", 
          isDesktopCollapsed && !isMobile ? "justify-center px-2" : "justify-between"
        )}>
          {!isDesktopCollapsed || isMobile ? (
            <NavLink to="/dashboard" className="flex items-center gap-2" onClick={handleLinkClick}>
              <Logo className="h-7 w-7" />
              {!isDesktopCollapsed && <span className="font-bold text-lg">ModularOne</span>}
            </NavLink>
          ) : (
            <Logo className="h-7 w-7" />
          )}
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </Button>
          )}
        </div>
        <ScrollArea className="flex-1">
          <nav className="grid gap-1 p-2" onClick={handleLinkClick}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <NavItem 
                  key={item.to} 
                  to={item.to} 
                  icon={item.icon} 
                  label={item.label} 
                  isDesktopCollapsed={isDesktopCollapsed && !isMobile}
                  isActive={isActive}
                  iconColor={item.color}
                />
              );
            })}
          </nav>
        </ScrollArea>
      </aside>
      
      {isMobile && (
        <div
          className={overlayClasses}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
