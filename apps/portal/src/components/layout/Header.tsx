import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarStore';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function Header() {
  const { setMobileOpen, user } = useSidebar();

  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir la barre latérale"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-linear-to-br from-blue-500 to-violet-600 text-white text-xs">
            {user.initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
