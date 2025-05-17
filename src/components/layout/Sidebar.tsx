
import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  Zap, 
  Upload, 
  Settings,
  Bot,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NavItem = ({ to, icon, label }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )
      }
    >
      <span className="h-5 w-5">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
};

interface SidebarProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const Sidebar = ({ open, setOpen }: SidebarProps) => {
  const [isMobile, setIsMobile] = useState(false);

  // Check viewport width on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Close sidebar when clicking a link on mobile
  const handleLinkClick = () => {
    if (isMobile) {
      setOpen(false);
    }
  };

  const sidebarClasses = cn(
    "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-background border-r transition-transform duration-300 ease-in-out",
    isMobile ? (open ? "translate-x-0" : "-translate-x-full") : "translate-x-0"
  );

  const overlayClasses = cn(
    "fixed inset-0 z-20 bg-black/50 transition-opacity duration-300 ease-in-out md:hidden",
    open ? "opacity-100" : "opacity-0 pointer-events-none"
  );

  return (
    <>
      <aside className={sidebarClasses}>
        <div className="flex h-16 items-center justify-between px-4 md:hidden">
          <span className="font-semibold">Menu</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="grid gap-2" onClick={handleLinkClick}>
            <NavItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            <NavItem to="/clientes" icon={<Users size={18} />} label="Clientes" />
            <NavItem to="/ucs" icon={<Zap size={18} />} label="Unidades Consumidoras" />
            <NavItem to="/faturas/upload" icon={<Upload size={18} />} label="Upload de Faturas" />
            <NavItem to="/ai-assistant" icon={<Bot size={18} />} label="Assistente IA" />
            <NavItem to="/configuracoes" icon={<Settings size={18} />} label="Configurações" />
          </nav>
        </ScrollArea>
      </aside>
      
      {/* Backdrop overlay for mobile */}
      <div
        className={overlayClasses}
        onClick={() => setOpen(false)}
      />
    </>
  );
};

export default Sidebar;
