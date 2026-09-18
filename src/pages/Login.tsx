import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Stethoscope } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <Card className="w-full max-w-md relative z-10 border-none shadow-2xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
        <CardHeader className="space-y-4 text-center pt-12 pb-8">
          <div className="flex justify-center">
            <div className="h-20 w-auto max-w-[200px] flex items-center justify-center">
              <img src="/logo.png" alt="Biotech Logo" className="h-full w-full object-contain" />
            </div>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-4xl font-black tracking-tight text-slate-900">Biotech</CardTitle>
            <CardDescription className="text-slate-500 text-base font-medium">
              Gestión de Equipos Biomédicos
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-12">
          <Button 
            variant="outline" 
            className="w-full h-14 rounded-2xl text-lg font-semibold border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
            onClick={() => loginWithGoogle()}
          >
            <img 
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
              alt="Google" 
              className="mr-3 h-5 w-5"
              referrerPolicy="no-referrer"
            />
            Continuar con Google
          </Button>
          
          <div className="mt-8 pt-8 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Seguridad Garantizada</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Acceso restringido a personal autorizado de la institución.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
