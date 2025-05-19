import React from 'react';

interface AppShellProps {
  title: string;
  description: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({ title, description, headerActions, children }: AppShellProps) {
  return (
    <div className="flex flex-col w-full h-full bg-background text-foreground">
      <header className="p-4 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {headerActions && <div>{headerActions}</div>}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
} 