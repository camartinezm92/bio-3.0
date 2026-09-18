import * as React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  UserPlus, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  MoreVertical,
  Edit2,
  Trash2,
  ArrowLeft,
  UserCheck,
  Lock,
  FlaskConical,
  Activity,
  Box,
  Eye,
  Plus,
  Save,
  Check,
  User as UserIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const SECTIONS = [
  { id: 'inventory', name: 'Inventario de Equipos' },
  { id: 'transfers', name: 'Traslados / Movimientos' },
  { id: 'reports', name: 'Reportes Técnicos' },
  { id: 'compliance', name: 'Cumplimiento / Normativa' },
  { id: 'alerts', name: 'Sistema de Alertas' },
  { id: 'providers', name: 'Directorio de Proveedores' },
  { id: 'schedule', name: 'Cronograma Mantenimiento' },
  { id: 'users', name: 'Gestión de Usuarios' }
];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<User[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as User[];
      setUsers(usersData);
    }, (error) => {
      console.warn("UserManagement users snapshot error:", error);
    });

    return () => unsubscribe();
  }, []);

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending' && u.email?.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleUpdateStatus = async (uid: string, status: 'active' | 'disabled') => {
    try {
      await updateDoc(doc(db, 'users', uid), { status });
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleUpdateRole = async (uid: string, role: 'ADMIN' | 'USER') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleDiscardUser = async (uid: string) => {
    if (!confirm('¿Estás seguro de descartar esta solicitud de acceso? El usuario será eliminado del registro.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      console.error('Error deleting user request:', error);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), {
        gender: selectedUser.gender || 'male',
        permissions: selectedUser.permissions || {}
      });
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  const togglePermission = (sectionId: string, action: 'view' | 'create' | 'edit' | 'delete') => {
    if (!selectedUser) return;
    
    const currentPermissions = selectedUser.permissions || {};
    const sectionPermissions = currentPermissions[sectionId] || { view: false, create: false, edit: false, delete: false };
    
    setSelectedUser({
      ...selectedUser,
      permissions: {
        ...currentPermissions,
        [sectionId]: {
          ...sectionPermissions,
          [action]: !sectionPermissions[action]
        }
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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
      <div className={cn("h-full w-full flex items-center justify-center text-2xl select-none", bgColor, className)}>
        {emoji}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2 font-bold text-xs uppercase tracking-wider">
              <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Menú
            </Button>
          </div>
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-slate-900 uppercase">
            Control de Usuarios
          </h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-tight">
            Autorización de accesos y gestión de perfiles técnicos del sistema.
          </p>
        </div>
      </div>

      {pendingUsers.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black flex items-center gap-2 text-amber-600 uppercase tracking-tighter">
              <Shield className="h-6 w-6" /> Solicitudes de Acceso Pendientes
            </h2>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-black rounded-lg">
              {pendingUsers.length} PENDIENTES
            </Badge>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingUsers.map((user) => (
              <Card key={user.uid} className="overflow-hidden border-none shadow-xl shadow-amber-200/20 bg-white ring-1 ring-amber-100 relative">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl overflow-hidden border-4 border-slate-50 shadow-md bg-slate-100">
                        <UserAvatar user={user} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-black text-slate-900 leading-none">{user.displayName || 'Usuario Nuevo'}</p>
                        <p className="text-xs text-slate-500 font-bold truncate">{user.email}</p>
                        <div 
                          className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors group"
                          onClick={() => copyToClipboard(user.uid)}
                        >
                          <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-md font-mono text-slate-400 group-hover:bg-primary/10 group-hover:text-primary">
                            UID: {user.uid}
                          </code>
                          <Edit2 className="h-2.5 w-2.5 text-slate-300 group-hover:text-primary" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        className="rounded-xl font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200/50"
                        onClick={() => handleUpdateStatus(user.uid, 'active')}
                      >
                        <UserCheck className="mr-2 h-4 w-4" /> VINCULAR
                      </Button>
                      <Button 
                        variant="outline"
                        className="rounded-xl font-black border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100"
                        onClick={() => handleDiscardUser(user.uid)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> DESCARTAR
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-none shadow-xl shadow-slate-200/20 rounded-[2rem] p-8 bg-slate-50/50 border border-slate-100">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 uppercase">Sin solicitudes pendientes</h3>
                <p className="text-xs font-bold text-slate-500">Todos los accesos están al día.</p>
              </div>
           </div>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between pt-10">
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Directorio de Usuarios Activos
          </h2>
          <div className="relative max-w-sm flex-1 ml-10">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Filtrar por correo..." 
              className="pl-10 h-10 bg-white border-slate-200 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-none shadow-2xl shadow-slate-200/50 overflow-hidden rounded-[2rem] ring-1 ring-slate-100">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-slate-50/80 font-black">
                  <tr>
                    <th className="px-8 py-5">Perfil Técnico</th>
                    <th className="px-8 py-5">Control de Acceso</th>
                    <th className="px-8 py-5">Estado Operativo</th>
                    <th className="px-8 py-5 text-right font-black">Acciones de Cuenta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {activeUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-2xl overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100 bg-slate-50">
                            <UserAvatar user={user} className="text-base" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 text-sm tracking-tight">{user.email}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.displayName || 'Técnico Externo'}</span>
                              <span className={cn(
                                "text-[9px] font-black uppercase px-1 rounded bg-slate-100 text-slate-400",
                                user.gender === 'female' ? "text-pink-500 bg-pink-50" : "text-blue-500 bg-blue-50"
                              )}>
                                {user.gender === 'female' ? 'FEM' : 'MASC'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "rounded-xl font-black px-3 py-1 text-[10px] uppercase tracking-wider",
                            user.role === 'ADMIN' ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-emerald-600 font-black text-xs uppercase tracking-tighter">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          CONECTADO / ACTIVO
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl">
                                  <MoreVertical className="h-5 w-5" />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-slate-100">
                              <DropdownMenuItem 
                                className="rounded-xl px-4 py-3 font-bold text-slate-600 focus:bg-slate-50 cursor-pointer flex items-center gap-3" 
                                onClick={() => {
                                  setSelectedUser(user);
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Lock className="h-4 w-4" />
                                Configurar Permisos
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl px-4 py-3 font-bold text-slate-600 focus:bg-slate-50 cursor-pointer flex items-center gap-3" onClick={() => handleUpdateRole(user.uid, user.role === 'ADMIN' ? 'USER' : 'ADMIN')}>
                                <Shield className="h-4 w-4" />
                                Cambiar a {user.role === 'ADMIN' ? 'Usuario' : 'Administrador'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-xl px-4 py-3 font-bold text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer flex items-center gap-3" onClick={() => handleUpdateStatus(user.uid, 'disabled')}>
                                <XCircle className="h-4 w-4" />
                                Deshabilitar Acceso
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-[1400px] w-[95vw] rounded-[2.5rem] p-6 sm:p-12 max-h-[95vh] overflow-hidden flex flex-col border-none shadow-[0_0_100px_rgba(0,0,0,0.15)] bg-white">
          <DialogHeader className="px-2 mb-4">
            <DialogTitle className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter leading-tight">Configurador de Perfil y Accesos</DialogTitle>
            <DialogDescription className="font-bold text-slate-500 text-base mt-1">
              Gestione la identidad técnica y defina el alcance operativo para <span className="text-primary border-b-2 border-primary/20 pb-0.5 break-all">{selectedUser?.email}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-2 py-8 space-y-12 scrollbar-hide">
            <div className="space-y-8">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-4">
                <div className="h-10 w-2 bg-primary rounded-full shadow-lg shadow-primary/20" />
                Identidad Visual en Sistema
              </h3>
              <div className="grid lg:grid-cols-3 gap-12 items-start">
                <div className="lg:col-span-2 space-y-6">
                  <div className="space-y-4">
                    <Label className="font-black text-slate-800 uppercase text-xs tracking-widest ml-1">Género del BioMédico (Referencia Visual)</Label>
                    <Select 
                      value={selectedUser?.gender || "male"} 
                      onValueChange={(val: any) => setSelectedUser(prev => prev ? ({ ...prev, gender: val }) : null)}
                    >
                      <SelectTrigger className="rounded-2xl h-16 border-slate-200 shadow-sm bg-white text-lg font-bold px-6">
                        <SelectValue placeholder="Seleccionar género" />
                      </SelectTrigger>
                      <SelectContent className="z-[100] rounded-2xl border-slate-100 shadow-2xl p-2 bg-white">
                        <SelectItem value="male" className="rounded-xl font-bold py-4 px-4 text-slate-700">Masculino (BioMédico - Barba/Pelo Corto)</SelectItem>
                        <SelectItem value="female" className="rounded-xl font-bold py-4 px-4 text-slate-700">Femenino (BioMédica - Pelo Largo)</SelectItem>
                        <SelectItem value="other" className="rounded-xl font-bold py-4 px-4 text-slate-700">Mascota / Animal (Pixel Art)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed ml-1 tracking-tight">Este ajuste define el avatar que aparecerá en firmas, reportes y el panel de control lateral.</p>
                  </div>
                </div>
                <div className="flex items-center justify-center bg-slate-50/50 rounded-[3rem] p-10 border-2 border-dashed border-slate-200 group transition-all hover:bg-slate-50">
                  <div className="text-center space-y-4">
                    <div className="h-40 w-40 rounded-[2.5rem] overflow-hidden border-[8px] border-white shadow-2xl mx-auto bg-white ring-1 ring-slate-100 transition-transform group-hover:scale-105 duration-500">
                      <UserAvatar user={selectedUser} className="text-6xl" />
                    </div>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Vista de Perfil</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.25em] flex items-center gap-4 pt-10 border-t border-slate-100">
                <div className="h-10 w-2 bg-primary rounded-full shadow-lg shadow-primary/20" />
                Matriz de Seguridad Operativa (Gránulos de Acceso)
              </h3>
              
              <div className="border border-slate-100 rounded-[3rem] overflow-hidden shadow-2xl bg-white ring-1 ring-slate-100">
                <div className="overflow-x-auto min-w-0">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="px-10 py-8 text-left font-black text-slate-400 uppercase tracking-[0.2em] w-1/3">Sección del Sistema</th>
                        <th className="px-4 py-8 text-center font-black text-primary uppercase tracking-[0.2em]">Visualizar</th>
                        <th className="px-4 py-8 text-center font-black text-emerald-500 uppercase tracking-[0.2em]">Crear</th>
                        <th className="px-4 py-8 text-center font-black text-amber-500 uppercase tracking-[0.2em]">Editar</th>
                        <th className="px-4 py-8 text-center font-black text-red-500 uppercase tracking-[0.2em]">Eliminar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {SECTIONS.map((section) => (
                        <tr key={section.id} className="hover:bg-primary/5 transition-all duration-300 group">
                          <td className="px-10 py-8">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-slate-900 uppercase text-base group-hover:translate-x-2 transition-transform duration-300">{section.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">Nodo operativo: {section.id}</span>
                              </div>
                            </div>
                          </td>
                          {['view', 'create', 'edit', 'delete'].map((action) => (
                            <td key={action} className="px-4 py-8">
                              <div className="flex justify-center">
                                <Checkbox 
                                  checked={selectedUser?.permissions?.[section.id]?.[action as keyof typeof selectedUser.permissions] || false}
                                  onCheckedChange={() => togglePermission(section.id, action as any)}
                                  className="rounded-xl border-2 border-slate-200 data-[state=checked]:bg-primary data-[state=checked]:border-primary h-9 w-9 shadow-lg transition-transform hover:scale-110 active:scale-95"
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-6 mt-auto pt-10 px-2 flex-shrink-0 border-t border-slate-100 bg-white">
            <Button 
                variant="ghost" 
                onClick={() => setIsEditModalOpen(false)} 
                className="rounded-[1.5rem] font-black uppercase text-slate-400 hover:text-slate-900 h-16 px-10 text-base"
            >
                Cancelar
            </Button>
            <Button 
                onClick={handleSavePermissions} 
                className="flex-1 rounded-[1.5rem] font-black px-12 h-16 shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] uppercase tracking-[0.25em] text-sm bg-primary hover:bg-primary/90 text-white transition-all hover:-translate-y-1 active:translate-y-0"
            >
              Garantizar Accesos y Sincronizar Perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
