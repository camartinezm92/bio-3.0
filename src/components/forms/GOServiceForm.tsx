import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Loader2, 
  CheckCircle2, 
  ArrowLeft, 
  Eraser,
  Download,
  Upload
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { generateGOServicePDF } from '@/lib/pdfGenerator';

interface GOServiceFormProps {
  equipment: Equipment;
  onCancel: () => void;
  onSuccess?: () => void;
}

export default function GOServiceForm({ equipment, onCancel, onSuccess }: GOServiceFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const tecnicoSigRef = React.useRef<SignatureCanvas>(null);
  const recibidoSigRef = React.useRef<SignatureCanvas>(null);

  const [formData, setFormData] = React.useState({
    // Cliente
    clienteNombre: 'Medicina Intensiva del Tolima S.A',
    clienteDireccion: 'Calle 9 # 22A-93',
    clienteCiudad: 'Honda-Tolima',
    clienteEncargado: 'Camilo Andres Martinez',
    clienteCargo: 'Ing. Biomedico',
    fechaSolicitud: new Date().toISOString().split('T')[0],
    clienteTelefono: '257771',

    // Equipo
    equipoNombre: equipment.name,
    equipoMarca: equipment.brand,
    equipoModelo: equipment.model,
    equipoSerial: equipment.serial,
    equipoHoras: 'N/A',
    equipoUbicacion: equipment.location || '',

    // Servicio
    tipoServicio: {
      predictivo: false,
      preventivo: true,
      corrective: false,
      reparacion: false
    },
    fechaServicio: new Date().toISOString().split('T')[0],

    // Actividades
    actividades: {
      limpieza: true,
      pruebaInicio: true,
      revisionEstructural: true,
      revisionFugas: true,
      revisionHidraulica: false,
      revisionMecanica: true,
      revisionParteElectrica: true,
      revisionFuentes: true,
      medicionVoltaje: true,
      lubricacion: true,
      calibracion: false,
      testFuncionamiento: true
    },

    // Observaciones
    observaciones: '',

    // Conclusiones
    conclusiones: {
      satisfactorio: true,
      dentroParametros: true,
      fueraServicio: false,
      retiroLaboratorio: false,
      cotizacionRepuestos: false
    },

    // Entrega
    tecnicoNombre: 'GO SERVITECNICO SAS',
    fechaFinalizacion: new Date().toISOString().split('T')[0],
    recibidoNombre: 'Camilo A. Martinez M.',
    recibidoCargo: 'Ing. Biomedico'
  });

  const [useDefaultSignature, setUseDefaultSignature] = React.useState(false);

  // Default signature provided by user (base64)
  // I will leave this as a variable they can update or I'll try to use a generic path if they upload it
  const DEFAULT_SIGNATURE = ""; // User-provided signature 

  const handleChange = (path: string, value: any) => {
    const keys = path.split('.');
    if (keys.length === 1) {
      setFormData(prev => ({ ...prev, [keys[0]]: value }));
    } else {
      setFormData(prev => ({
        ...prev,
        [keys[0]]: {
          ...(prev as any)[keys[0]],
          [keys[1]]: value
        }
      }));
    }
  };

  const [tecnicoFirmaImg, setTecnicoFirmaImg] = React.useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTecnicoFirmaImg(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getSignatureData = (ref: React.RefObject<SignatureCanvas>, uploadedImg: string | null) => {
    if (uploadedImg) return uploadedImg;
    if (!ref.current || ref.current.isEmpty()) return null;
    return ref.current.getTrimmedCanvas().toDataURL('image/png');
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const tecnicoFirma = getSignatureData(tecnicoSigRef, tecnicoFirmaImg);
      const recibidoFirma = getSignatureData(recibidoSigRef, null);

      const reportData = {
        ...formData,
        tecnicoFirma,
        recibidoFirma
      };

      // Create and Download PDF
      generateGOServicePDF(reportData as any);

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Error generating GO report:', error);
      alert('Error al generar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <div className="flex justify-center">
          <div className="bg-emerald-100 p-4 rounded-full">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">¡Reporte Generado!</h2>
        <p className="text-slate-500">El formato de GO SERVITECNICO ha sido descargado exitosamente.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="text-right">
          <Badge className="bg-indigo-500 mb-1">FORMATO EXTERNO</Badge>
          <h1 className="text-2xl font-black text-slate-900">GO SERVITECNICO SAS</h1>
        </div>
      </div>

      <Card className="shadow-2xl border-slate-100 rounded-3xl overflow-hidden">
        <CardHeader className="bg-white border-b p-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <div className="text-5xl font-black text-slate-900 tracking-tighter">GO</div>
              <div className="h-12 w-px bg-slate-200" />
              <div>
                <CardTitle className="text-2xl font-black text-slate-800">SERVITECNICO SAS</CardTitle>
                <p className="text-xs font-bold text-slate-500">RUT. 79.147.475-4 | CHIA, CUNDINAMARCA</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                VENTA - REPARACION - MANTENIMIENTO - CALIBRACION<br/>
                EQUIPOS BIOMEDICOS E INDUSTRIALES
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          {/* INFORMACION CLIENTE */}
          <section className="space-y-4">
            <h3 className="bg-slate-100 p-2 text-center text-sm font-black uppercase tracking-widest text-slate-700 rounded-lg">INFORMACION CLIENTE</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-xl">
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">NOMBRE CLIENTE:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.clienteNombre} onChange={(e) => handleChange('clienteNombre', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">DIRECCIÓN:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.clienteDireccion} onChange={(e) => handleChange('clienteDireccion', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">CIUDAD:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.clienteCiudad} onChange={(e) => handleChange('clienteCiudad', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">ENCARGADO:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.clienteEncargado} onChange={(e) => handleChange('clienteEncargado', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">CARGO:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.clienteCargo} onChange={(e) => handleChange('clienteCargo', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">FECHA SOLICITUD:</span>
                <Input type="date" className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.fechaSolicitud} onChange={(e) => handleChange('fechaSolicitud', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">TELÉFONO:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.clienteTelefono} onChange={(e) => handleChange('clienteTelefono', e.target.value)} />
              </div>
            </div>
          </section>

          {/* INFORMACION EQUIPO */}
          <section className="space-y-4">
            <h3 className="bg-slate-100 p-2 text-center text-sm font-black uppercase tracking-widest text-slate-700 rounded-lg">INFORMACION EQUIPO</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-xl">
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">EQUIPO:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.equipoNombre} onChange={(e) => handleChange('equipoNombre', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">MARCA:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.equipoMarca} onChange={(e) => handleChange('equipoMarca', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">MODELO:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.equipoModelo} onChange={(e) => handleChange('equipoModelo', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">SERIAL:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.equipoSerial} onChange={(e) => handleChange('equipoSerial', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">HORAS FUNC.:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.equipoHoras} onChange={(e) => handleChange('equipoHoras', e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b pb-2">
                <span className="text-[10px] font-bold text-slate-400 w-24">UBICACIÓN:</span>
                <Input className="h-7 p-0 font-bold border-none flex-1 shadow-none focus-visible:ring-0" value={formData.equipoUbicacion} onChange={(e) => handleChange('equipoUbicacion', e.target.value)} />
              </div>
            </div>
          </section>

          {/* TIPO DE SERVICIO */}
          <section className="space-y-4">
            <h3 className="bg-slate-100 p-2 text-center text-sm font-black uppercase tracking-widest text-slate-700 rounded-lg">TIPO DE SERVICIO</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={formData.tipoServicio.predictivo} onCheckedChange={(val) => handleChange('tipoServicio.predictivo', !!val)} />
                <span className="text-xs font-bold">Manto. Predictivo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={formData.tipoServicio.preventivo} onCheckedChange={(val) => handleChange('tipoServicio.preventivo', !!val)} />
                <span className="text-xs font-bold">Manto. Preventivo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={formData.tipoServicio.corrective} onCheckedChange={(val) => handleChange('tipoServicio.corrective', !!val)} />
                <span className="text-xs font-bold">Manto. Correctivo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={formData.tipoServicio.reparacion} onCheckedChange={(val) => handleChange('tipoServicio.reparacion', !!val)} />
                <span className="text-xs font-bold">Daño Reporte</span>
              </label>
              <div className="col-span-full border-t pt-2 flex items-center gap-4">
                <span className="text-[10px] font-bold text-slate-400">FECHA SERVICIO:</span>
                <Input type="date" className="h-7 w-40" value={formData.fechaServicio} onChange={(e) => handleChange('fechaServicio', e.target.value)} />
              </div>
            </div>
          </section>

          {/* ACTIVIDADES REALIZADAS */}
          <section className="space-y-4">
            <h3 className="bg-slate-100 p-2 text-center text-sm font-black uppercase tracking-widest text-slate-700 rounded-lg">ACTIVIDADES REALIZADAS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 p-4 border rounded-xl">
              {[
                { label: 'Limpieza', key: 'limpieza' },
                { label: 'Prueba de Inicio', key: 'pruebaInicio' },
                { label: 'Revisión Estructural', key: 'revisionEstructural' },
                { label: 'Revisión de Fugas', key: 'revisionFugas' },
                { label: 'Revisión Hidráulica', key: 'revisionHidraulica' },
                { label: 'Revisión Mecánica', key: 'revisionMecanica' },
                { label: 'Revisión Parte Eléctrica', key: 'revisionParteElectrica' },
                { label: 'Revisión fuentes eléctricas', key: 'revisionFuentes' },
                { label: 'Medición de Voltaje', key: 'medicionVoltaje' },
                { label: 'Lubricación', key: 'lubricacion' },
                { label: 'Calibración', key: 'calibracion' },
                { label: 'Test de funcionamiento', key: 'testFuncionamiento' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between border-b pb-1 last:border-0 border-slate-100">
                  <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  <Checkbox checked={(formData.actividades as any)[item.key]} onCheckedChange={(val) => handleChange(`actividades.${item.key}`, !!val)} />
                </div>
              ))}
            </div>
          </section>

          {/* PROCESO REALIZADO Y OBSERVACIONES */}
          <section className="space-y-4">
            <h3 className="bg-slate-100 p-2 text-center text-sm font-black uppercase tracking-widest text-slate-700 rounded-lg">PROCESO REALIZADO Y OBSERVACIONES</h3>
            <Textarea className="min-h-[150px] border-2 border-slate-200 rounded-xl" value={formData.observaciones} onChange={(e) => handleChange('observaciones', e.target.value)} />
          </section>

          {/* CONCLUSIONES */}
          <section className="border rounded-xl p-6 space-y-4 bg-slate-50">
             {[
               { label: 'El servicio concluye satisfactoriamente', key: 'satisfactorio' },
               { label: 'El equipo se entrega dentro de los parámetros requeridos', key: 'dentroParametros' },
               { label: 'El equipo queda fuera de servicio', key: 'fueraServicio' },
               { label: 'El equipo requiere ser retirado para evaluación en laboratorio', key: 'retiroLaboratorio' },
               { label: 'El equipo requiere cotización de repuestos', key: 'cotizacionRepuestos' },
             ].map((item) => (
               <div key={item.key} className="flex items-center justify-between border-b pb-2 last:border-0 border-slate-200">
                 <span className="text-xs font-bold text-slate-700">{item.label}</span>
                 <div className="flex gap-4">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <span className="text-[10px] font-black">SI</span>
                      <Checkbox checked={(formData.conclusiones as any)[item.key]} onCheckedChange={(val) => handleChange(`conclusiones.${item.key}`, !!val)} />
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <span className="text-[10px] font-black">NO</span>
                      <Checkbox checked={!(formData.conclusiones as any)[item.key]} onCheckedChange={(val) => handleChange(`conclusiones.${item.key}`, !val)} />
                    </label>
                 </div>
               </div>
             ))}
          </section>

          {/* ENTREGA DE SERVICIO */}
          <section className="space-y-4">
            <h3 className="bg-slate-100 p-2 text-center text-sm font-black uppercase tracking-widest text-slate-700 rounded-lg">ENTREGA DE SERVICIO</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Prestado por */}
              <div className="space-y-6">
                <p className="text-center text-[10px] font-black uppercase tracking-widest border-b pb-2">Servicio prestado por técnico:</p>
                <div className="space-y-3">
                  <div className="border-2 border-slate-200 rounded-2xl p-2 h-44 relative bg-white shadow-inner">
                    {tecnicoFirmaImg ? (
                      <img src={tecnicoFirmaImg} className="w-full h-full object-contain" alt="Firma Técnico" />
                    ) : (
                      <SignatureCanvas ref={tecnicoSigRef} penColor="black" canvasProps={{ className: "w-full h-full" }} />
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-xl h-9 text-[10px] font-bold border-slate-200 hover:bg-slate-50"
                      onClick={() => {
                        if (tecnicoFirmaImg) setTecnicoFirmaImg(null);
                        else tecnicoSigRef.current?.clear();
                      }}
                    >
                      <Eraser className="h-3 w-3 mr-2" /> Borrar
                    </Button>
                    <label className="flex-1 cursor-pointer">
                      <div className="h-9 w-full border border-slate-200 flex items-center justify-center rounded-xl hover:bg-slate-50 transition-colors text-[10px] font-bold">
                        <Upload className="h-3 w-3 mr-2 text-indigo-600" /> Subir Firma
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-b pb-1">
                  <span className="text-[9px] font-bold text-slate-400">Nombre:</span>
                  <Input className="h-6 p-0 font-bold border-none w-full shadow-none focus-visible:ring-0" value={formData.tecnicoNombre} onChange={(e) => handleChange('tecnicoNombre', e.target.value)} />
                </div>
              </div>

              {/* Fecha finalizacion */}
              <div className="flex flex-col items-center justify-center space-y-4">
                 <p className="text-[10px] font-black text-slate-400">FECHA FINALIZACIÓN:</p>
                 <Input type="date" className="h-10 text-center font-black" value={formData.fechaFinalizacion} onChange={(e) => handleChange('fechaFinalizacion', e.target.value)} />
              </div>

              {/* Recibido conforme */}
              <div className="space-y-6">
                <p className="text-center text-[10px] font-black uppercase tracking-widest border-b pb-2">Recibido conforme:</p>
                <div className="space-y-3">
                  <div className="border-2 border-slate-200 rounded-2xl p-2 h-44 relative bg-white shadow-inner">
                    <SignatureCanvas ref={recibidoSigRef} penColor="black" canvasProps={{ className: "w-full h-full" }} />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full rounded-xl h-9 text-[10px] font-bold border-slate-200 hover:bg-slate-50"
                    onClick={() => recibidoSigRef.current?.clear()}
                  >
                    <Eraser className="h-3 w-3 mr-2" /> Borrar Firma
                  </Button>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 border-b pb-1">
                    <span className="text-[9px] font-bold text-slate-400">Nombre:</span>
                    <Input className="h-6 p-0 font-bold border-none w-full shadow-none focus-visible:ring-0" value={formData.recibidoNombre} onChange={(e) => handleChange('recibidoNombre', e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 border-b pb-1">
                    <span className="text-[9px] font-bold text-slate-400">Cargo:</span>
                    <Input className="h-6 p-0 font-bold border-none w-full shadow-none focus-visible:ring-0" value={formData.recibidoCargo} onChange={(e) => handleChange('recibidoCargo', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </CardContent>

        <CardFooter className="bg-slate-50 p-8 border-t flex justify-end gap-4">
           <Button variant="ghost" onClick={onCancel} className="rounded-xl px-6">Cancelar</Button>
           <Button onClick={handleSubmit} disabled={loading} className="rounded-xl px-12 h-12 text-lg font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200">
             {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
             Generar y Descargar PDF
           </Button>
        </CardFooter>
      </Card>
      
      {/* Mini preview / info */}
      <div className="flex justify-center">
         <Button variant="link" className="text-slate-400 text-xs gap-2" onClick={() => generateGOServicePDF(formData as any)}>
            <Download className="h-3 w-3" /> Previsualizar PDF del Formato
         </Button>
      </div>
    </div>
  );
}
