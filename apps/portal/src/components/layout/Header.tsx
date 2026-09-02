import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Bell, Server, Box, CornerDownLeft } from 'lucide-react';
import { useSidebar } from './SidebarStore';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useApplications } from '@/hooks/useApplications';

const CLUSTERS = ['kubernal-prod', 'kubernal-staging', 'kubernal-dev'];
const NAMESPACES = [
  { value: 'prod', label: 'prod' },
  { value: 'staging', label: 'staging' },
  { value: 'dev', label: 'dev' },
];
const MAX_RESULTS = 8;

export function Header(): JSX.Element {
  const { user } = useAuth();
  const {
    setMobileOpen,
    currentCluster,
    currentNamespace,
    notificationCount,
    setCurrentCluster,
    setCurrentNamespace,
  } = useSidebar();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const userInitials = user?.name
    ? ((): string => {
        const parts = user.name.trim().split(' ');
        return parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : user.name.slice(0, 2).toUpperCase();
      })()
    : '??';

  const { data: applications } = useApplications();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = applications ?? [];
    if (!q) return list.slice(0, MAX_RESULTS);
    return list
      .filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          (app.team?.name?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, MAX_RESULTS);
  }, [applications, query]);

  useEffect(() => {
    if (searchOpen) {
      setQuery('');
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 'k') {
        const target = e.target as HTMLElement | null;
        if (target) {
          const tag = target.tagName;
          if (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            target.isContentEditable
          ) {
            return;
          }
        }
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return (): void => window.removeEventListener('keydown', handler);
  }, []);

  const selectResult = (appId: string): void => {
    setSearchOpen(false);
    navigate(`/catalogue/${appId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      selectResult(results[activeIndex].id);
    }
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden shrink-0"
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir la barre latérale"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>

      {/* Search trigger */}
      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground w-64 hover:border-muted-foreground/30 transition-colors text-left"
        aria-label="Ouvrir la recherche"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Rechercher...</span>
        <kbd className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">Rechercher une application</DialogTitle>
          <DialogDescription className="sr-only">
            Tapez le nom d'une application pour la rechercher.
          </DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher une application..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-flex rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Search className="h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                  {query ? 'Aucune application trouvée' : 'Commencez à taper pour rechercher'}
                </p>
              </div>
            ) : (
              <ul role="listbox" className="space-y-0.5">
                {results.map((app, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <li key={app.id} role="option" aria-selected={isActive}>
                      <button
                        type="button"
                        onClick={() => selectResult(app.id)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-accent/10 text-foreground'
                            : 'text-foreground/80 hover:bg-secondary/50'
                        }`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Box className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{app.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {app.team?.name ?? 'Aucune équipe'}
                          </p>
                        </div>
                        {isActive && (
                          <CornerDownLeft
                            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-background border border-border px-1.5 py-0.5 font-mono">
                  ↑
                </kbd>
                <kbd className="rounded bg-background border border-border px-1.5 py-0.5 font-mono">
                  ↓
                </kbd>
                naviguer
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded bg-background border border-border px-1.5 py-0.5 font-mono">
                  ↵
                </kbd>
                ouvrir
              </span>
              <span className="ml-auto">
                {results.length} résultat{results.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex-1" />

      {/* Cluster selector */}
      <div className="hidden lg:flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-k8s-running shrink-0" />
        <label htmlFor="cluster-select" className="sr-only">
          Cluster
        </label>
        <select
          id="cluster-select"
          value={currentCluster}
          onChange={(e) => setCurrentCluster(e.target.value)}
          className="bg-card text-foreground border-border text-xs font-mono focus:ring-0 cursor-pointer hover:text-foreground transition-colors rounded px-1 py-0.5"
        >
          {CLUSTERS.map((c) => (
            <option key={c} value={c} className="bg-card text-foreground">
              {c}
            </option>
          ))}
        </select>
      </div>
      <span className="hidden lg:block text-muted-foreground/30">·</span>

      {/* Namespace picker */}
      <div className="hidden lg:flex items-center gap-1.5">
        <Server className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="namespace-select" className="sr-only">
          Namespace
        </label>
        <select
          id="namespace-select"
          value={currentNamespace}
          onChange={(e) => setCurrentNamespace(e.target.value)}
          className="bg-card text-foreground border-border text-xs font-mono focus:ring-0 cursor-pointer hover:text-foreground transition-colors rounded px-1 py-0.5"
        >
          {NAMESPACES.map((ns) => (
            <option key={ns.value} value={ns.value} className="bg-card text-foreground">
              {ns.label}
            </option>
          ))}
        </select>
      </div>
      <span className="hidden lg:block text-muted-foreground/30">·</span>

      {/* Notifications */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 shrink-0"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {notificationCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-k8s-failed px-1 text-[9px] font-bold text-white">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </Button>

      <ThemeToggle />

      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-linear-to-br from-accent to-accent/60 text-white text-xs">
          {userInitials}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}
