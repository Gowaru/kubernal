import { create } from 'zustand';

interface UserInfo {
  name: string;
  email: string;
  role: string;
  initials: string;
}

interface SidebarState {
  collapsed: boolean;
  mobileOpen: boolean;
  pendingApprovals: number;
  user: UserInfo;
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
  pendingApprovals: 3,
  user: {
    name: 'Alex D.',
    email: 'alex@kubernal.io',
    role: 'Platform Engineer',
    initials: 'AD',
  },
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
