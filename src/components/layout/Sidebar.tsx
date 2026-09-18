import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Stethoscope, 
  ClipboardList, 
  Users, 
  Settings, 
  LogOut,
  ArrowLeftRight,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Clock,
  UserCog,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { useAuth } from '@/lib/AuthContext';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function Sidebar({ isCollapsed }: { isCollapsed?: boolean }) {
  const location = useLocation();
  const { logout, user } = useAuth();
  const { googleStatus } = useConnectionMonitor();
  const [pendingCount, setPendingCount] = React.useState(0);

  const UserAvatar = ({ user, className }: { user: any, className?: string }) => {
    if (user?.photoURL) {
      return (
        <img 
          src={user.photoURL} 
          alt={user.displayName || ''} 
          className={cn("h-full w-full object-cover", className)}
          referrerPolicy="no-referrer"
        />
      );
    }

    const gender = user?.gender || 'male';
    const bgColor = gender === 'female' ? 'bg-pink-100' : gender === 'male' ? 'bg-blue-100' : 'bg-slate-100';
    const emoji = gender === 'female' ? '👩' : gender === 'male' ? '🧔' : '🐶';

    return (
      <div className={cn("h-full w-full flex items-center justify-center text-xl select-none", bgColor, className)}>
        {emoji}
      </div>
    );
  };

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const menuItems: any[] = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/', sectionId: 'dashboard' },
    { icon: Stethoscope, label: 'Inventario', href: '/inventory', sectionId: 'inventory' },
    { icon: Layers, label: 'Instru. / Menores', href: '/minor-devices', sectionId: 'minor_devices' },
    { icon: ArrowLeftRight, label: 'Traslados', href: '/transfers', sectionId: 'transfers' },
    { icon: Clock, label: 'Cronograma', href: '/schedule', sectionId: 'schedule' },
    { icon: ClipboardList, label: 'Reportes', href: '/reports', sectionId: 'reports' },
    { icon: FileText, label: 'Formatos', href: '/forms', sectionId: 'forms' },
    { icon: ShieldCheck, label: 'Normativa', href: '/compliance', sectionId: 'compliance' },
    { icon: AlertTriangle, label: 'Alertas', href: '/alerts', sectionId: 'alerts' },
    { icon: Users, label: 'Proveedores', href: '/providers', sectionId: 'providers' },
    { icon: Settings, label: 'Configuración', href: '/settings', sectionId: 'settings' },
  ];

  // Filter based on permissions
  const filteredMenuItems = menuItems.filter(item => {
    if (isAdmin) return true;
    if (item.sectionId === 'dashboard') return true;
    if (item.sectionId === 'minor_devices') return true;
    if (item.sectionId === 'settings') return true;
    return user?.permissions?.[item.sectionId]?.view;
  });

  React.useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'users'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (error) => {
      console.warn("Sidebar pending users snapshot error:", error);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  if (isAdmin) {
    filteredMenuItems.splice(filteredMenuItems.length - 1, 0, { 
      icon: UserCog, 
      label: 'Gestión Usuarios', 
      href: '/users',
      sectionId: 'users',
      badge: pendingCount > 0 ? pendingCount : undefined
    });
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className={cn(
        "flex h-20 items-center border-b transition-all duration-300",
        isCollapsed ? "justify-center" : "px-6"
      )}>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          {!isCollapsed && (
            <span className="text-xl font-black tracking-tight text-slate-900 uppercase animate-in fade-in duration-500">Biotech</span>
          )}
        </div>
      </div>
      
      <nav className="flex-1 space-y-1.5 p-4 overflow-y-auto">
        {filteredMenuItems.map((item: any) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
                isCollapsed ? "justify-center px-0" : "justify-between px-4",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-bold"
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex items-center">
                <item.icon className={cn(
                  "h-5 w-5 transition-colors",
                  !isCollapsed && "mr-3",
                  isActive ? "text-primary-foreground" : "text-slate-400 group-hover:text-slate-900"
                )} />
                {!isCollapsed && (
                  <span className="animate-in fade-in slide-in-from-left-2 duration-300">{item.label}</span>
                )}
              </div>
              {!isCollapsed && item.badge && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
              {isCollapsed && item.badge && (
                <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn(
        "px-6 py-2 border-t border-slate-50 flex items-center gap-2",
        isCollapsed ? "justify-center px-0" : ""
      )}>
        <div className={cn(
          "w-2 h-2 rounded-full",
          googleStatus.status === 'ok' ? "bg-emerald-500 animate-pulse" : 
          googleStatus.status === 'error' ? "bg-rose-500" : "bg-amber-500"
        )} title={`Estado Google: ${googleStatus.status.toUpperCase()}`} />
        {!isCollapsed && (
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Google {googleStatus.status === 'ok' ? 'Online' : 'Revisar'}
            </span>
            {googleStatus.lastCheck && (
              <span className="text-[9px] text-slate-300 font-medium leading-none mt-0.5">
                {new Date(googleStatus.lastCheck).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={cn(
        "p-4 border-t bg-slate-50/50 transition-all",
        isCollapsed ? "flex flex-col items-center" : ""
      )}>
        <div className={cn(
          "px-4 py-3 mb-4 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center gap-3",
          isCollapsed ? "w-12 h-12 p-0 justify-center mb-6" : ""
        )}>
          <div className={cn(
            "rounded-xl overflow-hidden border-2 border-slate-50 ring-1 ring-slate-100 bg-slate-50",
            isCollapsed ? "h-full w-full" : "h-10 w-10 min-w-10"
          )}>
            <UserAvatar user={user} />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Operador Técnico</p>
              <p className="text-sm font-black text-slate-900 truncate leading-tight">{user?.displayName || user?.email}</p>
              <p className="text-[9px] text-primary font-black uppercase mt-0.5 tracking-tighter flex items-center gap-1">
                <ShieldCheck className="h-2 w-2" />
                {user?.role}
              </p>
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          className={cn(
            "text-slate-500 font-bold hover:text-destructive hover:bg-destructive/5 rounded-xl transition-colors",
            isCollapsed ? "w-10 h-10 p-0 justify-center" : "w-full justify-start"
          )}
          onClick={() => logout()}
          title={isCollapsed ? "Cerrar Sesión" : undefined}
        >
          <LogOut className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
          {!isCollapsed && <span>Cerrar Sesión</span>}
        </Button>
      </div>
    </div>
  );
}
