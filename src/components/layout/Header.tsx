import { Link } from 'react-router-dom';
import { Menu, X, Sun, Moon, User, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '../ui/logo';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onToggleDesktopSidebar: () => void;
  isDesktopSidebarCollapsed: boolean;
}

const Header = ({ 
  onToggleMobileSidebar, 
  onToggleDesktopSidebar, 
  isDesktopSidebarCollapsed 
}: HeaderProps) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6 shrink-0">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 hidden md:flex"
          onClick={onToggleDesktopSidebar}
        >
          {isDesktopSidebarCollapsed ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 md:hidden"
          onClick={onToggleMobileSidebar}
        >
          <Menu size={20} />
        </Button>
        <Link to="/dashboard" className="flex items-center space-x-2">
          <Logo className="h-7 w-7" />
          <span className="hidden font-bold md:inline-block text-lg">ModularOne</span>
        </Link>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? "Ativar modo claro" : "Ativar modo escuro"}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="rounded-full p-0 w-9 h-9 flex items-center justify-center"
            >
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="rounded-full w-full h-full object-cover" />
              ) : (
                <User size={20} />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user && (
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.user_metadata?.full_name || user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/perfil">Perfil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-red-500 hover:!text-red-500 focus:text-red-500 cursor-pointer"
            >
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
