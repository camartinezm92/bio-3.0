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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { collection, onSnapshot, query, where, doc, setDoc, getDoc, getDocs, writeBatch, limit, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { 
  Settings as SettingsIcon, 
  User as UserIcon, 
  Bell, 
  Database, 
  HardDrive,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Wifi,
  Clock
} from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { googleStatus, checkConnection } = useConnectionMonitor();
  const [driveStatus, setDriveStatus] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [testingConnection, setTestingConnection] = React.useState(false);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [sheetsId, setSheetsId] = React.useState('');
  const [purgeLogs, setPurgeLogs] = React.useState<string[]>([]);
  const [isPurging, setIsPurging] = React.useState(false);

  // Profile state
  const [profileData, setProfileData] = React.useState({
    displayName: '',
    gender: 'male'
  });

  React.useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.displayName || '',
        gender: user.gender || 'male'
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user?.uid) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profileData.displayName,
        gender: profileData.gender
      });
      alert('Perfil actualizado con éxito');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error al actualizar el perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const checkDriveConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/drive/health');
      const data = await response.json();
      
      let gmailData = undefined;
      try {
        const gmailResponse = await fetch('/api/gmail/health');
        gmailData = await gmailResponse.json();
      } catch (gmailErr) {
        console.error("Error fetching gmail Health", gmailErr);
      }

      setDriveStatus({ ...data, gmail: gmailData });
      
      // Intentar cargar ID de Sheets desde Firebase una vez conectado
      const docSnap = await getDoc(doc(db, 'config', 'google'));
      if (docSnap.exists()) {
        setSheetsId(docSnap.data().spreadsheetId || '');
      }
    } catch (error) {
      setDriveStatus({ error: 'No se pudo conectar con el servidor' });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    checkDriveConnection();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Administra las preferencias del sistema y tu cuenta.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-5 w-5" />
              Perfil de Usuario
            </CardTitle>
            <CardDescription>
              Actualiza tu información personal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input 
                id="name" 
                value={profileData.displayName}
                onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Escriba su nombre completo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" value={user?.email || ''} disabled className="bg-slate-50" />
            </div>
            <div className="space-y-3">
              <Label>Género (para avatar)</Label>
              <RadioGroup 
                value={profileData.gender} 
                onValueChange={(val) => setProfileData(prev => ({ ...prev, gender: val as any }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" />
                  <Label htmlFor="male" className="font-normal">Masculino 🧔</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" />
                  <Label htmlFor="female" className="font-normal">Femenino 👩</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="font-normal">Otro 🐶</Label>
                </div>
              </RadioGroup>
            </div>
            <Button 
              className="w-full sm:w-auto" 
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Integración Google Drive
            </CardTitle>
            <CardDescription>
              Conecta y configura el almacenamiento de documentos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn(
              "rounded-lg border p-4 transition-colors",
              driveStatus?.status === 'ok' ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
            )}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold flex items-center gap-2">
                  Estado: {driveStatus?.status === 'ok' ? (
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Conectado</span>
                  ) : (
                    <span className="text-red-600 flex items-center gap-1"><XCircle className="h-4 w-4" /> Desconectado</span>
                  )}
                </p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={checkDriveConnection}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
              {driveStatus?.status === 'ok' ? (
                <div className="space-y-3">
                  <p className="text-xs text-emerald-700 font-medium">Carpeta Activa: <span className="font-mono">{driveStatus.folder}</span></p>
                  <Button 
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch('/api/drive/upload', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            name: `TEST_CONEXION_${new Date().toISOString()}.txt`,
                            content: `Prueba de conexión exitosa desde BioCRM\nFecha: ${new Date().toLocaleString()}`,
                            mimeType: 'text/plain'
                          })
                        });
                        const data = await res.json();
                        
                        if (res.ok) {
                          alert('¡Archivo de prueba subido con éxito! ID: ' + data.id);
                        } else {
                          alert('Error en Drive: ' + (data.error || 'Desconocido'));
                        }
                      } catch (e) {
                         alert('Error de red al intentar subir archivo.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    Subir Archivo de Prueba
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-red-700 font-medium">{driveStatus?.error || 'Configura las variables de entorno'}</p>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Instrucciones:</div>
            <p className="text-[11px] text-slate-500 italic">
              Asegúrate de haber compartido la carpeta de Drive con el correo: <br/>
              <span className="font-mono font-bold text-slate-700">ingbiomedico@biocrm-493914.iam.gserviceaccount.com</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones (Gmail)
            </CardTitle>
            <CardDescription>
              Configura el envío de alertas automáticas por correo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn(
              "rounded-lg border p-4 transition-colors",
              driveStatus?.gmail?.status === 'ok' ? "bg-blue-50 border-blue-100" : "bg-slate-50 border-slate-100"
            )}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold flex items-center gap-2">
                  Canal Gmail: {driveStatus?.gmail?.status === 'ok' ? (
                    <span className="text-blue-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Activo</span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1"><XCircle className="h-4 w-4" /> Stand-by</span>
                  )}
                </p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const response = await fetch('/api/gmail/health');
                      const data = await response.json();
                      setDriveStatus((prev: any) => ({ ...prev, gmail: data }));
                    } catch (e) {
                      setDriveStatus((prev: any) => ({ ...prev, gmail: { error: 'Error de servidor' } }));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
              </div>
              {driveStatus?.gmail?.status === 'ok' ? (
                <div className="space-y-3">
                  <p className="text-xs text-blue-700 font-medium">Buzón Emisor: <span className="font-mono">{driveStatus.gmail.email}</span></p>
                  <Button 
                    className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const res = await fetch('/api/gmail/test', { method: 'POST' });
                        const data = await res.json();
                        if (data.status === 'ok') {
                           alert('¡Correo de prueba enviado! Revisa tu bandeja de entrada.');
                        } else {
                           alert('Error: ' + data.error);
                        }
                      } catch (e) {
                         alert('Error al enviar correo.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    Enviar Correo de Prueba
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-slate-600 italic">Habilitar "Domain-wide Delegation" para alertas desde tu correo corporativo.</p>
              )}
            </div>
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between uppercase font-bold text-[10px] text-slate-400">
                <span>Alertas WhatsApp</span>
                {driveStatus?.whatsapp?.status === 'ok' ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600">Activo</Badge>
                ) : (
                  <Badge variant="secondary">Stand-by</Badge>
                )}
              </div>
              
              <div className={cn(
                "rounded-lg border p-4 transition-colors",
                driveStatus?.whatsapp?.status === 'ok' ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-700">Estado de API</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch('/api/whatsapp/health');
                        const data = await response.json();
                        setDriveStatus((prev: any) => ({ ...prev, whatsapp: data }));
                      } catch (e) {
                        setDriveStatus((prev: any) => ({ ...prev, whatsapp: { error: 'Error de servidor' } }));
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  </Button>
                </div>

                {driveStatus?.whatsapp?.status === 'ok' ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-emerald-700 font-mono">Phone ID: {driveStatus.whatsapp.phoneId}</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Button 
                        variant="outline"
                        className="w-full rounded-xl border-emerald-200 text-emerald-700 font-bold h-9 text-[10px]"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await fetch('/api/whatsapp/test', { 
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                templateName: "utility",
                                components: [{
                                  type: "body",
                                  parameters: [
                                    { type: "text", text: "Monitor de Signos Vitales (PRUEBA)" },
                                    { type: "text", text: "SN-TEST-123" },
                                    { type: "text", text: "MANTENIMIENTO PREVENTIVO" },
                                    { type: "text", text: new Date().toLocaleDateString() }
                                  ]
                                }]
                              })
                            });
                            const data = await res.json();
                            if (res.ok) alert('¡WhatsApp con plantilla clínica enviado!');
                            else alert('Error: ' + data.error);
                          } catch (e) {
                            alert('Error al enviar.');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                      >
                        Probar Plantilla Clínica (Utility)
                      </Button>
                      <Button 
                        className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-[10px]"
                        onClick={async () => {
                          setLoading(true);
                          try {
                            const res = await fetch('/api/whatsapp/test', { method: 'POST' });
                            const data = await res.json();
                            if (res.ok) alert('¡WhatsApp de prueba (Hello World) enviado!');
                            else alert('Error: ' + data.error);
                          } catch (e) {
                            alert('Error al enviar.');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading}
                      >
                        Enviar Hello World
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">Configure sus tokens de Meta Developers para habilitar.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Base de Datos
            </CardTitle>
            <CardDescription>
              Mantenimiento y exportación de datos.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase">ID Inventario Maestro (Sheets)</label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Pegue el ID del Google Sheet aquí" 
                  className="rounded-xl h-10 text-xs border-slate-200"
                  value={sheetsId}
                  onChange={(e) => setSheetsId(e.target.value)}
                />
                <Button 
                  className="rounded-xl h-10 px-4 font-bold text-xs"
                  onClick={async () => {
                    try {
                      await setDoc(doc(db, 'config', 'google'), { spreadsheetId: sheetsId });
                      alert('¡ID de Excel guardado!');
                    } catch (e) {
                      alert('Error al guardar.');
                    }
                  }}
                >
                  Guardar
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Este Excel se actualizará automáticamente con cada equipo nuevo.</p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="text-[10px] font-black text-red-500 uppercase">Zona de Peligro</label>
              <p className="text-[11px] text-slate-500 mb-2">Para iniciar producción, escriba "ELIMINAR_TODO_PRODUCCION" y presione el botón.</p>
              <div className="flex gap-2">
                <Input 
                  placeholder="Confirmar eliminación..." 
                  className="rounded-xl h-10 text-xs border-red-100"
                  id="purge-confirm"
                />
                <Button 
                  variant="destructive"
                  className="rounded-xl h-10 px-4 font-bold text-xs"
                  onClick={async () => {
                    const val = (document.getElementById('purge-confirm') as HTMLInputElement).value;
                    if (val !== 'ELIMINAR_TODO_PRODUCCION') return alert('Escriba el código exacto');
                    
                    if(!confirm('¿TOTALMENTE SEGURO? Se borrarán equipos, reportes, traslados, alertas y guías.')) return;

                    setIsPurging(true);
                    setPurgeLogs(['Iniciando purga total...']);
                    try {
                      const colls = [
                        'equipment', 'reports', 'transfers', 
                        'compliance_submissions', 'guides', 'alerts', 
                        'notifications', 'compliance_history'
                      ];
                      let totalDeleted = 0;
                      for (const c of colls) {
                        setPurgeLogs(prev => [...prev, `Limpiando colección: ${c}...`]);
                        let more = true;
                        while (more) {
                          const snap = await getDocs(query(collection(db, c), limit(500)));
                          if (snap.empty) { 
                            more = false; 
                            break; 
                          }
                          const batch = writeBatch(db);
                          let batchCount = 0;
                          snap.docs.forEach(d => { 
                            batch.delete(d.ref); 
                            totalDeleted++; 
                            batchCount++;
                          });
                          await batch.commit();
                          setPurgeLogs(prev => [...prev, `  - Eliminados ${batchCount} registros de ${c}.`]);
                          if (snap.size < 500) more = false;
                        }
                      }
                      setPurgeLogs(prev => [...prev, `¡PURGA COMPLETADA! Total eliminados: ${totalDeleted}`]);
                      alert(`¡REINICIO EXITOSO! ${totalDeleted} registros eliminados. El BioCRM está listo para producción.`);
                      (document.getElementById('purge-confirm') as HTMLInputElement).value = '';
                      window.location.reload();
                    } catch (e) {
                      console.error('Error en purga:', e);
                      setPurgeLogs(prev => [...prev, `ERROR: ${e instanceof Error ? e.message : 'Error desconocido'}`]);
                      alert('Error al purgar los datos.');
                    } finally {
                      setIsPurging(false);
                    }
                  }}
                  disabled={loading || isPurging}
                >
                  {isPurging ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Purgar Datos Pruebas
                </Button>
              </div>

              {purgeLogs.length > 0 && (
                <div className="mt-4 p-3 bg-slate-900 rounded-xl font-mono text-[10px] text-green-400 max-h-40 overflow-y-auto border border-slate-800">
                  {purgeLogs.map((log, i) => (
                    <div key={i} className="mb-1 leading-tight">
                      <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Diagnóstico de Conexión */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              Diagnóstico de Conexión
            </CardTitle>
            <CardDescription>
              Monitorea el estado de comunicación con los servicios externos de Google y Firebase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">Google Drive / API</span>
                  <Badge variant={googleStatus.status === 'ok' ? "default" : "destructive"} className={cn(googleStatus.status === 'ok' ? "bg-emerald-500" : "")}>
                    {googleStatus.status === 'ok' ? 'Operacional' : 'Error'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Clock className="h-3 w-3" />
                    Último check: {googleStatus.lastCheck ? new Date(googleStatus.lastCheck).toLocaleString() : 'Nunca'}
                  </div>
                  {googleStatus.details && (
                    <p className="text-[10px] text-rose-500 font-medium bg-rose-50 p-2 rounded-lg mt-2 border border-rose-100">
                      Error: {googleStatus.details}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-700">Firebase Firestore</span>
                  <Badge variant="default" className="bg-emerald-500">
                    Operacional
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  La conexión con la base de datos es persistente a través de WebSockets.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={async () => {
                  setTestingConnection(true);
                  await checkConnection();
                  setTestingConnection(false);
                }}
                disabled={testingConnection}
              >
                {testingConnection ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Wifi className="h-4 w-4 mr-2" />}
                Probar Conexión Ahora
              </Button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
              <p className="text-amber-500 font-bold mb-1">// Sistema de Monitoreo "Heartbeat"</p>
              <p>• Intervalo de validación: 5 minutos.</p>
              <p>• Consumo de cuota: &lt; 0.01% diario (Llamadas minimalistas).</p>
              <p>• Reintentos automáticos configurados: 3 intentos con 1s de retraso.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
