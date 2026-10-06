import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ClipboardCheck, 
  ArrowLeft, 
  FileText, 
  Download,
  Calendar,
  User,
  Activity,
  Trash2,
  Search,
  Clock,
  Laptop,
  Building2,
  Stethoscope
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ComplianceSubmission } from '@/types';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generateCompliancePDF } from '@/lib/pdfGenerator';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function ComplianceHistory() {
  const navigate = useNavigate();
  const { scope: globalScope, scopeConfig } = useTechnologyScope();
  const [submissions, setSubmissions] = React.useState<ComplianceSubmission[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [scopeFilter, setScopeFilter] = React.useState<string>(globalScope);

  React.useEffect(() => {
    setScopeFilter(globalScope);
  }, [globalScope]);

  React.useEffect(() => {
    const q = query(collection(db, 'compliance_submissions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ComplianceSubmission[];
      setSubmissions(data);
      setLoading(false);
    }, (error) => {
      console.warn("ComplianceHistory submissions snapshot error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'compliance_submissions', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting submission:", error);
    }
  };

  const filteredSubmissions = submissions.filter(s => {
    // 1. Scope filter
    const subScope = s.technologyScope || 'biomedical';
    if (scopeFilter !== 'all' && subScope !== scopeFilter) {
      return false;
    }

    // 2. Search term
    const matchesSearch = 
      s.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.formCode && s.formCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.standardName && s.standardName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/compliance')} className="-ml-2 text-slate-500">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Normativa
          </Button>
          <div className="flex items-center gap-2">
            <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border", scopeConfig.badgeBg, scopeConfig.badgeBorder, scopeConfig.textColor)}>
              {scopeConfig.shortLabel}
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" /> 
            Histórico de Cumplimiento (Res. 3100)
          </h1>
          <p className="text-slate-500 font-medium">Registro histórico de auditorías y listas de chequeo trimestrales por servicio.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por servicio, evaluador o código..." 
            className="pl-10 w-full md:w-80 rounded-xl border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Scope Filter Tabs (especially for 'all' scope view) */}
      {globalScope === 'all' && (
        <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className={cn(
              "py-2 px-4 rounded-xl text-xs font-black transition-all",
              scopeFilter === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
            )}
          >
            Todas las Áreas ({submissions.length})
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('biomedical')}
            className={cn(
              "flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all",
              scopeFilter === 'biomedical' ? "bg-white text-blue-700 shadow-sm border border-blue-200" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <span>Biomédica</span>
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('computing')}
            className={cn(
              "flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all",
              scopeFilter === 'computing' ? "bg-white text-cyan-700 shadow-sm border border-cyan-200" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Laptop className="h-4 w-4 text-cyan-600" />
            <span>TIC / Sistemas</span>
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('infrastructure')}
            className={cn(
              "flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-black transition-all",
              scopeFilter === 'infrastructure' ? "bg-white text-amber-700 shadow-sm border border-amber-200" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Building2 className="h-4 w-4 text-amber-600" />
            <span>Infraestructura</span>
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
          ))
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <ClipboardCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron registros de cumplimiento para esta área.</p>
          </div>
        ) : (
          filteredSubmissions.map((submission) => {
            const subScope = submission.technologyScope || 'biomedical';
            return (
              <Card key={submission.id} className="border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row md:items-center p-6 gap-6">
                    {/* Score Indicator */}
                    <div className={`
                      h-20 w-20 rounded-2xl flex flex-col items-center justify-center border-2 shrink-0
                      ${submission.score >= 90 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                        submission.score >= 70 ? 'bg-amber-50 border-amber-100 text-amber-600' : 
                        'bg-red-50 border-red-100 text-red-600'}
                    `}>
                      <span className="text-[10px] font-black uppercase tracking-widest">Score</span>
                      <span className="text-2xl font-black">{submission.score}%</span>
                    </div>

                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                              subScope === 'computing' ? "bg-cyan-50 border-cyan-200 text-cyan-700" :
                              subScope === 'infrastructure' ? "bg-amber-50 border-amber-200 text-amber-700" :
                              "bg-blue-50 border-blue-200 text-blue-700"
                            )}>
                              {subScope === 'computing' ? 'TIC / SISTEMAS' : subScope === 'infrastructure' ? 'INFRAESTRUCTURA' : 'BIOMÉDICA'}
                            </span>
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                              {submission.formCode || (subScope === 'computing' ? 'TIC-FOR-015' : subScope === 'infrastructure' ? 'INF-FOR-022' : 'CAL-FOR-088')}
                            </span>
                          </div>
                          <h3 className="text-xl font-black text-slate-900 leading-tight mt-1">
                            {submission.serviceName}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            {submission.standardName || 'Verificación de Estándares Res. 3100'}
                          </p>
                          <div className="flex flex-wrap gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(submission.date), 'PPP', { locale: es })}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                              <User className="h-3 w-3" />
                              {submission.technicianName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-red-500 hover:bg-red-50 rounded-xl md:opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setDeleteId(submission.id)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="rounded-xl font-bold border-slate-200"
                            onClick={() => generateCompliancePDF(submission)}
                          >
                            <Download className="mr-2 h-4 w-4 text-primary" />
                            PDF
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex -space-x-2">
                          {submission.responses.slice(0, 6).map((r, i) => (
                            <div 
                              key={i} 
                              className={`h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black
                                ${r.status === 'compliant' ? 'bg-emerald-500 text-white' : 
                                  r.status === 'na' ? 'bg-slate-300 text-white' : 'bg-red-500 text-white'}`}
                              title={`${r.itemName}: ${r.status}`}
                            >
                              {r.status === 'compliant' ? 'C' : r.status === 'na' ? 'N' : '!'}
                            </div>
                          ))}
                          {submission.responses.length > 6 && (
                            <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">
                              +{submission.responses.length - 6}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">
                          <Clock className="h-3 w-3" />
                          Próx. Revisión: {format(new Date(submission.nextReviewDate), 'dd/MM/yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">¿Eliminar registro?</DialogTitle>
            <DialogDescription className="font-medium">
              Esta acción no se puede deshacer. Se eliminará permanentemente el registro de cumplimiento del historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="rounded-xl font-bold" onClick={handleDelete}>
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
