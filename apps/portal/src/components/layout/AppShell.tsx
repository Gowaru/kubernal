import { type JSX, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SkipNav } from '@/components/ui/SkipNav';

interface AppShellProps {
  children?: ReactNode;
}

export default function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SkipNav />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6 animate-fade-in-up">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}
