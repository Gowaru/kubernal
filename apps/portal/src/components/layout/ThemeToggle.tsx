import { type JSX } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';

export function ThemeToggle(): JSX.Element {
  const { isDark, toggle } = useTheme();

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Basculer le thème">
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
