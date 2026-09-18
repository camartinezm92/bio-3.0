import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowLeftRight, FileText, History, ShieldCheck, Wrench, Download, ExternalLink, Info, Loader2, Clock, Pause, Image as ImageIcon, Trash2 } from 'lucide-react';
import { deleteDoc, doc, onSnapshot, collection, query, where, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment, MaintenanceReport, Transfer } from '@/types';
import { syncEquipmentWithHistory } from '@/lib/sync-logic';

import MaintenanceForm from '@/components/forms/MaintenanceForm';
import { CalibrationForm } from '@/components/forms/CalibrationForm';
import TransferForm from '@/components/forms/TransferForm';

import { generateMaintenancePDF, generateEquipmentCVPDF } from '@/lib/pdfGenerator';

export default function EquipmentLifeCycle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [equipment, setEquipment] = React.useState<Equipment | null>(null);
  const [reports, setReports] = React.useState<MaintenanceReport[]>([]);
  const [transfers, setTransfers] = React.useState<Transfer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showMaintenanceForm, setShowMaintenanceForm] = React.useState(false);
  const [showCalibrationForm, setShowCalibrationForm] = React.useState(false);
  const [showTransferForm, setShowTransferForm] = React.useState(false);
  const [currentPauseTime, setCurrentPauseTime] = React.useState<string>('');
  const [reportToDelete, setReportToDelete] = React.useState<MaintenanceReport | null>(null);
  const [transferToDelete, setTransferToDelete] = React.useState<Transfer | null>(null);
  const [deletingReport, setDeletingReport] = React.useState(false);
  const [deletingTransfer, setDeletingTransfer] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleDownloadReport = (report: MaintenanceReport) => {
    // If it's an external report or calibration with an attachment, open the link
    if (report.driveFileUrl || report.attachmentUrl) {
      window.open(report.driveFileUrl || report.attachmentUrl || '', '_blank');
    } else {
      // Otherwise generate our digital PDF
      generateMaintenancePDF(report);
    }
  };

  const handleDeleteReport = async () => {
    if (!reportToDelete || !equipment) return;
    
    setDeletingReport(true);
    try {
      await deleteDoc(doc(db, 'reports', reportToDelete.id));
      
      // Force sync after deletion to update lastMaintenance and nextMaintenance
      const remainingReports = reports.filter(r => r.id !== reportToDelete.id);
      await syncEquipmentWithHistory(equipment, remainingReports);
      
      setReportToDelete(null);
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Error al eliminar el reporte.');
    } finally {
      setDeletingReport(false);
    }
  };

  const handleDeleteTransfer = async () => {
    if (!transferToDelete) return;
    
    setDeletingTransfer(true);
    try {
      await deleteDoc(doc(db, 'transfers', transferToDelete.id));
      setTransferToDelete(null);
    } catch (error) {
      console.error('Error deleting transfer:', error);
      alert('Error al eliminar el traslado.');
    } finally {
      setDeletingTransfer(false);
    }
  };

  React.useEffect(() => {
    if (searchParams.get('action') === 'resume') {
      setShowMaintenanceForm(true);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (equipment?.status === 'paused' && equipment.pauseStartDate) {
      const updateTimer = () => {
        const start = new Date(equipment.pauseStartDate!);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        setCurrentPauseTime(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
      };

      updateTimer();
      const timer = setInterval(updateTimer, 60000);
      return () => clearInterval(timer);
    }
  }, [equipment]);

  React.useEffect(() => {
    if (!id) return;

    const unsubscribeEq = onSnapshot(doc(db, 'equipment', id), (docSnap) => {
      if (docSnap.exists()) {
        setEquipment({ ...docSnap.data(), id: docSnap.id } as Equipment);
      } else {
        setEquipment(null);
      }
    }, (error) => {
      console.warn("EquipmentLifeCycle equipment snapshot error:", error);
    });

    const qReports = query(collection(db, 'reports'), where('equipmentId', '==', id), orderBy('date', 'desc'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as MaintenanceReport[];
      setReports(data);

      // We handle sync in a separate effect or carefully here
    }, (error) => {
      console.warn("EquipmentLifeCycle reports snapshot error:", error);
    });

    const qTransfers = query(collection(db, 'transfers'), where('equipmentId', '==', id), orderBy('date', 'desc'));
    const unsubscribeTransfers = onSnapshot(qTransfers, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Transfer[];
      setTransfers(data);
      setLoading(false);
    }, (error) => {
      console.warn("EquipmentLifeCycle transfers snapshot error:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeEq();
      unsubscribeReports();
      unsubscribeTransfers();
    };
  }, [id]);

  // --- AUTO-SYNC LOGIC ---
  React.useEffect(() => {
    const checkSync = async () => {
      if (equipment && reports.length > 0) {
        const maintenanceReports = reports
          .filter(r => r.type === 'preventive' || r.type === 'corrective')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const latestManto = maintenanceReports[0];
        
        // Find latest calibration
        const calibrationReports = reports
          .filter(r => r.type === 'calibration')
          .sort((a, b) => {
            const dateA = new Date(a.calibrationDate || a.date).getTime();
            const dateB = new Date(b.calibrationDate || b.date).getTime();
            return dateB - dateA;
          });
        const latestCalib = calibrationReports[0];

        const needsMantoSync = latestManto && latestManto.date !== equipment.lastMaintenance;
        const latestCalibDate = latestCalib ? (latestCalib.calibrationDate || latestCalib.date) : null;
        const needsCalibSync = latestCalib && latestCalibDate !== equipment.lastCalibration;

        if (needsMantoSync || needsCalibSync) {
          console.log('Auto-sync: Detected date desync. Syncing...', {
            manto: { latest: latestManto?.date, current: equipment.lastMaintenance },
            calib: { latest: latestCalibDate, current: equipment.lastCalibration }
          });
          await syncEquipmentWithHistory(equipment, reports);
        }
      }
    };
    
    checkSync();
  }, [reports, equipment?.id, equipment?.lastMaintenance, equipment?.lastCalibration]);
  // --- END AUTO-SYNC ---

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <p className="text-slate-500 font-medium">Cargando hoja de vida...</p>
      </div>
    );
  }

  if (!equipment) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-in fade-in duration-500">
        <div className="bg-slate-100 p-6 rounded-full">
          <Info className="h-12 w-12 text-slate-400" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-2xl font-bold text-slate-900">Equipo no encontrado</p>
          <p className="text-slate-500">El registro que busca no existe o fue trasladado.</p>
        </div>
        <Button onClick={() => navigate('/inventory')} className="rounded-xl">
          Volver al Inventario
        </Button>
      </div>
    );
  }

  if (showMaintenanceForm) {
    return (
      <MaintenanceForm 
        equipment={equipment} 
        onCancel={() => {
          setShowMaintenanceForm(false);
          navigate(`/equipment/${id}`, { replace: true });
        }} 
        onSuccess={() => {
          setShowMaintenanceForm(false);
          navigate(`/equipment/${id}`, { replace: true });
        }}
      />
    );
  }

  if (showCalibrationForm) {
    return (
      <CalibrationForm 
        equipment={equipment} 
        onCancel={() => {
          setShowCalibrationForm(false);
          navigate(`/equipment/${id}`, { replace: true });
        }}
        onSuccess={() => {
          setShowCalibrationForm(false);
          navigate(`/equipment/${id}`, { replace: true });
        }}
      />
    );
  }

  if (showTransferForm) {
    return (
      <TransferForm 
        onCancel={() => setShowTransferForm(false)}
        onSuccess={() => setShowTransferForm(false)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      <div className="flex items-center gap-6 border-b pb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')} className="rounded-full hover:bg-slate-100 h-12 w-12">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Hoja de Vida Técnica</h1>
            <Badge className="bg-sky-500 hover:bg-sky-600 rounded-lg uppercase text-[10px] font-black tracking-widest px-2 py-0.5">
              Activo Fijo
            </Badge>
          </div>
          <p className="text-lg text-slate-500 font-medium">
            {equipment.name} <span className="mx-2 text-slate-300">|</span> {equipment.brand} {equipment.model}
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={() => setShowTransferForm(true)}
            className="rounded-xl border-slate-200 shadow-sm h-11 px-6 font-bold text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Trasladar
          </Button>
          <Button 
            variant="outline" 
            className="rounded-xl border-slate-200 shadow-sm h-11 px-6 min-w-[150px]"
            disabled={isExporting}            onClick={async () => {
              if (!equipment) return;
              setIsExporting(true);
              
              let finalPhotoBase64 = equipment.photoThumbnail;
              
              console.log('PDF Export: Initial state check:', { hasThumb: !!finalPhotoBase64, photoId: equipment.photoId });

              // Force fetch if no thumbnail or if it's not a data URL
              if ((!finalPhotoBase64 || !finalPhotoBase64.startsWith('data:')) && (equipment.photoId || equipment.imageUrl)) {
                 try {
                     if (equipment.photoId) {
                        console.log('Fetching image from Drive proxy...');
                        const res = await fetch(`/api/drive/file/${equipment.photoId}/base64`);
                        if (res.ok) {
                          const data = await res.json();
                          if (data.base64 && !data.error) {
                            finalPhotoBase64 = data.base64;
                            console.log('Image fetched successfully from proxy');
                          }
                        }
                     }
                     
                     if (!finalPhotoBase64 && equipment.imageUrl) {
                        finalPhotoBase64 = equipment.imageUrl;
                     }
                 } catch (e) {
                     console.error("Error acquiring photo for PDF:", e);
                 }
              }
              
              // NEW: SANITIZATION STEP
              // We convert whatever we got (base64 or URL) into a standard JPEG data URL using a Canvas
              // This fixes issues with HEIC, WEBP or malformed base64 that jsPDF cannot handle
              if (finalPhotoBase64) {
                 try {
                    console.log('Sanitizing image for PDF compatibility. Input starts with:', finalPhotoBase64.substring(0, 30));
                    const sanitizeImage = (src: string): Promise<string> => {
                      return new Promise((resolve) => {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                          try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                              ctx.fillStyle = '#FFFFFF'; // White background for transparent PNGs
                              ctx.fillRect(0, 0, canvas.width, canvas.height);
                              ctx.drawImage(img, 0, 0);
                              // Explicitly export as image/jpeg to ensure jsPDF compatibility
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                              console.log('Sanitization complete. Format is now JPEG');
                              resolve(dataUrl);
                            } else {
                              resolve(src);
                            }
                          } catch (err) {
                            console.error('Canvas processing error:', err);
                            resolve(src);
                          }
                        };
                        img.onerror = (err) => {
                          console.error('Image load error during sanitization:', err);
                          resolve(src);
                        };
                        img.src = src;
                      });
                    };
                    const sanitized = await sanitizeImage(finalPhotoBase64);
                    finalPhotoBase64 = sanitized;
                 } catch (e) {
                    console.error('Error in sanitization flow:', e);
                 }
              }
              
              try {
                console.log('Calling PDF Generator. Final string status:', !!finalPhotoBase64);
                const equipToExport = { ...equipment, photoThumbnail: finalPhotoBase64 };
                generateEquipmentCVPDF(equipToExport, reports, transfers);
              } catch (err) {
                console.error("Critical error generating PDF:", err);
                alert("Error al generar el PDF. Revise la consola.");
              } finally {
                setIsExporting(false);
              }
            }}
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? 'Generando...' : 'Exportar PDF'}
          </Button>
          <Button 
            onClick={() => setShowMaintenanceForm(true)}
            className={cn(
              "rounded-xl shadow-md h-11 px-6 transition-all hover:scale-[1.02]",
              equipment.status === 'paused' 
                ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200 text-white animate-pulse" 
                : "shadow-primary/20"
            )}
          >
            <Wrench className="mr-2 h-4 w-4" />
            {equipment.status === 'paused' ? 'Realizar Mantenimiento para Reanudar' : 'Nueva Intervención'}
          </Button>

          <Button 
            onClick={() => setShowCalibrationForm(true)}
            className="rounded-xl shadow-md h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 transition-all hover:scale-[1.02]"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Registrar Calibración
          </Button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <Card className="md:col-span-1 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b px-6 py-5">
            <CardTitle className="text-lg font-bold text-slate-900">Identificación</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="aspect-video rounded-2xl bg-slate-100 flex items-center justify-center border-2 border-dashed border-slate-200 group overflow-hidden relative p-2">
              {equipment.photoId ? (
                <img 
                  src={`https://lh3.googleusercontent.com/d/${equipment.photoId}`} 
                  alt={equipment.name} 
                  className="w-full h-full object-contain transition-transform group-hover:scale-105 drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
              ) : equipment.imageUrl ? (
                <img 
                  src={equipment.imageUrl} 
                  alt={equipment.name} 
                  className="w-full h-full object-contain transition-transform group-hover:scale-105 drop-shadow-md"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement?.classList.add('flex');
                  }}
                />
              ) : (
                <ImageIcon className="h-16 w-16 text-slate-300 transition-transform group-hover:scale-110" />
              )}
              {equipment.status === 'paused' && (
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-4 animate-in fade-in duration-300">
                  <Pause className="h-12 w-12 text-amber-400 mb-2 animate-pulse" />
                  <p className="text-xl font-black uppercase tracking-tighter text-amber-400">EQUIPO EN PAUSA</p>
                  <div className="mt-2 flex items-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-bold">{currentPauseTime} transcurridos</span>
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/5 transition-colors" />
            </div>
            <div className="space-y-4">
              {[
                { label: 'Serial', value: equipment.serial, isTemp: !!equipment.temporarySerial },
                { label: 'Activo Fijo', value: equipment.assetNumber },
                { label: 'Servicio', value: equipment.serviceName },
                { label: 'Ubicación', value: equipment.location || 'No especificada' },
              ].map((item: any) => (
                <div key={item.label} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-bold", item.isTemp ? "text-amber-600" : "text-slate-900")}>
                      {item.value}
                      {item.isTemp && equipment.temporarySerial && (
                        <span className="ml-1 text-slate-400 font-medium">
                          ({equipment.temporarySerial})
                        </span>
                      )}
                    </span>
                    {item.isTemp && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-[8px] font-black uppercase text-amber-700">
                        Temporal
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Estado Operativo</span>
                <Badge 
                  variant={
                    equipment.status === 'active' ? 'default' : 
                    equipment.status === 'maintenance' ? 'secondary' : 
                    equipment.status === 'paused' ? 'outline' : 
                    equipment.status === 'reserva' ? 'outline' :
                    'destructive'
                  }
                  className={cn(
                    "rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                    equipment.status === 'active' && "bg-emerald-500",
                    equipment.status === 'paused' && "border-amber-500 text-amber-600 bg-amber-50",
                    equipment.status === 'reserva' && "border-blue-500 text-blue-600 bg-blue-50",
                    equipment.status === 'baja_repuestos' && "bg-slate-500",
                    equipment.status === 'baja' && "bg-slate-900 border-none"
                  )}
                >
                  {equipment.status === 'active' ? 'Operativo' : 
                   equipment.status === 'maintenance' ? 'En Manto.' : 
                   equipment.status === 'paused' ? 'En Pausa' : 
                   equipment.status === 'reserva' ? 'Reserva' :
                   equipment.status === 'baja_repuestos' ? 'Baja Repuestos' :
                   equipment.status === 'baja' ? 'Baja' :
                   'Fuera de Serv.'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-8">
          <Tabs defaultValue="technical" className="w-full">
            <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1.5 rounded-2xl h-14">
              <TabsTrigger value="technical" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-md">Técnico</TabsTrigger>
              <TabsTrigger value="regulatory" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-md">Normativo</TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-md">Mantos.</TabsTrigger>
              <TabsTrigger value="transfers" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-md">Traslados</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl font-bold text-xs uppercase tracking-widest data-[state=active]:shadow-md">Docs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="technical" className="space-y-6 pt-6">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b px-8 py-5">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    Especificaciones Técnicas
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 grid gap-8 md:grid-cols-2">
                  <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Adquisición</p>
                    <p className="text-xl font-black text-slate-900">{equipment.acquisitionDate || 'N/A'}</p>
                  </div>
                  <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clase de Riesgo</p>
                    <p className="text-xl font-black text-slate-900">{equipment.riskClass}</p>
                  </div>
                  <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo Biomédico</p>
                    <p className="text-xl font-black text-slate-900 capitalize">{equipment.biomedicalType}</p>
                  </div>
                  <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frecuencia Manto.</p>
                    <p className="text-xl font-black text-slate-900">Cada {equipment.maintenanceFrequency} meses</p>
                  </div>
                  <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Último Manto.</p>
                    <p className="text-xl font-black text-slate-900">{equipment.lastMaintenance}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="regulatory" className="space-y-6 pt-6">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b px-8 py-5">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Información Legal y Sanitaria
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex justify-between items-center p-5 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">Registro INVIMA</p>
                      <p className="text-lg font-medium text-slate-500">{equipment.registrationInvima}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-slate-200"
                        onClick={() => window.open('https://consultaregistro.invima.gov.co/Consultas/consultas/consreg_encabcum.jsp', '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Consultar
                      </Button>
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 rounded-xl px-4 py-1.5 font-bold">
                        Vence: {equipment.registrationExpiration}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-5 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">Protocolo de Limpieza</p>
                      <p className="text-lg font-medium text-slate-500">
                        {equipment.technicalSheetUrl ? 'Protocolo Asociado' : 'No asociado'}
                      </p>
                    </div>
                    {equipment.technicalSheetUrl && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-slate-200"
                        onClick={() => window.open(equipment.technicalSheetUrl, '_blank')}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Ver Protocolo
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-6 pt-6">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b px-8 py-5">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Registro Histórico de Intervenciones
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {reports.length === 0 ? (
                      <div className="text-center py-12">
                        <History className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No hay intervenciones registradas aún.</p>
                      </div>
                    ) : (
                      reports.map((report) => (
                        <div key={report.id} className="relative pl-10 group">
                          <div className="absolute left-0 top-1.5 h-6 w-6 rounded-full bg-white border-4 border-primary shadow-sm z-10 group-hover:scale-110 transition-transform" />
                          <div className="space-y-2 p-5 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <p className="text-lg font-black text-slate-900">
                                {report.type === 'preventive' ? 'Mantenimiento Preventivo' : 
                                 report.type === 'calibration' ? 'Calibración / Calificación' :
                                 'Mantenimiento Correctivo'}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                  {new Date(report.date || report.calibrationDate || report.createdAt?.toDate?.() || new Date()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
                                </span>
                                {report.type === 'calibration' ? (
                                  (report.driveFileUrl || report.attachmentUrl) && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-md"
                                      onClick={() => window.open(report.driveFileUrl || report.attachmentUrl, '_blank')}
                                    >
                                      <Download className="h-4 w-4 text-slate-600" />
                                    </Button>
                                  )
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-md"
                                    onClick={() => handleDownloadReport(report)}
                                  >
                                    <Download className="h-4 w-4 text-slate-600" />
                                  </Button>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg hover:bg-red-50 hover:shadow-md group/del"
                                  onClick={() => setReportToDelete(report)}
                                >
                                  <Trash2 className="h-4 w-4 text-slate-400 group-hover/del:text-red-500" />
                                </Button>
                              </div>
                            </div>
                            {report.pauseDuration && (
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider border border-amber-100 mb-1">
                                <Clock className="h-3 w-3" />
                                Tiempo de Pausa: {report.pauseDuration}
                              </div>
                            )}
                            {report.type === 'calibration' && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-[10px] font-black uppercase tracking-wider border border-sky-100">
                                  <ShieldCheck className="h-3 w-3" />
                                  Calibración: {report.calibrationDate}
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-black uppercase tracking-wider border border-rose-100">
                                  <Clock className="h-3 w-3" />
                                  Próxima: {report.nextCalibrationDate}
                                </div>
                                {report.attachmentUrl && (
                                  <Button 
                                    variant="link" 
                                    className="h-auto p-0 text-[10px] font-black uppercase text-primary hover:no-underline"
                                    onClick={() => window.open(report.attachmentUrl, '_blank')}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" /> Ver Certificado
                                  </Button>
                                )}
                              </div>
                            )}
                            <p className="text-sm font-bold text-primary uppercase tracking-tighter">
                              {report.technicianName || 'Técnico'} <span className="mx-1 text-slate-300">•</span> Registro #{report.reportNumber}
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                              {report.workPerformed || report.description}
                            </p>
                            {report.observations && (
                              <div className="mt-3 pt-3 border-t border-slate-100 italic text-xs text-slate-500">
                                <strong>Obs:</strong> {report.observations}
                              </div>
                            )}
                            {(report.deliveredBySignature || report.receivedBySignature) && (
                              <div className="mt-4 pt-4 border-t border-slate-100 flex gap-8">
                                {report.deliveredBySignature && (
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Entrega</p>
                                    <img src={report.deliveredBySignature} alt="Firma Entrega" className="h-10 object-contain" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                                {report.receivedBySignature && (
                                  <div className="space-y-1">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recepción</p>
                                    <img src={report.receivedBySignature} alt="Firma Recepción" className="h-10 object-contain" referrerPolicy="no-referrer" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transfers" className="space-y-6 pt-6">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b px-8 py-6">
                  <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <ArrowLeftRight className="h-6 w-6 text-primary" />
                    Historial de Movimientos
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {transfers.length === 0 ? (
                      <div className="p-12 text-center space-y-3">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                          <ArrowLeftRight className="h-8 w-8 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-bold">No se han registrado traslados para este equipo.</p>
                      </div>
                    ) : (
                      transfers.map((tr) => (
                        <div key={tr.id} className="p-8 hover:bg-slate-50/50 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/10 p-2 rounded-xl">
                                <Clock className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-900">{new Date(tr.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Acta N° {tr.reportNumber}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="rounded-lg font-black text-[10px] uppercase tracking-widest border-slate-200">
                              {tr.reason}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                              <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Origen</p>
                              <p className="text-sm font-black text-rose-700">{tr.originServiceName}</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                              <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Destino</p>
                              <p className="text-sm font-black text-emerald-700">{tr.destinationServiceName}</p>
                            </div>
                          </div>
                          {tr.observations && (
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Observaciones</p>
                              <p className="text-sm text-slate-600 italic">"{tr.observations}"</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                            <p className="text-xs font-bold text-slate-500">
                              Responsable: <span className="text-slate-900">{tr.technicianName || 'Técnico'}</span>
                            </p>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" className="text-primary font-bold text-xs">
                                Ver Acta Completa
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all"
                                onClick={() => setTransferToDelete(tr)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs" className="space-y-6 pt-6">
              <div className="grid gap-6 md:grid-cols-2">
                {equipment.manualUrl ? (
                  <Card 
                    onClick={() => window.open(equipment.manualUrl, '_blank')}
                    className="group cursor-pointer border-none shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1"
                  >
                    <CardContent className="flex items-center gap-5 p-6">
                      <div className="p-4 bg-sky-50 rounded-2xl shadow-inner group-hover:bg-sky-100 transition-colors">
                        <FileText className="h-8 w-8 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900">Manual de Usuario</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enlace Externo (Drive/Web)</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed border-2 border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                    <Info className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Sin Manual Asociado</p>
                  </Card>
                )}
                
                {equipment.technicalSheetUrl ? (
                  <Card 
                    onClick={() => window.open(equipment.technicalSheetUrl, '_blank')}
                    className="group cursor-pointer border-none shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1"
                  >
                    <CardContent className="flex items-center gap-5 p-6">
                      <div className="p-4 bg-emerald-50 rounded-2xl shadow-inner group-hover:bg-emerald-100 transition-colors">
                        <ShieldCheck className="h-8 w-8 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-slate-900">Protocolo de Limpieza</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Enlace Externo (Drive/Web)</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed border-2 border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                    <Info className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Sin Protocolo Asociado</p>
                  </Card>
                )}
              </div>

              {equipment.annexes && equipment.annexes.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Anexos y Documentos Legales
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {equipment.annexes.map((annex, idx) => {
                      const isValidUrl = annex.url && annex.url !== '#' && annex.url !== '';
                      return (
                      <Card 
                        key={idx}
                        onClick={() => isValidUrl ? window.open(annex.url, '_blank') : alert('El documento original no logró enlazarse con Google Drive. Por favor vuelva a subir este anexo desde la opción Editar Equipo.')}
                        className={`group border-none shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1 ${isValidUrl ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
                      >
                        <CardContent className="flex items-center gap-4 p-5">
                          <div className={`p-3 rounded-xl transition-colors ${isValidUrl ? 'bg-slate-50 group-hover:bg-slate-100' : 'bg-red-50'}`}>
                            <FileText className={`h-6 w-6 ${isValidUrl ? 'text-slate-400 group-hover:text-primary' : 'text-red-400'}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{annex.name}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${isValidUrl ? 'text-slate-400' : 'text-red-500'}`}>
                              {isValidUrl ? 'Documento Adjunto' : 'Archivo Roto (Resubir)'}
                            </p>
                          </div>
                          {isValidUrl ? (
                            <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-primary" />
                          ) : (
                            <Info className="h-4 w-4 text-red-300" />
                          )}
                        </CardContent>
                      </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
              disabled={deletingReport}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold" 
              onClick={handleDeleteReport}
              disabled={deletingReport}
            >
              {deletingReport ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" /> Eliminar Permanentemente</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferToDelete} onOpenChange={(open) => !open && setTransferToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-red-600">¿Eliminar Traslado?</DialogTitle>
            <DialogDescription className="font-medium">
              Esta acción eliminará permanentemente el registro de traslado 
              <span className="font-bold text-slate-900"> #{transferToDelete?.reportNumber}</span> del historial.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              className="rounded-xl font-bold" 
              onClick={() => setTransferToDelete(null)}
              disabled={deletingTransfer}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold" 
              onClick={handleDeleteTransfer}
              disabled={deletingTransfer}
            >
              {deletingTransfer ? (
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
