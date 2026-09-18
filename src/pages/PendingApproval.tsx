import * as React from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut, Clock } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function PendingApproval() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 text-center space-y-6 animate-in zoom-in-95 duration-500">
        <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
          <ShieldAlert className="h-10 w-10 text-amber-600" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">Acceso Pendiente</h1>
          <p className="text-slate-500">
            Hola <span className="font-semibold text-slate-700">{user?.displayName || user?.email}</span>, 
            tu cuenta ha sido registrada pero aún no ha sido autorizada por un administrador.
          </p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3 text-left border border-slate-100">
          <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600">
            <p className="font-bold text-slate-900 mb-1">¿Qué sigue?</p>
            <p className="leading-relaxed">Un administrador revisará tu solicitud para asignarte los permisos correspondientes.</p>
            <p className="mt-3 font-semibold text-slate-700">Por favor contacta al administrador:</p>
            <p className="text-primary font-black">ingbiomedico@ucihonda.com.co</p>
          </div>
        </div>

        <div className="pt-4 border-t flex flex-col gap-3">
          <Button variant="outline" onClick={logout} className="rounded-xl">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
          </Button>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            BioMed CRM • Equipo Biomédicos Aplicativo
          </p>
        </div>
      </div>
    </div>
  );
}
