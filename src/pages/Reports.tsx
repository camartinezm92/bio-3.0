import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Trash2, Plus, FileText, Search, Download, Loader2, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MaintenanceReport } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { generateMaintenancePDF } from '@/lib/pdfGenerator';

export default function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = React.useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedReport, setSelectedReport] = React.useState<MaintenanceReport | null>(null);
  const [reportToDelete, setReportToDelete] = React.useState<MaintenanceReport | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDownload = (report: MaintenanceReport) => {
    // If it's an external report or calibration with an attachment, open the link
    if (report.driveFileUrl || report.attachmentUrl) {
      window.open(report.driveFileUrl || report.attachmentUrl || '', '_blank');
    } else {
      // Otherwise generate our digital PDF
      generateMaintenancePDF(report);
    }
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'reports', reportToDelete.id));
      setReportToDelete(null);
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Error al eliminar el reporte.');
    } finally {
      setDeleting(false);
    }
  };

  React.useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MaintenanceReport[];
      setReports(data);
      setLoading(false);
    }, (error) => {
      console.warn("Reports snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredReports = reports.filter(report => 
    report.equipmentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.technicianName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.reportNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Completado</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pendiente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'preventive':
        return <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">Preventivo</Badge>;
      case 'corrective':
        return <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">Correctivo</Badge>;
      case 'calibration':
        return <Badge variant="outline" className="border-purple-200 text-purple-700 bg-purple-50">Calibración</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Reportes de Mantenimiento</h1>
          <p className="text-slate-500 font-medium">
            Historial de intervenciones técnicas y preventivas.
          </p>
        </div>
        <Button 
          onClick={() => navigate('/forms')}
          className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/20"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nuevo Reporte
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Buscar por equipo, técnico, número de reporte..." 
            className="pl-12 h-12 rounded-xl border-slate-200 bg-white shadow-sm focus:ring-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Fecha</TableHead>
              <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Reporte #</TableHead>
              <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Equipo</TableHead>
              <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Tipo</TableHead>
              <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Técnico</TableHead>
              <TableHead className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Estado</TableHead>
              <TableHead className="text-right font-bold text-slate-500 uppercase tracking-wider text-[10px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando reportes...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredReports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="h-10 w-10 text-slate-200" />
                    <p className="text-slate-500 font-bold">No se encontraron reportes.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredReports.map((report) => (
                <TableRow key={report.id} className="hover:bg-slate-50/50 transition-colors group">
                  <TableCell className="font-medium text-slate-600">
                    {report.date ? format(new Date(report.date), 'dd/MM/yyyy', { locale: es }) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs font-bold text-slate-400">{report.reportNumber || 'S/N'}</span>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-slate-900">{report.equipmentName}</div>
                    <div className="text-[10px] text-slate-400 font-medium">ID: {report.equipmentId}</div>
                  </TableCell>
                  <TableCell>
                    {getTypeBadge(report.type)}
                  </TableCell>
                  <TableCell className="text-slate-600 font-medium">{report.technicianName || 'No asignado'}</TableCell>
                  <TableCell>
                    {getStatusBadge(report.status)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-md"
                        onClick={() => setSelectedReport(report)}
                      >
                        <Eye className="h-4 w-4 text-slate-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-md"
                        onClick={() => handleDownload(report)}
                      >
                        <Download className="h-4 w-4 text-slate-600" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-lg hover:bg-red-50 hover:shadow-md group/del"
                        onClick={() => setReportToDelete(report)}
                      >
                        <Trash2 className="h-4 w-4 text-slate-400 group-hover/del:text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Detalles del Reporte</DialogTitle>
            <DialogDescription className="font-medium">
              Información técnica de la intervención realizada.
            </DialogDescription>
          </DialogHeader>
          
          {selectedReport && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Equipo</p>
                  <p className="font-bold text-slate-900">{selectedReport.equipmentName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fecha</p>
                  <p className="font-bold text-slate-900">
                    {selectedReport.date ? format(new Date(selectedReport.date), 'PPPP', { locale: es }) : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo de Servicio</p>
                  <div>{getTypeBadge(selectedReport.type)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Técnico</p>
                  <p className="font-bold text-slate-900">{selectedReport.technicianName}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Descripción del Trabajo</p>
                <div className="p-4 rounded-2xl bg-slate-50 text-sm text-slate-700 leading-relaxed border border-slate-100">
                  {selectedReport.workPerformed || selectedReport.description || 'No se proporcionó descripción.'}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Diagnóstico Técnico</p>
                <div className="p-4 rounded-2xl bg-slate-50 text-sm text-slate-700 leading-relaxed border border-slate-100">
                  {selectedReport.technicalDiagnosis || 'No se proporcionó diagnóstico.'}
                </div>
              </div>

              {selectedReport.photos && selectedReport.photos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Evidencia Fotográfica ({selectedReport.photos.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                    {selectedReport.photos.map((photo, idx) => (
                      <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-white shadow-sm">
                        <img 
                          src={photo} 
                          alt={`Evidencia ${idx + 1}`} 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                          onClick={() => window.open(photo, '_blank')}
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" className="rounded-xl font-bold" onClick={() => setSelectedReport(null)}>
                  Cerrar
                </Button>
                <Button className="rounded-xl font-bold" onClick={() => handleDownload(selectedReport)}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reportToDelete} onOpenChange={(open) => !open && setReportToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-red-600">¿Eliminar Reporte?</DialogTitle>
            <DialogDescription className="font-medium">
              Esta acción no se puede deshacer. Se eliminará permanentemente el reporte 
              <span className="font-bold text-slate-900"> {reportToDelete?.reportNumber}</span>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              className="rounded-xl font-bold" 
              onClick={() => setReportToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Eliminar Permanentemente</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
