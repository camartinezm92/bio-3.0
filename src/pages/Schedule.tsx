import * as React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Save, 
  RefreshCw, 
  Filter, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Settings2,
  Wrench,
  Zap,
  ShieldCheck,
  Download
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment } from '@/types';
import { cn } from '@/lib/utils';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const months = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export default function Schedule() {
  const [equipmentList, setEquipmentList] = React.useState<Equipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [serviceFilter, setServiceFilter] = React.useState('all');
  const [yearFilter, setYearFilter] = React.useState(new Date().getFullYear().toString());

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Equipment[];
      setEquipmentList(data);
      setLoading(false);
    }, (error) => {
      console.warn("Schedule equipment snapshot error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const services = Array.from(new Set(equipmentList.map(e => e.serviceName).filter(Boolean)));

  const filteredEquipment = equipmentList.filter(eq => {
    if (serviceFilter !== 'all' && eq.serviceName !== serviceFilter) return false;
    if (['baja', 'baja_repuestos'].includes(eq.status)) return false;
    return true;
  });

  // Grouping logic
  const groupedEquipment = React.useMemo(() => {
    const groups: Record<string, {
      name: string;
      ids: string[];
      serials: string[];
      serviceName: string;
      scheduledMaintenanceMonths: number[];
      scheduledCalibrationMonths: number[];
      scheduledQualificationMonths: number[];
    }> = {};

    filteredEquipment.forEach(eq => {
      if (!groups[eq.name]) {
        groups[eq.name] = {
          name: eq.name,
          ids: [],
          serials: [],
          serviceName: eq.serviceName || '',
          scheduledMaintenanceMonths: [],
          scheduledCalibrationMonths: [],
          scheduledQualificationMonths: [],
        };
      }
      
      groups[eq.name].ids.push(eq.id);
      groups[eq.name].serials.push(eq.serial);

      // Merge schedules
      (eq.scheduledMaintenanceMonths || []).forEach(m => {
        if (!groups[eq.name].scheduledMaintenanceMonths.includes(m)) groups[eq.name].scheduledMaintenanceMonths.push(m);
      });
      (eq.scheduledCalibrationMonths || []).forEach(m => {
        if (!groups[eq.name].scheduledCalibrationMonths.includes(m)) groups[eq.name].scheduledCalibrationMonths.push(m);
      });
      (eq.scheduledQualificationMonths || []).forEach(m => {
        if (!groups[eq.name].scheduledQualificationMonths.includes(m)) groups[eq.name].scheduledQualificationMonths.push(m);
      });
    });

    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredEquipment]);

  const toggleMonth = async (ids: string[], monthIndex: number, type: 'maintenance' | 'calibration' | 'qualification') => {
    const batch = writeBatch(db);
    
    ids.forEach(id => {
      const eq = equipmentList.find(e => e.id === id);
      if (!eq) return;

      let field = '';
      let currentMonths: number[] = [];

      if (type === 'maintenance') {
        field = 'scheduledMaintenanceMonths';
        currentMonths = eq.scheduledMaintenanceMonths || [];
      } else if (type === 'calibration') {
        field = 'scheduledCalibrationMonths';
        currentMonths = eq.scheduledCalibrationMonths || [];
      } else if (type === 'qualification') {
        field = 'scheduledQualificationMonths';
        currentMonths = eq.scheduledQualificationMonths || [];
      }

      const newMonths = currentMonths.includes(monthIndex)
        ? currentMonths.filter(m => m !== monthIndex)
        : [...currentMonths, monthIndex].sort((a, b) => a - b);

      batch.update(doc(db, 'equipment', id), { [field]: newMonths });
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  const autoGenerateSchedule = async () => {
    if (!window.confirm('¿Desea generar automáticamente el cronograma basado en la frecuencia de mantenimiento de cada equipo? Esto sobrescribirá los cambios manuales.')) return;
    
    setSaving(true);
    const batch = writeBatch(db);
    console.log(`Starting auto-generate for target year: ${yearFilter}. Total equipment: ${filteredEquipment.length}`);
    
    let updatedCount = 0;

    filteredEquipment.forEach(eq => {
      const maintenanceMonths: number[] = [];
      const calibrationMonths: number[] = [];
      const qualificationMonths: number[] = [];

      const targetYear = parseInt(yearFilter);

      const projectDates = (type: string, baseDateStr: string | undefined, freq: number | undefined, targetArray: number[]) => {
        if (!baseDateStr) {
           console.log(`[${eq.name} - ${eq.serial}] [${type}] Skipped: No base date.`);
           return;
        }
        
        // Add artificial time to prevent UTC date shift on initialization
        const baseDate = new Date(`${baseDateStr}T12:00:00Z`); 
        
        if (isNaN(baseDate.getTime())) {
           console.log(`[${eq.name} - ${eq.serial}] [${type}] Skipped: Invalid date format '${baseDateStr}'`);
           return;
        }

        let currentMonth = baseDate.getMonth();
        let currentYear = baseDate.getFullYear();
        
        console.log(`[${eq.name} - ${eq.serial}] [${type}] Initial Base: ${baseDateStr} (Year: ${currentYear}, MonthIndex: ${currentMonth}), Freq: ${freq}`);

        if (!freq || freq <= 0) {
           if (currentYear === targetYear && !targetArray.includes(currentMonth)) {
             targetArray.push(currentMonth);
           }
           return;
        }

        // Limit the forward projection to max year + 5 to prevent infinite loops if something goes wrong
        let loopSafety = 0;
        while (currentYear <= targetYear && loopSafety < 100) {
          loopSafety++;
          if (currentYear === targetYear && !targetArray.includes(currentMonth)) {
             targetArray.push(currentMonth);
          }
          currentMonth += freq;
          while (currentMonth >= 12) {
            currentMonth -= 12;
            currentYear += 1;
          }
        }
        
        console.log(`[${eq.name} - ${eq.serial}] [${type}] Target Months in ${targetYear}:`, targetArray);
      };

      projectDates('Maintenance', eq.nextMaintenance || eq.lastMaintenance, eq.maintenanceFrequency, maintenanceMonths);
      projectDates('Calibration', eq.nextCalibration || eq.lastCalibration, eq.calibrationFrequency, calibrationMonths);
      projectDates('Qualification', eq.nextQualification, eq.qualificationFrequency, qualificationMonths);

      batch.update(doc(db, 'equipment', eq.id), {
        scheduledMaintenanceMonths: maintenanceMonths,
        scheduledCalibrationMonths: calibrationMonths,
        scheduledQualificationMonths: qualificationMonths
      });
      updatedCount++;
    });

    try {
      console.log(`Executing batch commit for ${updatedCount} equipment...`);
      await batch.commit();
      console.log("Batch commit successful.");
      alert('Cronograma generado exitosamente. Revisa la consola para más detalles (F12).');
    } catch (error) {
      console.error('Error committing batch:', error);
      alert('Error al generar el cronograma.');
    } finally {
      setSaving(false);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 0, pageWidth, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA', 15, 12);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CRONOGRAMA DE MANTENIMIENTO Y SERVICIOS TÉCNICOS - AÑO ${yearFilter}`, 15, 18);
    if (serviceFilter !== 'all') {
      doc.text(`SERVICIO: ${serviceFilter.toUpperCase()}`, 15, 22);
    }

    const tableData = groupedEquipment.map(group => {
      const row = [
        `${group.name}\n(${group.serials.length} equipos)`
      ];
      
      months.forEach((_, index) => {
        let cellText = '';
        if ((group.scheduledMaintenanceMonths || []).includes(index)) cellText += 'M ';
        if ((group.scheduledCalibrationMonths || []).includes(index)) cellText += 'C ';
        if ((group.scheduledQualificationMonths || []).includes(index)) cellText += 'Q';
        row.push(cellText.trim());
      });
      
      return row;
    });

    autoTable(doc, {
      startY: 30,
      head: [['Tipo de Equipo', ...months]],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        halign: 'center'
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 45 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Convenciones: M = Mantenimiento Preventivo | C = Calibración | Q = Calificación', 15, finalY);
    doc.text(`Generado el: ${new Date().toLocaleString()}`, pageWidth - 15, finalY, { align: 'right' });

    doc.save(`Cronograma_${yearFilter}_${serviceFilter}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Cronograma {yearFilter}</h1>
          <p className="text-lg text-slate-500 mt-2 font-medium">
            Planificación anual por tipo de equipo. Los cambios afectan a todos los equipos del mismo tipo.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            onClick={autoGenerateSchedule} 
            disabled={saving}
            className="rounded-2xl h-12 px-6 border-slate-200 font-bold hover:bg-slate-50"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Auto-Generar
          </Button>
          <Button 
            variant="outline" 
            onClick={exportToPDF}
            className="rounded-2xl h-12 px-6 border-slate-200 font-bold hover:bg-slate-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button 
            variant="ghost" 
            onClick={async () => {
              if (!window.confirm('¿Desea limpiar todo el cronograma para los equipos filtrados?')) return;
              setSaving(true);
              const batch = writeBatch(db);
              filteredEquipment.forEach(eq => {
                batch.update(doc(db, 'equipment', eq.id), {
                  scheduledMaintenanceMonths: [],
                  scheduledCalibrationMonths: [],
                  scheduledQualificationMonths: []
                });
              });
              await batch.commit();
              setSaving(false);
            }}
            className="rounded-2xl h-12 px-6 text-slate-500 font-bold hover:text-destructive"
          >
            Limpiar Todo
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-slate-50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Filtros</span>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Servicio</Label>
                <Select value={serviceFilter || "all"} onValueChange={setServiceFilter}>
                  <SelectTrigger className="rounded-xl bg-white border-slate-200 h-10">
                    <SelectValue placeholder="Todos los servicios" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all">Todos los servicios</SelectItem>
                    {services.map(s => (
                      <SelectItem key={s} value={s || 'unknown'}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-500">Año</Label>
                <Select value={yearFilter || "2025"} onValueChange={setYearFilter}>
                  <SelectTrigger className="rounded-xl bg-white border-slate-200 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="flex flex-wrap gap-6 items-center justify-center md:justify-start">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-blue-500 shadow-sm" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Mantenimiento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-amber-500 shadow-sm" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Calibración</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-purple-500 shadow-sm" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Calificación</span>
              </div>
              <div className="ml-auto flex items-center gap-2 text-slate-400">
                <Settings2 className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Clic en celda para editar grupo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-3xl border-none shadow-2xl shadow-slate-200/50 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader className="bg-slate-50/50">
              <TableRow className="hover:bg-transparent border-slate-100">
                <TableHead className="sticky left-0 bg-slate-50/80 backdrop-blur-md z-20 w-[300px] px-8 py-5 font-black text-slate-500 uppercase tracking-widest text-[10px] border-r">Tipo de Equipo</TableHead>
                {months.map((month) => (
                  <TableHead key={month} className="text-center px-2 py-5 font-black text-slate-500 uppercase tracking-widest text-[10px] border-r last:border-r-0">{month}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando equipos...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : groupedEquipment.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-64 text-center">
                    <p className="text-slate-500 font-bold">No se encontraron equipos para los filtros seleccionados.</p>
                  </TableCell>
                </TableRow>
              ) : (
                groupedEquipment.map((group) => (
                  <TableRow key={group.name} className="border-slate-50 hover:bg-slate-50/30 transition-colors group">
                    <TableCell className="sticky left-0 bg-white group-hover:bg-slate-50/80 backdrop-blur-md z-10 font-medium px-8 py-4 border-r">
                      <div className="space-y-0.5">
                        <p className="text-sm font-black text-slate-900 line-clamp-1">{group.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.serials.length} Equipos</p>
                          <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 font-black uppercase border-slate-200 text-slate-400">
                            {group.serviceName}
                          </Badge>
                        </div>
                        <Popover>
                          <PopoverTrigger className="text-[9px] text-primary font-bold hover:underline">
                            Ver seriales
                          </PopoverTrigger>
                          <PopoverContent className="w-64 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Seriales asociados</p>
                            <div className="grid grid-cols-2 gap-1">
                              {group.serials.map(s => (
                                <span key={s} className="text-[10px] font-mono bg-slate-50 p-1 rounded border border-slate-100">{s}</span>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>
                    {months.map((_, index) => {
                      const hasManto = (group.scheduledMaintenanceMonths || []).includes(index);
                      const hasCalib = (group.scheduledCalibrationMonths || []).includes(index);
                      const hasQual = (group.scheduledQualificationMonths || []).includes(index);

                      return (
                        <TableCell key={index} className="p-0 border-r last:border-r-0">
                          <Popover>
                            <PopoverTrigger className="w-full h-16 flex flex-col gap-1 items-center justify-center hover:bg-slate-100/50 transition-colors p-1">
                              {hasManto && (
                                <div className="h-2 w-full bg-blue-500 rounded-sm shadow-sm animate-in zoom-in-50 duration-300" title="Mantenimiento Preventivo" />
                              )}
                              {hasCalib && (
                                <div className="h-2 w-full bg-amber-500 rounded-sm shadow-sm animate-in zoom-in-50 duration-300" title="Calibración" />
                              )}
                              {hasQual && (
                                <div className="h-2 w-full bg-purple-500 rounded-sm shadow-sm animate-in zoom-in-50 duration-300" title="Calificación" />
                              )}
                              {!hasManto && !hasCalib && !hasQual && (
                                <div className="h-1 w-1 rounded-full bg-slate-200 group-hover:bg-slate-300" />
                              )}
                            </PopoverTrigger>
                            <PopoverContent className="w-56 rounded-2xl shadow-2xl border-slate-100 p-4" align="center">
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest">{months[index]} {yearFilter}</p>
                                  <p className="text-[10px] text-slate-500 font-medium">Programar para {group.serials.length} equipos</p>
                                </div>
                                <div className="space-y-3 pt-2">
                                  <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer group" onClick={() => toggleMonth(group.ids, index, 'maintenance')}>
                                    <Checkbox id={`manto-${group.name}-${index}`} checked={hasManto} className="border-blue-200 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                                    <Label htmlFor={`manto-${group.name}-${index}`} className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                                      <Wrench className="h-3 w-3 text-blue-500" /> Mantenimiento
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-amber-50 transition-colors cursor-pointer group" onClick={() => toggleMonth(group.ids, index, 'calibration')}>
                                    <Checkbox id={`calib-${group.name}-${index}`} checked={hasCalib} className="border-amber-200 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-200" />
                                    <Label htmlFor={`calib-${group.name}-${index}`} className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                                      <Zap className="h-3 w-3 text-amber-500" /> Calibración
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-3 p-2 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer group" onClick={() => toggleMonth(group.ids, index, 'qualification')}>
                                    <Checkbox id={`qual-${group.name}-${index}`} checked={hasQual} className="border-purple-200 data-[state=checked]:bg-purple-500 data-[state=checked]:border-purple-500" />
                                    <Label htmlFor={`qual-${group.name}-${index}`} className="text-xs font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                                      <ShieldCheck className="h-3 w-3 text-purple-500" /> Calificación
                                    </Label>
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-emerald-50 border border-emerald-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-sm">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sincronización</p>
              <p className="text-sm font-bold text-slate-900">Cambios guardados en tiempo real</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-blue-50 border border-blue-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-sm">
              <Calendar className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Planificación</p>
              <p className="text-sm font-bold text-slate-900">Basado en frecuencia técnica</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden bg-amber-50 border border-amber-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-white p-3 rounded-2xl shadow-sm">
              <AlertCircle className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Alertas</p>
              <p className="text-sm font-bold text-slate-900">Notifica vencimientos próximos</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
