import * as React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { FileText, ShieldCheck, AlertCircle, ExternalLink, Plus, Link as LinkIcon, Paperclip, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Service, ComplianceSubmission, Guide } from '@/types';

export default function Compliance() {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showAddLink, setShowAddLink] = React.useState(false);
  const [newLink, setNewLink] = React.useState({ title: '', url: '' });
  const [isSaving, setIsSaving] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);
  const [lastSubmissions, setLastSubmissions] = React.useState<ComplianceSubmission[]>([]);
  const [guides, setGuides] = React.useState<Guide[]>([]);
  const [stats, setStats] = React.useState({
    habilitation: 0,
    invimaPending: 0,
    guidesCount: 0
  });

  const handleSaveLink = async () => {
    if (!newLink.title || !newLink.url) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'guides'), {
        title: newLink.title,
        url: newLink.url,
        type: 'link',
        createdAt: new Date().toISOString()
      });
      setNewLink({ title: '', url: '' });
      setShowAddLink(false);
    } catch (error) {
      console.error("Error saving link:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      // In a real app with Firebase Storage, we would upload the file here
      // and get a download URL. Since we don't have Storage provisioned,
      // we'll simulate the "link" behavior or store metadata.
      // For now, we'll store it as a 'file' type with its name.
      await addDoc(collection(db, 'guides'), {
        title: file.name,
        url: '#', // In production, this would be the Storage URL
        type: 'file',
        createdAt: new Date().toISOString(),
        fileSize: `${(file.size / 1024).toFixed(1)} KB`
      });
      alert(`Archivo "${file.name}" registrado (Metadata guardada en Firestore).`);
    } catch (error) {
      console.error("Error 'uploading' file:", error);
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  React.useEffect(() => {
    // Load services from Firestore
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      import('@/services/mockData').then(({ mockServices }) => {
        setServices(data.length > 0 ? data : mockServices);
      });
    }, (error) => {
      console.warn("Compliance services snapshot error:", error);
    });

    // Load last 5 submissions for history preview
    const qSubmissions = query(collection(db, 'compliance_submissions'), orderBy('date', 'desc'), limit(5));
    const unsubSubmissions = onSnapshot(qSubmissions, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ComplianceSubmission[];
      setLastSubmissions(data);

      if (data.length > 0) {
        // Calculate dynamic habilitation score
        // We want the average of the LATEST score per service
        const latestByService: Record<string, number> = {};
        
        // Since snapshot is ordered by date desc, the first one we see for each service is the latest
        snapshot.docs.forEach(doc => {
          const sub = doc.data() as ComplianceSubmission;
          if (latestByService[sub.serviceId] === undefined) {
            latestByService[sub.serviceId] = sub.score;
          }
        });

        const scores = Object.values(latestByService);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        setStats(prev => ({ ...prev, habilitation: Math.round(avg) }));
      }
    }, (error) => {
      console.warn("Compliance submissions snapshot error:", error);
    });

    // Calculate INVIMA pending
    const unsubInvima = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const now = new Date();
      const pendingCount = snapshot.docs.filter(doc => {
        const eq = doc.data();
        const hasNoInvima = !eq.registrationInvima || eq.registrationInvima.trim() === '';
        let isExpired = false;
        if (eq.registrationExpiration) {
          const expirationDate = new Date(eq.registrationExpiration);
          isExpired = expirationDate <= now;
        }
        return hasNoInvima || isExpired;
      }).length;
      setStats(prev => ({ ...prev, invimaPending: pendingCount }));
    }, (error) => {
      console.warn("Compliance INVIMA snapshot error:", error);
    });

    // Count Guías Rápidas
    const unsubGuides = onSnapshot(collection(db, 'guides'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Guide[];
      setGuides(data);
      setStats(prev => ({ ...prev, guidesCount: data.length }));
    }, (error) => {
      console.warn("Compliance guides snapshot error:", error);
    });

    return () => {
      unsubServices();
      unsubSubmissions();
      unsubInvima();
      unsubGuides();
    };
  }, []);

  const regulations = [
    {
      title: 'Resolución 3100 de 2019',
      description: 'Habilitación de servicios de salud y estándares de talento humano e infraestructura.',
      status: 'Vigente',
      type: 'Norma Técnica',
      url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3100-de-2019.pdf'
    },
    {
      title: 'Decreto 4725 de 2005',
      description: 'Régimen de registros sanitarios, permiso de comercialización y vigilancia sanitaria de dispositivos médicos.',
      status: 'Vigente',
      type: 'Norma Técnica',
      url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/Decreto-4725-de-2005.pdf'
    },
    {
      title: 'Manual Único de Acreditación en Salud',
      description: 'Estándares superiores de calidad y mejoramiento continuo para instituciones prestadoras de servicios de salud.',
      status: 'Vigente',
      type: 'Manual Técnico',
      url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/CA/manual-acreditacion-salud-ambulatorio-hospitalario.pdf'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Normativa y Cumplimiento</h1>
          <p className="text-slate-500 font-medium">
            Documentación legal y estándares de calidad para equipos biomédicos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/compliance/history')} className="rounded-xl border-slate-200">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Histórico de Chequeos
          </Button>
          <Button variant="outline" onClick={() => setShowAddLink(!showAddLink)} className="rounded-xl border-slate-200">
            <LinkIcon className="mr-2 h-4 w-4" />
            Adjuntar Link
          </Button>
          <Button 
            className="rounded-xl shadow-lg shadow-primary/20" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isSaving ? 'Subiendo...' : 'Subir Archivo'}
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.jpg,.png"
          />
        </div>
      </div>

      {showAddLink && (
        <Card className="bg-slate-50 border-none shadow-inner rounded-3xl animate-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6 flex gap-4">
            <div className="flex-1 space-y-2">
              <Input 
                placeholder="Título del documento o link" 
                className="rounded-xl border-slate-200" 
                value={newLink.title}
                onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
              />
              <Input 
                placeholder="URL (Google Drive, Excel Online, etc.)" 
                className="rounded-xl border-slate-200" 
                value={newLink.url}
                onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <Button 
              className="self-end rounded-xl font-black px-8" 
              onClick={handleSaveLink}
              disabled={isSaving || !newLink.title || !newLink.url}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-blue-50 border-none shadow-xl shadow-blue-200/20 rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 font-black">
              <ShieldCheck className="h-5 w-5" />
              Estado de Habilitación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-blue-900">{stats.habilitation}%</div>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mt-2">
              Cumplimiento de estándares
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-none shadow-xl shadow-amber-200/20 rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 font-black text-lg">
              <AlertCircle className="h-5 w-5" />
              Pendientes INVIMA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-amber-900">{stats.invimaPending}</div>
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mt-2">
              Registros por vencer
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black text-lg">
              <FileText className="h-5 w-5 text-slate-400" />
              Guías Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{stats.guidesCount}</div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-2">
              Protocolos de limpieza
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          Guías Rápidas y Protocolos
        </h2>
        {guides.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <Card key={guide.id} className="bg-white border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-primary/10 transition-colors">
                      <Paperclip className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">{guide.title}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg"
                    onClick={() => window.open(guide.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
            <Paperclip className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-bold text-sm">No hay protocolos de limpieza registrados aún.</p>
            <p className="text-slate-400 text-xs mt-1">Usa los botones superiores para añadir links o subir archivos.</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          Listas de Chequeo de Obligatoriedad (Trimestral)
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <Card 
              key={service.id} 
              className="hover:bg-slate-50 transition-all cursor-pointer border-slate-100 rounded-3xl group shadow-sm hover:shadow-md"
              onClick={() => navigate(`/compliance/checklist/${service.id}`)}
            >
              <CardHeader className="p-6">
                <CardTitle className="text-sm font-black flex items-center justify-between">
                  <span className="flex items-center gap-2 text-slate-900">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    {service.name}
                  </span>
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  Verificar Dotación (Res. 3100)
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <p className="text-[10px] text-slate-500 font-medium">Frecuencia: Cada 3 meses</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900">Marco Normativo Vigente</h2>
        <div className="grid gap-4">
          {regulations.map((reg) => (
            <Card key={reg.title} className="border-none shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardHeader className="pb-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900">{reg.title}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{reg.type}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{reg.status}</span>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="lg" 
                    className="rounded-2xl font-black px-6 shadow-md shadow-primary/20"
                    onClick={() => window.open(reg.url, '_blank')}
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Ver PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{reg.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
