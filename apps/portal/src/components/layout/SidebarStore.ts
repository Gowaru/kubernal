import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  pendingApprovals: number;
  currentCluster: string;
  currentNamespace: string;
  notificationCount: number;
  toggle: () => void;
  setMobileOpen: (open: boolean) => void;
  setPendingApprovals: (count: number) => void;
  setCurrentCluster: (cluster: string) => void;
  setCurrentNamespace: (ns: string) => void;
  setNotificationCount: (count: number) => void;
}

export const useSidebar = create<SidebarState>((set) => ({
  collapsed: false,
  mobileOpen: false,
  pendingApprovals: 0,
  currentCluster: 'kubernal-prod',
  currentNamespace: 'prod',
  notificationCount: 0,
  toggle: (): void => set((state) => ({ collapsed: !state.collapsed })),
  setMobileOpen: (open): void => set({ mobileOpen: open }),
  setPendingApprovals: (count): void => set({ pendingApprovals: count }),
  setCurrentCluster: (cluster): void => set({ currentCluster: cluster }),
  setCurrentNamespace: (ns): void => set({ currentNamespace: ns }),
  setNotificationCount: (count): void => set({ notificationCount: count }),
}));
