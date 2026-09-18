import * as React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Phone, Mail, User, Plus, Search, MessageCircle, ExternalLink, Loader2, Trash2, MapPin, Eye, Building, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { collection, onSnapshot, addDoc, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Provider } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Providers() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingProvider, setEditingProvider] = React.useState<Provider | null>(null);
  const [providerToDelete, setProviderToDelete] = React.useState<Provider | null>(null);
  const [selectedProviderDetails, setSelectedProviderDetails] = React.useState<Provider | null>(null);
  const [newProvider, setNewProvider] = React.useState<Partial<Provider>>({
    name: '',
    contactName: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    specialties: []
  });
  const [specialtyInput, setSpecialtyInput] = React.useState('');

  const isAdmin = user?.role === 'ADMIN';

  React.useEffect(() => {
    if (editingProvider) {
      setNewProvider({ ...editingProvider });
    } else {
      setNewProvider({
        name: '',
        contactName: '',
        phone: '',
        whatsapp: '',
        email: '',
        address: '',
        city: '',
        specialties: []
      });
    }
  }, [editingProvider, showAddModal]);

  React.useEffect(() => {
    const q = query(collection(db, 'providers'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Provider[];
      setProviders(data);
      setLoading(false);
    }, (error) => {
      console.warn("Providers snapshot error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSaveProvider = async () => {
    if (!newProvider.name || !newProvider.email) return;

    try {
      if (editingProvider) {
        await updateDoc(doc(db, 'providers', editingProvider.id), {
          ...newProvider,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'providers'), {
          ...newProvider,
          createdAt: new Date().toISOString(),
        });
      }
      setShowAddModal(false);
      setEditingProvider(null);
    } catch (error) {
      console.error("Error saving provider:", error);
    }
  };

  const handleDeleteProvider = async () => {
    if (!providerToDelete) return;
    try {
      await deleteDoc(doc(db, 'providers', providerToDelete.id));
      setProviderToDelete(null);
    } catch (error) {
      console.error("Error deleting provider:", error);
      alert('Error al eliminar');
    }
  };

  const addSpecialty = () => {
    if (specialtyInput.trim() && !newProvider.specialties?.includes(specialtyInput.trim())) {
      setNewProvider(prev => ({
        ...prev,
        specialties: [...(prev.specialties || []), specialtyInput.trim()]
      }));
      setSpecialtyInput('');
    }
  };

  const removeSpecialty = (s: string) => {
    setNewProvider(prev => ({
      ...prev,
      specialties: prev.specialties?.filter(item => item !== s)
    }));
  };

  const handleContactWhatsApp = (phone: string) => {
    // Standardize number (remove spaces, symbols)
    const cleanNumber = phone.replace(/\D/g, '');
    const url = `https://web.whatsapp.com/send?phone=${cleanNumber}`;
    window.open(url, '_blank');
  };

  const handleContactEmail = (email: string) => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=Consulta Técnica - Gestión Biomédica`;
    window.open(url, '_blank');
  };

  const filteredProviders = providers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Directorio de Proveedores</h1>
          <p className="text-sm text-slate-500 font-bold mt-1">
            Gestión de servicios técnicos, comerciales y soporte externo.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddModal(true)} className="rounded-xl h-10 font-black shadow-lg shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" />
            NUEVO PROVEEDOR
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input 
          placeholder="Buscar por marca, contacto o especialidad..." 
          className="pl-12 h-12 rounded-2xl bg-white border-slate-200 font-medium" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredProviders.length === 0 ? (
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] p-16 text-center bg-slate-50/50">
          <div className="bg-slate-200/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-900">No se encontraron proveedores</h3>
          <p className="text-slate-500 font-medium mt-1">Intenta con otro término de búsqueda.</p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProviders.map((provider) => (
            <Card 
              key={provider.id} 
              className="overflow-hidden border-none shadow-lg shadow-slate-200/30 rounded-3xl transition-all hover:shadow-xl hover:shadow-slate-300/40 group bg-white cursor-pointer"
              onClick={() => setSelectedProviderDetails(provider)}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-black text-slate-900 leading-tight">{provider.name}</CardTitle>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.specialties?.map(s => (
                        <Badge key={s} variant="secondary" className="text-[9px] font-black uppercase rounded-lg border-slate-100 bg-slate-50 text-slate-500">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-slate-300 hover:text-primary" 
                        onClick={() => {
                          setEditingProvider(provider);
                          setShowAddModal(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-slate-300 hover:text-red-500" 
                        onClick={() => setProviderToDelete(provider)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-2 pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                    <div className="p-2 bg-slate-50 rounded-xl">
                      <User className="h-4 w-4 text-slate-400" />
                    </div>
                    <span>{provider.contactName}</span>
                  </div>
                  {provider.phone && (
                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <Phone className="h-4 w-4 text-slate-400" />
                      </div>
                      <span className="font-mono">{provider.phone}</span>
                    </div>
                  )}
                  {provider.email && (
                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <Mail className="h-4 w-4 text-slate-400" />
                      </div>
                      <span className="truncate">{provider.email}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl h-11 font-bold border-slate-100 hover:bg-slate-50 text-slate-700 text-xs tracking-tight flex items-center justify-center gap-1.5"
                    onClick={() => setSelectedProviderDetails(provider)}
                  >
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                    VER FICHA
                  </Button>

                  <div className="flex-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button className="w-full rounded-xl h-11 font-black shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5 text-xs">
                            CONTACTAR
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-slate-100 shadow-xl">
                        {provider.whatsapp && (
                          <DropdownMenuItem 
                            onClick={() => handleContactWhatsApp(provider.whatsapp || '')}
                            className="rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-emerald-50 focus:text-emerald-700 cursor-pointer flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-emerald-100 rounded-lg">
                              <MessageCircle className="h-4 w-4 text-emerald-600" />
                            </div>
                            WhatsApp Web
                          </DropdownMenuItem>
                        )}
                        {provider.phone && (
                          <DropdownMenuItem 
                            onClick={() => window.open(`tel:${provider.phone}`)}
                            className="rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-slate-50 cursor-pointer flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-slate-100 rounded-lg">
                              <Phone className="h-4 w-4 text-slate-500" />
                            </div>
                            Llamar ahora
                          </DropdownMenuItem>
                        )}
                        {provider.email && (
                          <DropdownMenuItem 
                            onClick={() => handleContactEmail(provider.email)}
                            className="rounded-xl px-4 py-3 font-bold text-slate-700 focus:bg-blue-50 focus:text-blue-700 cursor-pointer flex items-center gap-3"
                          >
                            <div className="p-1.5 bg-blue-100 rounded-lg">
                              <Mail className="h-4 w-4 text-blue-600" />
                            </div>
                            Enviar Correo (Gmail)
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
 
      {/* Add Provider Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-slate-900 uppercase">
              {editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              {editingProvider 
                ? `Actualiza la información de ${editingProvider.name}.`
                : 'Registra un nuevo contacto técnico o comercial en la red de soporte.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-6 py-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="font-black text-slate-700 text-sm">Nombre de la Empresa / Marca</Label>
              <Input 
                id="name" 
                value={newProvider.name || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej. SIEMENS, MINDRAY..."
                className="h-12 rounded-2xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact" className="font-black text-slate-700 text-sm">Persona de Contacto</Label>
              <Input 
                id="contact" 
                value={newProvider.contactName || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, contactName: e.target.value }))}
                placeholder="Nombre del asesor..."
                className="h-12 rounded-2xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city" className="font-black text-slate-700 text-sm">Ciudad Central</Label>
              <Input 
                id="city" 
                value={newProvider.city || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Ej. Bogotá, Honda..."
                className="h-12 rounded-2xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="font-black text-slate-700 text-sm">Dirección de la Empresa</Label>
              <Input 
                id="address" 
                value={newProvider.address || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Ej. Calle 123 # 45-67, Of 201..."
                className="h-12 rounded-2xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="font-black text-slate-700 text-sm">Teléfono Principal</Label>
              <Input 
                id="phone" 
                value={newProvider.phone || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+57..."
                className="h-12 rounded-2xl border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="font-black text-emerald-700 text-sm">WhatsApp (Número Completo)</Label>
              <Input 
                id="whatsapp" 
                value={newProvider.whatsapp || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="Ej. 573001234567"
                className="h-12 rounded-2xl border-emerald-100 bg-emerald-50/20"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="email" className="font-black text-slate-700 text-sm">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email"
                value={newProvider.email || ''}
                onChange={(e) => setNewProvider(prev => ({ ...prev, email: e.target.value }))}
                placeholder="proveedor@empresa.com"
                className="h-12 rounded-2xl border-slate-200"
              />
            </div>
            <div className="col-span-2 space-y-3">
              <Label className="font-black text-slate-700 text-sm">Especialidades / Servicios</Label>
              <div className="flex gap-2">
                <Input 
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addSpecialty()}
                  placeholder="Ej. UCI, Rayos X, Bombas de Infusión..."
                  className="h-10 rounded-xl"
                />
                <Button onClick={addSpecialty} variant="secondary" className="rounded-xl font-bold">Agregar</Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {newProvider.specialties?.map(s => (
                  <Badge key={s} className="px-3 py-1 rounded-xl bg-slate-100 text-slate-600 font-bold border-none flex items-center gap-1.5 group">
                    {s}
                    <button onClick={() => removeSpecialty(s)} className="text-slate-400 hover:text-red-500 transition-colors">
                      <Plus className="h-3 w-3 rotate-45" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
 
          <DialogFooter className="gap-3 mt-4">
            <Button variant="ghost" onClick={() => {
              setShowAddModal(false);
              setEditingProvider(null);
            }} className="rounded-2xl font-black">CANCELAR</Button>
            <Button onClick={handleSaveProvider} className="rounded-2xl font-black px-10 h-12 shadow-xl shadow-primary/20">
              {editingProvider ? 'GUARDAR CAMBIOS' : 'GUARDAR PROVEEDOR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
 
      {/* Delete Confirmation Modal */}
      <Dialog open={!!providerToDelete} onOpenChange={() => setProviderToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-red-600">¿ELIMINAR PROVEEDOR?</DialogTitle>
            <DialogDescription className="font-bold">
              Se eliminará <span className="text-slate-900">{providerToDelete?.name}</span> del directorio. Esta acción es irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6">
            <Button variant="ghost" onClick={() => setProviderToDelete(null)} className="rounded-xl font-bold">CANCELAR</Button>
            <Button variant="destructive" onClick={handleDeleteProvider} className="rounded-xl font-bold px-6 shadow-lg shadow-red-200">
              SÍ, ELIMINAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Details Modal (Ficha del Proveedor) */}
      <Dialog open={!!selectedProviderDetails} onOpenChange={(open) => !open && setSelectedProviderDetails(null)}>
        <DialogContent className="max-w-lg rounded-[2.5rem] p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase flex items-center gap-2">
              <Building className="h-6 w-6 text-primary" />
              Ficha del Proveedor
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              Información detallada técnica y de contacto del proveedor.
            </DialogDescription>
          </DialogHeader>

          {selectedProviderDetails && (
            <div className="space-y-6 py-4 animate-in fade-in duration-300">
              {/* Header card with name and city */}
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 leading-none">{selectedProviderDetails.name}</h3>
                  <div className="flex items-center gap-1.5 mt-2 text-sm font-bold text-slate-500">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{selectedProviderDetails.city || 'No especificada'}</span>
                  </div>
                </div>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/15 border-none font-black text-[10px] py-1 px-3 tracking-widest rounded-lg">
                  ACTIVO
                </Badge>
              </div>

              {/* Grid with info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Section: Empresa */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Información General</h4>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Dirección</span>
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                        <Building className="h-4 w-4 text-slate-400 shrink-0" />
                        {selectedProviderDetails.address || 'No registrada'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Ciudad</span>
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                        {selectedProviderDetails.city || 'No registrada'}
                      </span>
                    </div>
                    {selectedProviderDetails.createdAt && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha Registro</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                          {new Date(selectedProviderDetails.createdAt).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Contacto */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Contacto</h4>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Nombre del Contacto</span>
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                        <User className="h-4 w-4 text-slate-400 shrink-0" />
                        {selectedProviderDetails.contactName}
                      </span>
                    </div>
                    {selectedProviderDetails.phone && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5">
                          <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                          <a href={`tel:${selectedProviderDetails.phone}`} className="hover:underline hover:text-primary font-mono">{selectedProviderDetails.phone}</a>
                        </span>
                      </div>
                    )}
                    {selectedProviderDetails.email && (
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Correo Electrónico</span>
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mt-0.5 truncate">
                          <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="truncate hover:text-primary cursor-pointer" onClick={() => handleContactEmail(selectedProviderDetails.email)}>{selectedProviderDetails.email}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Specialties */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Especialidades / Marcas Soportadas</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProviderDetails.specialties && selectedProviderDetails.specialties.length > 0 ? (
                    selectedProviderDetails.specialties.map(s => (
                      <Badge key={s} variant="secondary" className="text-[10px] font-black uppercase rounded-lg border-slate-100 bg-slate-100 text-slate-600 px-2.5 py-1">
                        {s}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 font-bold italic">Ninguna registrada</span>
                  )}
                </div>
              </div>

              {/* Actions row */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 gap-3">
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    className="rounded-2xl font-bold h-11 border-slate-200"
                    onClick={() => {
                      setEditingProvider(selectedProviderDetails);
                      setSelectedProviderDetails(null);
                      setShowAddModal(true);
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4 text-slate-400" />
                    EDITAR REGISTRO
                  </Button>
                )}
                
                <div className="flex gap-2 ml-auto">
                  {selectedProviderDetails.whatsapp && (
                    <Button 
                      className="rounded-2xl font-bold h-11 bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-100"
                      onClick={() => handleContactWhatsApp(selectedProviderDetails.whatsapp || '')}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WHATSAPP
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    className="rounded-2xl font-bold h-11"
                    onClick={() => setSelectedProviderDetails(null)}
                  >
                    CERRAR
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
