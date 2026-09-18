import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ArrowLeftRight, Plus, History, Search, FileText, MapPin, Clock, Loader2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit, doc, deleteDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from '@/lib/firebase';
import { Transfer } from '@/types';
import TransferForm from '@/components/forms/TransferForm';
import { cn } from '@/lib/utils';

export default function Transfers() {
  const [showForm, setShowForm] = React.useState(false);
  const [selectedTransfer, setSelectedTransfer] = React.useState<Transfer | null>(null);
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [transferToDelete, setTransferToDelete] = React.useState<Transfer | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    const q = query(collection(db, 'transfers'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
       const data = snapshot.docs.map(doc => ({
         ...doc.data(),
         id: doc.id
       })) as Transfer[];
       setTransfers(data);
       setLoading(false);
    }, (error) => {
       console.warn("Transfers snapshot error:", error);
       setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTransfers = transfers.filter(tr => {
    const searchLower = searchQuery.toLowerCase();
    return (
      tr.equipmentName.toLowerCase().includes(searchLower) ||
      tr.equipmentSerial.toLowerCase().includes(searchLower) ||
      tr.originServiceName.toLowerCase().includes(searchLower) ||
      tr.destinationServiceName.toLowerCase().includes(searchLower) ||
      tr.reportNumber.toLowerCase().includes(searchLower) ||
      (tr.technicianName && tr.technicianName.toLowerCase().includes(searchLower))
    );
  });

  const handleDelete = async () => {
    if (!transferToDelete) return;
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'transfers', transferToDelete.id));
      setTransferToDelete(null);
    } catch (error) {
      console.error("Error al eliminar traslado:", error);
      alert("No se pudo eliminar el registro. Por favor, intente de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  if (showForm || selectedTransfer) {
    return (
      <TransferForm 
        initialData={selectedTransfer || undefined}
        readOnly={!!selectedTransfer}
        onCancel={() => {
          setShowForm(false);
          setSelectedTransfer(null);
        }} 
        onSuccess={() => {
          setShowForm(false);
          setSelectedTransfer(null);
        }} 
      />
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex items-end justify-between border-b pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Traslados</h1>
          <p className="text-lg text-slate-500 mt-2 font-medium">
            Control de movimientos y trazabilidad de ubicación de equipos biomédicos.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-2xl h-14 px-8 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-lg font-bold">
          <Plus className="mr-2 h-6 w-6" />
          Nuevo Traslado
        </Button>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Card className="md:col-span-1 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-primary text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-3 text-xl font-black">
              <ArrowLeftRight className="h-6 w-6" />
              Gestión de Movilidad
            </CardTitle>
            <CardDescription className="text-primary-foreground/70 font-medium">
              Asegure la ubicación correcta de cada activo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm leading-relaxed opacity-90">
              Cada traslado genera un acta digital firmada por el servicio que entrega y el que recibe, actualizando automáticamente el inventario global.
            </p>
            <div className="pt-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest">Sincronización en tiempo real</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b px-8 py-5">
            <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-900">
              <History className="h-5 w-5 text-primary" />
              Últimos Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando historial...</p>
              </div>
            ) : transfers.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                  <ArrowLeftRight className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold">No hay traslados registrados recientemente.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {transfers.slice(0, 3).map((tr) => (
                  <div key={tr.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{tr.equipmentName}</p>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tighter">
                          <span className="text-rose-500">{tr.originServiceName}</span>
                          <ArrowLeftRight className="h-3 w-3" />
                          <span className="text-emerald-500">{tr.destinationServiceName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{new Date(tr.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{tr.reportNumber}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="rounded-3xl border-none shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
        <div className="p-8 border-b bg-slate-50/30 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
            <FileText className="h-6 w-6 text-primary" />
            Registro Histórico de Traslados
          </h3>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            <input 
              placeholder="Buscar traslado..." 
              className="bg-transparent border-none outline-none text-sm font-medium w-48" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-slate-100">
              <TableHead className="px-8 py-5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Fecha</TableHead>
              <TableHead className="px-8 py-5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Equipo / Serial</TableHead>
              <TableHead className="px-8 py-5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Ruta de Traslado</TableHead>
              <TableHead className="px-8 py-5 font-black text-slate-500 uppercase tracking-widest text-[10px]">Responsable</TableHead>
              <TableHead className="px-8 py-5 text-right font-black text-slate-500 uppercase tracking-widest text-[10px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-8 py-12 text-center">
                  <p className="text-slate-500 font-bold">No se encontraron traslados que coincidan con la búsqueda.</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransfers.map((tr) => (
                <TableRow key={tr.id} className="border-slate-50 hover:bg-slate-50/30 transition-colors">
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                      <Clock className="h-4 w-4 text-slate-400" />
                      {new Date(tr.date).toLocaleDateString('es-ES')}
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <p className="font-black text-slate-900">{tr.equipmentName}</p>
                    <p className="text-[10px] font-bold text-slate-400 font-mono">{tr.equipmentSerial}</p>
                  </TableCell>
                  <TableCell className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-wider border border-rose-100">{tr.originServiceName}</span>
                      <ArrowLeftRight className="h-4 w-4 text-slate-300" />
                      <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider border border-emerald-100">{tr.destinationServiceName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-8 py-6 font-bold text-slate-700">{tr.technicianName || 'Técnico'}</TableCell>
                  <TableCell className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedTransfer(tr)}
                        className="rounded-xl font-bold text-xs border-slate-200 hover:bg-primary hover:text-white hover:border-primary transition-all"
                      >
                        Ver Acta Digital
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setTransferToDelete(tr)}
                        className="rounded-xl h-9 w-9 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!transferToDelete} onOpenChange={(open) => !open && setTransferToDelete(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">¿Eliminar traslado?</DialogTitle>
            <DialogDescription className="font-medium">
              Esta acción eliminará permanentemente el registro de traslado #{transferToDelete?.reportNumber} del historial histórico.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setTransferToDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" className="rounded-xl font-bold" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

