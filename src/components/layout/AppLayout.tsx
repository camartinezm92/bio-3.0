import * as React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { HeaderScopeSelector } from './HeaderScopeSelector';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <div className={cn(
        "relative transition-all duration-300 ease-in-out border-r bg-white shadow-sm z-30",
        isCollapsed ? "w-20" : "w-64"
      )}>
        <Sidebar isCollapsed={isCollapsed} />
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-10 h-6 w-6 rounded-full border bg-white shadow-sm hover:bg-slate-50 z-50 transition-transform active:scale-90"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3 text-slate-600" />
          ) : (
            <ChevronLeft className="h-3 w-3 text-slate-600" />
          )}
        </Button>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar con selector de ámbito tecnológico */}
        <header className="h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-xs px-4 md:px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 hidden sm:inline">
              Gestión Tecnológica
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-slate-600">
              UCI Honda
            </span>
          </div>

          <div className="flex items-center gap-3">
            <HeaderScopeSelector />
          </div>
        </header>

        {/* Contenido principal con scroll */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
