import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Stethoscope, ShieldCheck, Activity, ArrowRight } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-screen flex flex-col justify-center">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-in slide-in-from-left-8 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" /> Gestión Tecnológica Hospitalaria
            </div>
            
            <h1 className="text-6xl lg:text-8xl font-black tracking-tighter text-slate-900 leading-[0.9]">
              <span className="text-primary italic">Biotech</span><br />
              Ingeniería <span className="opacity-30">Clínica</span>
            </h1>
            
            <p className="text-xl text-slate-500 max-w-lg leading-relaxed font-medium">
              Gestión profesional de activos biomédicos, mantenimiento preventivo y aseguramiento de la calidad hospitalaria.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                onClick={() => navigate(user ? '/' : '/login')}
                className="rounded-2xl h-14 px-8 text-lg shadow-xl shadow-primary/20 group"
              >
                {user ? 'Ir al Dashboard' : 'Iniciar Sesión'}
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="rounded-2xl h-14 px-8 text-lg border-slate-200"
              >
                Saber más
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900">100%</span>
                <span className="text-sm text-slate-500">Cumplimiento</span>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-slate-900">Real-time</span>
                <span className="text-sm text-slate-500">Monitoreo</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block relative animate-in zoom-in-95 duration-1000 delay-200">
            <div className="relative z-10 bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="h-32 bg-slate-50 rounded-3xl p-6 flex flex-col justify-between">
                    <Activity className="h-8 w-8 text-primary" />
                    <div className="h-2 w-12 bg-primary/20 rounded-full" />
                  </div>
                  <div className="h-48 bg-slate-900 rounded-3xl p-6 flex flex-col justify-between text-white overflow-hidden relative">
                    <img src="/logo.png" alt="Branding" className="h-full w-full object-contain opacity-40 scale-125 -rotate-12 absolute -right-4 -bottom-4" />
                    <div className="relative z-10 space-y-2">
                      <div className="h-2 w-full bg-white/20 rounded-full" />
                      <div className="h-2 w-2/3 bg-white/20 rounded-full" />
                    </div>
                  </div>
                </div>
                <div className="space-y-4 pt-8">
                  <div className="h-48 bg-primary rounded-3xl p-6 flex flex-col justify-between text-white">
                    <ShieldCheck className="h-8 w-8 text-white" />
                    <div className="space-y-2">
                      <div className="h-2 w-full bg-white/30 rounded-full" />
                      <div className="h-2 w-1/2 bg-white/30 rounded-full" />
                    </div>
                  </div>
                  <div className="h-32 bg-slate-50 rounded-3xl p-6 flex flex-col justify-between">
                    <div className="flex gap-1">
                      {[1, 2, 3].map(i => <div key={i} className="h-6 w-1 bg-primary/40 rounded-full" />)}
                    </div>
                    <div className="h-2 w-16 bg-slate-200 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative circles */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-xl animate-pulse" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-500/10 rounded-full blur-xl animate-pulse delay-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
