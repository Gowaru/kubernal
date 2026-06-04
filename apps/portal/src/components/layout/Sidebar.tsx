import { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutGrid,
  Rocket,
  Eye,
  Cloud,
  Users,
  FileJson,
  Shield,
  Settings,
  Box,
  Network,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_SECTIONS, PLATFORM_VERSION } from '@/lib/constants';
import { useSidebar } from './SidebarStore';
import { useDeployments } from '@/hooks/useDeployments';
import { useK8sEvents } from '@/hooks/useK8sEvents';
import { MOCK_CLUSTER } from '@/mocks/k8s-data';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const iconMap: Record<string, typeof LayoutDashboard> = {
  LayoutDashboard, LayoutGrid, Rocket, Eye, Cloud, Users, FileJson, Shield, Settings, Box, Network, AlertTriangle,
};

const SHORTCUT_MAP: Record<string, string> = {
  '1': '/',
  '2': '/catalogue',
  '3': '/deployments',
  '4': '/observability',
  '5': '/environments',
  '6': '/k8s/pods',
  '7': '/k8s/services',
  '8': '/k8s/events',
  '9': '/teams',
  '0': '/templates',
};

export function Sidebar() {
  const { collapsed, mobileOpen, toggle, setMobileOpen, pendingApprovals, user, setPendingApprovals } = useSidebar();
  const { data: deployments } = useDeployments();
  const { data: k8sEvents = [] } = useK8sEvents(MOCK_CLUSTER.namespace);
  const navigate = useNavigate();

  useEffect(() => {
    if (!deployments) return;
    const count = deployments.filter((d) => d.status === 'pending').length;
    setPendingApprovals(count);
  }, [deployments, setPendingApprovals]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      if (e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        navigate('/policies');
        return;
      }
      if (e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        navigate('/settings');
        return;
      }
      if (e.key in SHORTCUT_MAP) {
        e.preventDefault();
        navigate(SHORTCUT_MAP[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  const warningEventCount = k8sEvents.filter((e) => e.type === 'Warning').length;

  const sidebarContent = (
    <div
      className={cn(
        'flex h-full flex-col border-r border-border bg-sidebar-background transition-all duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <img
          src="/other-logo-kubernal.png"
          alt="Kubernal"
          className={cn(
            'shrink-0 transition-all duration-300',
            collapsed ? 'h-8 w-8' : 'h-9 w-9',
          )}
        />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-sidebar-primary-foreground">
              Kubernal
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {PLATFORM_VERSION}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-5 scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = iconMap[item.icon];
                const showBadge = item.badge === 'pending' && pendingApprovals > 0;
                return (
                  <Tooltip
                    key={item.href}
                    delayDuration={collapsed ? 100 : 1000000}
                  >
                    <TooltipTrigger asChild>
                      <NavLink
                        to={item.href}
                        end={item.href === '/'}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-all duration-200',
                            collapsed && 'justify-center px-0',
                            isActive
                              ? 'text-accent'
                              : 'text-sidebar-foreground hover:text-sidebar-accent-foreground',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {/* Active indicator */}
                            <span
                              className={cn(
                                'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-200',
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
                              )}
                            />

                            <div
                              className={cn(
                                'flex items-center justify-center rounded-lg p-1.5 transition-all duration-200',
                                isActive
                                  ? 'bg-accent/10 text-accent'
                                  : 'text-sidebar-foreground group-hover:bg-sidebar-accent group-hover:text-sidebar-accent-foreground',
                                collapsed && 'p-2',
                              )}
                            >
                              <Icon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                            </div>

                            {!collapsed && (
                              <div className="flex flex-1 items-center justify-between min-w-0">
                                <span>{item.label}</span>
                                <div className="flex items-center gap-1.5">
                                  {showBadge && (
                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                                      {pendingApprovals}
                                    </span>
                                  )}
                                  {item.badge === 'warning' && warningEventCount > 0 && (
                                    <span className="ml-auto bg-amber-500/10 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">
                                      {warningEventCount}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                                    {item.shortcut}
                                  </span>
                                </div>
                              </div>
                            )}

                            {collapsed && showBadge && (
                              <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-sidebar-background" />
                            )}
                          </>
                        )}
                      </NavLink>
                    </TooltipTrigger>
                    {collapsed && (
                      <TooltipContent side="right" className="flex items-center gap-2">
                        <span>{item.label}</span>
                        {showBadge && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                            {pendingApprovals}
                          </span>
                        )}
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-border p-3">
        {collapsed ? (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button className="flex w-full items-center justify-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent/60 text-xs font-bold text-white shadow-lg shadow-accent/20">
                  {user.initials}
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.role}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent/60 text-xs font-bold text-white shadow-sm">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-accent-foreground">
                {user.name}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {user.role}
              </p>
            </div>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Déconnexion"
              title="Fonctionnalité à venir"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="mt-2 flex w-full items-center justify-center rounded-lg py-1.5 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          aria-label={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:block h-full">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-64 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
