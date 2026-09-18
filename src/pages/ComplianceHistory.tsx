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
  Clock
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ComplianceSubmission } from '@/types';
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

export default function ComplianceHistory() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = React.useState<ComplianceSubmission[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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

  const filteredSubmissions = submissions.filter(s => 
    s.serviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.technicianName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/compliance')} className="-ml-2 text-slate-500">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" /> 
            Histórico de Cumplimiento
          </h1>
          <p className="text-slate-500 font-medium"> Registro histórico de listas de chequeo trimestrales por servicio.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Buscar por servicio o evaluador..." 
            className="pl-10 w-full md:w-80 rounded-xl border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
          ))
        ) : filteredSubmissions.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <ClipboardCheck className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-bold">No se encontraron registros de cumplimiento.</p>
          </div>
        ) : (
          filteredSubmissions.map((submission) => (
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
                        <h3 className="text-xl font-black text-slate-900 leading-tight">
                          {submission.serviceName}
                        </h3>
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
                        {submission.responses.slice(0, 5).map((r, i) => (
                          <div 
                            key={i} 
                            className={`h-6 w-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black
                              ${r.status === 'compliant' ? 'bg-emerald-500 text-white' : 
                                r.status === 'na' ? 'bg-slate-300 text-white' : 'bg-red-500 text-white'}`}
                          >
                            {r.status === 'compliant' ? 'C' : r.status === 'na' ? 'N' : '!'}
                          </div>
                        ))}
                        {submission.responses.length > 5 && (
                          <div className="h-6 w-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">
                            +{submission.responses.length - 5}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg">
                        <Clock className="h-3 w-3" />
                        Prox. Revisión: {format(new Date(submission.nextReviewDate), 'dd/MM/yyyy')}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
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
