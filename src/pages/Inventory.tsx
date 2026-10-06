import * as React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  FileEdit, 
  Trash2,
  Eye,
  Pause,
  Play,
  Copy,
  ArrowLeft,
  Clock,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HardDrive,
  CheckCircle2,
  Database,
  ArrowLeftRight,
  FileUp,
  FileText,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import EquipmentForm from '@/components/forms/EquipmentForm';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { FeedbackModal } from '@/components/ui/ConfirmModal';

export default function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { scope, scopeConfig, filterByScope } = useTechnologyScope();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [equipmentList, setEquipmentList] = React.useState<Equipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | undefined>(undefined);
  const [equipmentToDelete, setEquipmentToDelete] = React.useState<Equipment | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [statusToChange, setStatusToChange] = React.useState<Equipment | null>(null);
  const [newStatus, setNewStatus] = React.useState<string>('');
  const [decommFile, setDecommFile] = React.useState<File | null>(null);
  const [decommReason, setDecommReason] = React.useState<string>('');
  const [decommDate, setDecommDate] = React.useState<string>('');
  const [updatingStatus, setUpdatingStatus] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: keyof Equipment | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'out_of_service' | 'maintenance' | 'calibration'>('all');
  const [typeFilter, setTypeFilter] = React.useState<string>('all');

  const handleSort = (key: keyof Equipment) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Equipment[];
      setEquipmentList(data);
      setLoading(false);
    }, (error) => {
      console.warn("Inventory equipment snapshot error:", error);
    });

    return () => unsubscribe();
  }, []);

  const handleTogglePause = async (eq: Equipment) => {
    if (eq.status === 'paused') {
      // If already paused, navigate to life cycle to perform maintenance and resume
      navigate(`/equipment/${eq.id}?action=resume`);
      return;
    }

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'equipment', eq.id), { 
        status: 'paused',
        pauseStartDate: now
      });
      
      // Create a pending maintenance report/task automatically
      await addDoc(collection(db, 'reports'), {
        equipmentId: eq.id,
        equipmentName: eq.name,
        type: 'corrective',
        status: 'pending',
        date: now.split('T')[0],
        description: 'Equipo pausado manualmente. Requiere revisión técnica para reanudar.',
        technicianId: user?.uid || 'system',
        createdAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error('Error toggling pause:', error);
      setFeedback({
        title: 'Error al Cambiar Estado',
        message: error.message || 'Permisos insuficientes para modificar el estado del equipo.',
        type: 'error'
      });
    }
  };

  const handleDelete = async () => {
    if (!equipmentToDelete) return;
    
    setIsDeleting(true);
    try {
      const eqName = equipmentToDelete.name;
      await deleteDoc(doc(db, 'equipment', equipmentToDelete.id));
      setEquipmentToDelete(null);
      setFeedback({
        title: 'Equipo Eliminado',
        message: `El registro de "${eqName}" fue eliminado correctamente del inventario.`,
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error deleting equipment:', error);
      setFeedback({
        title: 'Error al Eliminar',
        message: error.message || 'No fue posible eliminar el registro. Verifique sus permisos.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const scopedEquipmentList = React.useMemo(() => {
    return filterByScope(equipmentList);
  }, [equipmentList, filterByScope]);

  const stats = React.useMemo(() => {
    const total = scopedEquipmentList.length;
    const operational = scopedEquipmentList.filter(eq => eq.status === 'active').length;
    const outOfService = scopedEquipmentList.filter(eq => eq.status === 'out_of_service').length;
    
    // Proximos mantenimientos (prox 15 dias)
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
    const pendingManto = scopedEquipmentList.filter(eq => {
      if (!eq.nextMaintenance) return false;
      const mantoDate = new Date(eq.nextMaintenance);
      return mantoDate <= fifteenDaysFromNow && eq.status !== 'out_of_service';
    }).length;

    // Próximas Calibraciones (prox 30 dias)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const pendingCalib = scopedEquipmentList.filter(eq => {
      if (!eq.nextCalibration) return false;
      const calibDate = new Date(eq.nextCalibration);
      return calibDate <= thirtyDaysFromNow && eq.status !== 'out_of_service';
    }).length;

    // Resumen por tipos de equipo para los botones de filtro
    const types = Array.from(new Set(scopedEquipmentList.map(eq => eq.name))).sort();

    return { total, operational, outOfService, pendingManto, pendingCalib, types };
  }, [scopedEquipmentList]);

  const filteredEquipment = React.useMemo(() => {
    let result = scopedEquipmentList.filter(eq => 
      eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.assetNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (eq.serviceName || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'maintenance') {
        const fifteenDaysFromNow = new Date();
        fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);
        result = result.filter(eq => {
          if (!eq.nextMaintenance) return false;
          const mantoDate = new Date(eq.nextMaintenance);
          return mantoDate <= fifteenDaysFromNow && eq.status !== 'out_of_service';
        });
      } else if (statusFilter === 'calibration') {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        result = result.filter(eq => {
          if (!eq.nextCalibration) return false;
          const calibDate = new Date(eq.nextCalibration);
          return calibDate <= thirtyDaysFromNow && eq.status !== 'out_of_service';
        });
      } else {
        result = result.filter(eq => eq.status === statusFilter);
      }
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      result = result.filter(eq => eq.name === typeFilter);
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];
        
        if (!aValue || !bValue) return 0;
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [equipmentList, searchTerm, sortConfig, statusFilter, typeFilter]);

  const handleDuplicate = (eq: Equipment) => {
    // Create a copy of the equipment and remove unique identifiers
    const { id, serial, assetNumber, temporarySerial, photoId, driveFolderId, manualUrl, technicalSheetUrl, annexes, ...rest } = eq;
    
    // We keep mostly technical specs but clear out identifying ones
    const duplicateData: any = {
      ...rest,
      // Clear out fields that must be unique
      serial: '',
      assetNumber: '',
      status: 'active', // Default to active for new clones
    };

    setEditingEquipment(duplicateData);
    setShowForm(true);
  };

  const handleUpdateStatus = async () => {
    if (!statusToChange || !newStatus) return;
    
    setUpdatingStatus(true);
    try {
      let decommUrl: string = statusToChange.decommissioningActUrl || '';
      const isDecommission = newStatus === 'baja' || newStatus === 'baja_repuestos';
      
      if (isDecommission && decommFile) {
        // Upload to Drive via proxy
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error("Error leyendo el archivo del acta."));
            }
          };
          reader.onerror = () => reject(new Error("Error al procesar el archivo."));
          reader.readAsDataURL(decommFile);
        });
        
        const cleanFileName = `Acta_Baja_${(statusToChange.assetNumber || statusToChange.serial || statusToChange.id || 'Equipo').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

        try {
          const uploadRes = await fetch('/api/drive/upload-document', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               equipmentDirId: statusToChange.driveFolderId || '',
               equipmentSerial: statusToChange.serial || '',
               equipmentName: statusToChange.name || '',
               technologyScope: statusToChange.technologyScope || 'biomedical',
               folderType: 'decommissioning',
               fileName: cleanFileName,
               base64,
               mimeType: decommFile.type || 'application/pdf',
             })
          });
          
          if (uploadRes.ok) {
            const driveData = await uploadRes.json();
            decommUrl = driveData.url || driveData.webViewLink || '';
          } else {
            const errData = await uploadRes.json().catch(() => ({}));
            console.warn("Drive upload returned non-ok status, using fallback:", errData);
            if (base64 && base64.length < 900000) {
              decommUrl = base64;
            }
          }
        } catch (uploadError) {
          console.warn("Network error during file upload, using fallback:", uploadError);
          if (base64 && base64.length < 900000) {
            decommUrl = base64;
          }
        }
      }

      // Safeguard against undefined in Firestore payload
      const updatePayload: Record<string, any> = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      if (isDecommission) {
        // Guarantee decommissioningActUrl is always a string and never undefined
        const finalDecommUrl = typeof decommUrl === 'string' && decommUrl ? decommUrl : (statusToChange.decommissioningActUrl || '');
        updatePayload.decommissioningActUrl = finalDecommUrl;
        updatePayload.decommissioningDate = decommDate || statusToChange.decommissioningDate || new Date().toISOString().split('T')[0];
        if (decommReason || statusToChange.decommissioningReason) {
          updatePayload.decommissioningReason = decommReason || statusToChange.decommissioningReason || '';
        }
      }

      // Strip any accidental undefined fields to strictly prevent Firestore errors
      const cleanPayload: Record<string, any> = {};
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] !== undefined) {
          cleanPayload[key] = updatePayload[key];
        }
      });

      await updateDoc(doc(db, 'equipment', statusToChange.id), cleanPayload);

      // Add to history
      await addDoc(collection(db, 'reports'), {
        equipmentId: statusToChange.id,
        equipmentName: statusToChange.name,
        type: 'corrective',
        status: 'completed',
        date: new Date().toISOString().split('T')[0],
        description: `Cambio de estado manual a: ${newStatus.toUpperCase()}.`,
        workPerformed: isDecommission 
          ? `Equipo dado de baja institucional (${newStatus === 'baja' ? 'Baja Definitiva' : 'Baja para Repuestos'}).${decommReason ? ' Motivo: ' + decommReason + '.' : ''}${decommUrl ? ' Acta de baja registrada y archivada.' : ''}` 
          : `Equipo movido a estado ${newStatus}.`,
        technicianId: user?.uid || 'system',
        createdAt: serverTimestamp()
      });

      setFeedback({
        title: 'Estado Actualizado',
        message: `El estado del equipo ${statusToChange.name} (${statusToChange.serial}) se actualizó a ${newStatus.toUpperCase()}${isDecommission && decommUrl ? ' y se adjuntó el acta de baja exitosamente.' : '.'}`,
        type: 'success'
      });

      setStatusToChange(null);
      setNewStatus('');
      setDecommFile(null);
      setDecommReason('');
      setDecommDate('');
    } catch (error: any) {
      console.error('Error updating status:', error);
      setFeedback({
        title: 'Error al Actualizar Estado',
        message: error.message || 'No se pudo actualizar el estado del equipo.',
        type: 'error'
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (showForm) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-4 border-b pb-6">
          <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditingEquipment(undefined); }} className="rounded-full hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {editingEquipment?.id ? 'Editar Equipo' : 'Registrar Nuevo Equipo'}
            </h1>
            <p className="text-slate-500">
              {editingEquipment && !editingEquipment.id ? 'Se ha cargado la información técnica. Por favor complete los campos únicos (Serial y Activo Fijo).' : 'Complete la información técnica para el registro.'}
            </p>
          </div>
        </div>
        <EquipmentForm 
          initialData={editingEquipment} 
          onCancel={() => { setShowForm(false); setEditingEquipment(undefined); }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Header section with Stats */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border", scopeConfig.badgeBg, scopeConfig.badgeBorder, scopeConfig.textColor)}>
                {scopeConfig.shortLabel}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Inventario <span className="text-primary">{scopeConfig.label}</span>
            </h1>
            <p className="text-slate-500 mt-1 font-medium">{scopeConfig.description}</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="rounded-xl px-6 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 shrink-0">
            <Plus className="mr-2 h-5 w-5" /> Registrar Equipo
          </Button>
        </div>

        {/* Global Statistics Cards - Now Functional Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <button 
            onClick={() => setStatusFilter('all')}
            className={cn(
              "text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
              statusFilter === 'all' ? "ring-2 ring-primary ring-offset-2 rounded-xl" : ""
            )}
          >
            <Card className={cn("border-none shadow-sm", statusFilter === 'all' ? "bg-slate-900 text-white" : "bg-white text-slate-900 border-slate-100 border")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-[9px] font-bold uppercase tracking-wider", statusFilter === 'all' ? "text-slate-400" : "text-slate-500")}>Total</p>
                    <h3 className="text-2xl font-black mt-1">{stats.total}</h3>
                  </div>
                  <div className={cn("p-2 rounded-xl", statusFilter === 'all' ? "bg-slate-800" : "bg-slate-50")}>
                    <HardDrive className={cn("h-5 w-5", statusFilter === 'all' ? "text-primary" : "text-slate-400")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button 
            onClick={() => setStatusFilter('active')}
            className={cn(
              "text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
              statusFilter === 'active' ? "ring-2 ring-emerald-500 ring-offset-2 rounded-xl" : ""
            )}
          >
            <Card className={cn("border-none shadow-sm", statusFilter === 'active' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-900")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-[9px] font-bold uppercase tracking-wider", statusFilter === 'active' ? "text-emerald-200" : "text-emerald-600/70")}>Operativos</p>
                    <h3 className={cn("text-2xl font-black mt-1", statusFilter === 'active' ? "text-white" : "text-emerald-700")}>{stats.operational}</h3>
                  </div>
                  <div className={cn("p-2 rounded-xl", statusFilter === 'active' ? "bg-emerald-500" : "bg-emerald-100")}>
                    <CheckCircle2 className={cn("h-5 w-5", statusFilter === 'active' ? "text-white" : "text-emerald-600")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button 
            onClick={() => setStatusFilter('out_of_service')}
            className={cn(
              "text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
              statusFilter === 'out_of_service' ? "ring-2 ring-rose-500 ring-offset-2 rounded-xl" : ""
            )}
          >
            <Card className={cn("border-none shadow-sm", statusFilter === 'out_of_service' ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-900")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-[9px] font-bold uppercase tracking-wider", statusFilter === 'out_of_service' ? "text-rose-200" : "text-rose-600/70")}>Fuera de Serv.</p>
                    <h3 className={cn("text-2xl font-black mt-1", statusFilter === 'out_of_service' ? "text-white" : "text-rose-700")}>{stats.outOfService}</h3>
                  </div>
                  <div className={cn("p-2 rounded-xl", statusFilter === 'out_of_service' ? "bg-rose-500" : "bg-rose-100")}>
                    <AlertTriangle className={cn("h-5 w-5", statusFilter === 'out_of_service' ? "text-white" : "text-rose-600")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button 
            onClick={() => setStatusFilter('maintenance')}
            className={cn(
              "text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
              statusFilter === 'maintenance' ? "ring-2 ring-amber-500 ring-offset-2 rounded-xl" : ""
            )}
          >
            <Card className={cn("border-none shadow-sm", statusFilter === 'maintenance' ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-900 border-l-4 border-amber-400")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-[8px] font-bold uppercase tracking-wider", statusFilter === 'maintenance' ? "text-amber-200" : "text-amber-600/70")}>Manto. (15d)</p>
                    <h3 className={cn("text-2xl font-black mt-1", statusFilter === 'maintenance' ? "text-white" : "text-amber-700")}>{stats.pendingManto}</h3>
                  </div>
                  <div className={cn("p-2 rounded-xl", statusFilter === 'maintenance' ? "bg-amber-500" : "bg-amber-100")}>
                    <Clock className={cn("h-5 w-5", statusFilter === 'maintenance' ? "text-white" : "text-amber-600")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>

          <button 
            onClick={() => setStatusFilter('calibration')}
            className={cn(
              "text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
              statusFilter === 'calibration' ? "ring-2 ring-indigo-500 ring-offset-2 rounded-xl" : ""
            )}
          >
            <Card className={cn("border-none shadow-sm", statusFilter === 'calibration' ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-900 border-l-4 border-indigo-400")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-[8px] font-bold uppercase tracking-wider", statusFilter === 'calibration' ? "text-indigo-200" : "text-indigo-600/70")}>Calib. (30d)</p>
                    <h3 className={cn("text-2xl font-black mt-1", statusFilter === 'calibration' ? "text-white" : "text-indigo-700")}>{stats.pendingCalib}</h3>
                  </div>
                  <div className={cn("p-2 rounded-xl", statusFilter === 'calibration' ? "bg-indigo-500" : "bg-indigo-100")}>
                    <Database className={cn("h-5 w-5", statusFilter === 'calibration' ? "text-white" : "text-indigo-600")} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Equipment Type Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button 
            variant={typeFilter === 'all' ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter('all')}
            className="rounded-full px-5 h-9 font-bold whitespace-nowrap"
          >
            Todos los tipos
          </Button>
          {stats.types.map(type => (
            <Button
              key={type}
              variant={typeFilter === type ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(type)}
              className="rounded-full px-5 h-9 font-bold whitespace-nowrap"
            >
              {type}
            </Button>
          ))}
        </div>

        {/* Main inventory table area - Full Width */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar por nombre, marca, serial o servicio..." 
                className="pl-10 h-10 bg-slate-50/50 border-none focus-visible:ring-primary/20 rounded-xl"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              Mostrando <span className="text-slate-900 font-bold">{filteredEquipment.length}</span> de <span className="text-slate-900 font-bold">{equipmentList.length}</span> activos
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/20 overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-slate-500 font-medium">Cargando inventario...</p>
              </div>
            ) : filteredEquipment.length > 0 ? (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Equipo
                    {sortConfig.key === 'name' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('brand')}
                >
                  <div className="flex items-center gap-2">
                    Marca
                    {sortConfig.key === 'brand' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('model')}
                >
                  <div className="flex items-center gap-2">
                    Modelo
                    {sortConfig.key === 'model' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('serial')}
                >
                  <div className="flex items-center gap-2">
                    Serial / AF
                    {sortConfig.key === 'serial' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('serviceName')}
                >
                  <div className="flex items-center gap-2">
                    Servicio
                    {sortConfig.key === 'serviceName' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Estado
                    {sortConfig.key === 'status' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead 
                  className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('nextMaintenance')}
                >
                  <div className="flex items-center gap-2">
                    Próx. Manto.
                    {sortConfig.key === 'nextMaintenance' ? (
                      sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-30" />
                    )}
                  </div>
                </TableHead>
                <TableHead className="px-6 py-4 text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEquipment.map((eq) => (
                <TableRow key={eq.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <TableCell className="px-6 py-5">
                    <div className="space-y-1">
                      <button 
                        onClick={() => navigate(`/equipment/${eq.id}`)}
                        className="font-bold text-slate-900 hover:text-primary transition-colors text-left block"
                      >
                        {eq.name}
                      </button>
                      {scope === 'all' && (
                        <span className={cn(
                          "inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border",
                          (eq.technologyScope || 'biomedical') === 'biomedical' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                          eq.technologyScope === 'computing' && "bg-indigo-50 text-indigo-700 border-indigo-200",
                          eq.technologyScope === 'infrastructure' && "bg-amber-50 text-amber-800 border-amber-200"
                        )}>
                          {(eq.technologyScope || 'biomedical') === 'biomedical' ? '🩺 Biomédica' : eq.technologyScope === 'computing' ? '💻 Cómputo' : '⚡ Infraestructura'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-5 text-slate-600 font-medium">{eq.brand}</TableCell>
                  <TableCell className="px-6 py-5 text-slate-600 font-medium">{eq.model}</TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="space-y-0.5">
                      <p className={cn("text-sm font-bold", eq.temporarySerial ? "text-amber-600" : "text-slate-900")}>
                        {eq.serial}
                        {eq.temporarySerial && (
                          <span className="ml-1 text-slate-400 font-medium">
                            ({eq.temporarySerial})
                          </span>
                        )}
                        {eq.temporarySerial && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-[8px] font-black uppercase text-amber-700">
                            Temporal
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{eq.assetNumber}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-600 rounded-lg">
                      {eq.serviceName || 'Sin asignar'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-5">
                      <Badge 
                        variant={
                          eq.status === 'active' ? 'default' : 
                          eq.status === 'maintenance' ? 'secondary' : 
                          eq.status === 'paused' ? 'outline' : 
                          eq.status === 'reserva' ? 'outline' : 
                          'destructive'
                        }
                        className={cn(
                          "rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
                          eq.status === 'active' && "bg-emerald-500 hover:bg-emerald-600",
                          eq.status === 'paused' && "border-amber-500 text-amber-600 bg-amber-50",
                          eq.status === 'reserva' && "border-blue-500 text-blue-600 bg-blue-50",
                          eq.status === 'baja_repuestos' && "bg-slate-500 hover:bg-slate-600",
                          eq.status === 'baja' && "bg-slate-900 border-none"
                        )}
                      >
                        {eq.status === 'active' ? 'Operativo' : 
                         eq.status === 'maintenance' ? 'En Manto.' : 
                         eq.status === 'paused' ? 'En Pausa' : 
                         eq.status === 'reserva' ? 'Reserva' :
                         eq.status === 'baja_repuestos' ? 'Baja Repuestos' :
                         eq.status === 'baja' ? 'Baja' :
                         'Fuera de Serv.'}
                      </Badge>
                      {eq.decommissioningActUrl && (
                        <div className="mt-1.5">
                          <a
                            href={eq.decommissioningActUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText className="h-3 w-3 shrink-0" /> Acta de Baja
                          </a>
                        </div>
                      )}
                  </TableCell>
                  <TableCell className="px-6 py-5">
                    <div className="flex items-center gap-2 text-slate-600 font-bold">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-xs">{eq.nextMaintenance}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(
                        "hover:bg-slate-100 text-slate-400 hover:text-slate-900 size-10 inline-flex items-center justify-center rounded-xl transition-all outline-none",
                        "focus-visible:ring-2 focus-visible:ring-primary/20"
                      )}>
                        <MoreVertical className="h-5 w-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="rounded-xl p-2 shadow-xl border-slate-100">
                        <DropdownMenuItem onClick={() => navigate(`/equipment/${eq.id}`)} className="rounded-lg py-2.5 cursor-pointer">
                          <Eye className="mr-3 h-4 w-4 text-slate-400" /> Ver Hoja de Vida
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setEditingEquipment(eq); setShowForm(true); }} className="rounded-lg py-2.5 cursor-pointer">
                          <FileEdit className="mr-3 h-4 w-4 text-slate-400" /> Editar Datos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { 
                          setStatusToChange(eq); 
                          setNewStatus(eq.status);
                          setDecommReason(eq.decommissioningReason || '');
                          setDecommDate(eq.decommissioningDate || new Date().toISOString().split('T')[0]);
                          setDecommFile(null);
                        }} className="rounded-lg py-2.5 cursor-pointer">
                          <ArrowLeftRight className="mr-3 h-4 w-4 text-primary" /> Cambiar Estado
                        </DropdownMenuItem>
                        {eq.decommissioningActUrl && (
                          <DropdownMenuItem onClick={() => window.open(eq.decommissioningActUrl, '_blank')} className="rounded-lg py-2.5 cursor-pointer text-rose-600">
                            <FileText className="mr-3 h-4 w-4 text-rose-600" /> Ver Acta de Baja
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDuplicate(eq)} className="rounded-lg py-2.5 cursor-pointer">
                          <Copy className="mr-3 h-4 w-4 text-slate-400" /> Duplicar Equipo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleTogglePause(eq)} className="rounded-lg py-2.5 cursor-pointer">
                          {eq.status === 'paused' ? (
                            <><Play className="mr-3 h-4 w-4 text-emerald-500" /> Reanudar Operación</>
                          ) : (
                            <><Pause className="mr-3 h-4 w-4 text-amber-500" /> Pausar Equipo</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-2 bg-slate-100" />
                        <DropdownMenuItem onClick={() => setEquipmentToDelete(eq)} className="text-destructive rounded-lg py-2.5 cursor-pointer hover:bg-destructive/5">
                          <Trash2 className="mr-3 h-4 w-4" /> Eliminar Registro
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
            <div className="bg-slate-50 p-6 rounded-full">
              <AlertTriangle className="h-12 w-12 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-bold text-slate-900">No se encontraron equipos</p>
              <p className="text-slate-500">Intente ajustar los filtros o registre un nuevo equipo para comenzar.</p>
            </div>
            <Button onClick={() => setShowForm(true)} variant="outline" className="mt-2 rounded-xl">
              Registrar Primer Equipo
            </Button>
          </div>
        )}
          </div>
        </div>
      </div>
      <Dialog open={!!equipmentToDelete} onOpenChange={(open) => !open && setEquipmentToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-red-600">¿Eliminar Equipo?</DialogTitle>
            <DialogDescription className="font-medium">
              Esta acción no se puede deshacer. Se eliminará permanentemente el equipo 
              <span className="font-bold text-slate-900"> {equipmentToDelete?.name}</span> con serial 
              <span className="font-bold text-slate-900"> {equipmentToDelete?.serial}</span>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              className="rounded-xl font-bold" 
              onClick={() => setEquipmentToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Confirmar Eliminación</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusToChange} onOpenChange={(open) => !open && setStatusToChange(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">Cambiar Estado Operativo</DialogTitle>
            <DialogDescription className="font-medium">
              Actualice el estado actual de <span className="font-bold">{statusToChange?.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Nuevo Estado</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="active">Operativo (Activo)</SelectItem>
                  <SelectItem value="paused">En Pausa (Revisión)</SelectItem>
                  <SelectItem value="reserva">Reserva (Backup)</SelectItem>
                  <SelectItem value="out_of_service">Fuera de Servicio</SelectItem>
                  <SelectItem value="baja_repuestos">Baja para Repuestos</SelectItem>
                  <SelectItem value="baja">Baja Definitiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(newStatus === 'baja' || newStatus === 'baja_repuestos') && (
              <div className="space-y-3 p-4 bg-rose-50 rounded-2xl border border-rose-100 animate-in fade-in slide-in-from-top-2">
                <Label className="font-black text-rose-700 text-xs uppercase tracking-widest flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Acta de Baja Requerida
                </Label>
                <p className="text-xs text-rose-600 font-medium leading-relaxed">
                  Para registrar el equipo como {newStatus === 'baja' ? 'Baja Definitiva' : 'Baja para Repuestos'}, adjunte el acta o concepto técnico correspondiente.
                </p>

                {statusToChange?.decommissioningActUrl && (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-rose-200">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-4 w-4 text-rose-600 shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-800 truncate">Acta de Baja Registrada</p>
                        <p className="text-[10px] text-slate-500 font-medium">Documento actualmente vinculado al equipo</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 shrink-0"
                      onClick={() => window.open(statusToChange.decommissioningActUrl, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver
                    </Button>
                  </div>
                )}
                
                <div 
                  className={cn(
                    "mt-2 border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors",
                    decommFile ? "border-emerald-300 bg-emerald-50/50" : "border-rose-200 hover:bg-rose-100/50"
                  )}
                  onClick={() => document.getElementById('decomm-file')?.click()}
                >
                  {decommFile ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      <p className="text-xs font-bold text-emerald-700">{decommFile.name}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Clic para cambiar archivo</p>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-6 w-6 text-rose-400" />
                      <p className="text-xs font-bold text-rose-700">
                        {statusToChange?.decommissioningActUrl ? 'Reemplazar Acta (PDF/Imagen)' : 'Subir Acta (PDF/Imagen)'}
                      </p>
                      <p className="text-[10px] text-rose-500 font-medium">Haga clic para seleccionar archivo</p>
                    </>
                  )}
                  <input 
                    id="decomm-file" 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,image/*" 
                    onChange={(e) => setDecommFile(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Fecha de Baja</Label>
                    <Input
                      type="date"
                      value={decommDate}
                      onChange={(e) => setDecommDate(e.target.value)}
                      className="rounded-xl text-xs h-9 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700">Motivo de Baja</Label>
                    <Input
                      value={decommReason}
                      onChange={(e) => setDecommReason(e.target.value)}
                      placeholder="Ej: Obsolescencia, daño total..."
                      className="rounded-xl text-xs h-9 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button 
                variant="outline" 
                className="rounded-xl font-bold" 
                onClick={() => setStatusToChange(null)}
                disabled={updatingStatus}
              >
                Cancelar
              </Button>
              <Button 
                className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20" 
                onClick={handleUpdateStatus}
                disabled={updatingStatus || ((newStatus === 'baja' || newStatus === 'baja_repuestos') && !decommFile && !statusToChange?.decommissioningActUrl)}
              >
                {updatingStatus ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Actualizando...</>
                ) : (
                  'Guardar Cambios'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-app feedback modal */}
      {feedback && (
        <FeedbackModal
          isOpen={!!feedback}
          onClose={() => setFeedback(null)}
          title={feedback.title}
          message={feedback.message}
          type={feedback.type}
        />
      )}
    </div>
  );
}
