import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTechnologyScope, SCOPES_CONFIG } from '@/lib/TechnologyScopeContext';
import { TechnologyScope } from '@/types';
import { 
  Stethoscope, 
  Laptop, 
  Cpu, 
  Layers, 
  ChevronDown, 
  Check, 
  Grid,
  ArrowRightLeft
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function HeaderScopeSelector() {
  const navigate = useNavigate();
  const { scope, setScope, scopeConfig, allScopes } = useTechnologyScope();

  const getScopeIcon = (scopeId: TechnologyScope) => {
    switch (scopeId) {
      case 'biomedical':
        return <Stethoscope className="h-4 w-4" />;
      case 'computing':
        return <Laptop className="h-4 w-4" />;
      case 'infrastructure':
        return <Cpu className="h-4 w-4" />;
      case 'all':
      default:
        return <Layers className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Botón selector con Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs select-none cursor-pointer",
            "hover:opacity-90 active:scale-98",
            scopeConfig.badgeBg,
            scopeConfig.badgeBorder,
            scopeConfig.textColor
          )}
        >
          <div className="shrink-0">
            {getScopeIcon(scope)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-slate-500 font-medium">Área:</span>
            <span className="font-extrabold">{scopeConfig.shortLabel}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl shadow-xl bg-white border border-slate-200">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-2 py-1.5">
              Cambiar Área Tecnológica
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <div className="space-y-1">
              {allScopes.map((s) => {
                const isSelected = s.id === scope;
                const Icon = s.icon;
                return (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setScope(s.id)}
                    className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-colors text-xs",
                      isSelected ? "bg-slate-100 font-bold text-slate-900" : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <div className={cn(
                      "p-1.5 rounded-lg border shrink-0 mt-0.5",
                      s.badgeBg,
                      s.badgeBorder,
                      s.textColor
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold truncate text-slate-900">{s.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 leading-tight">
                        {s.subtitle}
                      </p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigate('/portal')}
            className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors mt-1"
          >
            <Grid className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>Ver Portal de Módulos (Hub Inicial)</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Botón rápido para volver al Portal / Hub */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/portal')}
        className="h-8 px-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl hidden md:flex items-center gap-1.5"
        title="Abrir portal de selección de módulos"
      >
        <Grid className="h-3.5 w-3.5 text-slate-400" />
        <span>Módulos</span>
      </Button>
    </div>
  );
}
