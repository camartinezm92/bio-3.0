import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, Check, Stethoscope, ChevronRight } from 'lucide-react';
import {
  TECHNOLOGY_CATEGORIES,
  ALL_TECHNOLOGIES,
  TechnologyItem,
  detectTechnology
} from '@/data/technologyChecklists';

interface TechnologySelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTechnology: (tech: TechnologyItem) => void;
  selectedTechId?: string;
  equipmentName?: string;
  equipmentType?: string;
  title?: string;
  description?: string;
}

export default function TechnologySelectorDialog({
  open,
  onOpenChange,
  onSelectTechnology,
  selectedTechId,
  equipmentName,
  equipmentType,
  title = 'Seleccione la Tecnología Biomédica',
  description = 'Seleccione el tipo de tecnología para cargar el protocolo de verificación y mantenimiento correspondiente.'
}: TechnologySelectorDialogProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('Todas');

  const suggestedTech = React.useMemo(() => {
    return detectTechnology(equipmentName, equipmentType);
  }, [equipmentName, equipmentType]);

  const categories = React.useMemo(() => {
    return ['Todas', ...TECHNOLOGY_CATEGORIES.map((c) => c.category)];
  }, []);

  const filteredTechnologies = React.useMemo(() => {
    return ALL_TECHNOLOGIES.filter((tech) => {
      const matchesSearch =
        tech.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tech.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'Todas' || tech.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 rounded-3xl overflow-hidden shadow-2xl border-slate-100 bg-white">
        <DialogHeader className="p-6 pb-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 text-primary-foreground rounded-2xl border border-white/10">
                <Stethoscope className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-white">{title}</DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-0.5">
                  {description}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Quick suggested technology banner */}
          {suggestedTech && (
            <div className="mt-4 p-3 bg-white/10 border border-white/15 rounded-2xl flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />
                <span className="text-slate-300 font-medium">Sugerencia para este equipo:</span>
                <span className="font-bold text-white bg-white/20 px-2.5 py-0.5 rounded-lg">
                  {suggestedTech.name}
                </span>
                <Badge variant="outline" className="text-[10px] text-emerald-300 border-emerald-400/40">
                  {suggestedTech.items.length} ítems
                </Badge>
              </div>
              <Button
                size="sm"
                className="h-8 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 shadow-md"
                onClick={() => {
                  onSelectTechnology(suggestedTech);
                  onOpenChange(false);
                }}
              >
                Usar sugerida
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}
        </DialogHeader>

        {/* Search & Category Filter */}
        <div className="p-6 pb-2 space-y-3 border-b border-slate-100 shrink-0 bg-slate-50/50">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar tecnología biomédica (ej: Cama, Monitor, Bomba, Desfibrilador, RX...)"
              className="pl-10 h-11 rounded-2xl bg-white border-slate-200 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20"
              autoFocus
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Technologies Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {filteredTechnologies.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="font-bold text-sm">No se encontraron tecnologías que coincidan con "{searchTerm}".</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('Todas');
                }}
                className="rounded-xl font-bold"
              >
                Restablecer filtros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTechnologies.map((tech) => {
                const isSelected = selectedTechId === tech.id;
                const isSuggested = suggestedTech?.id === tech.id;

                return (
                  <div
                    key={tech.id}
                    onClick={() => {
                      onSelectTechnology(tech);
                      onOpenChange(false);
                    }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between space-y-3 group ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                        : isSuggested
                        ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-500 hover:bg-emerald-50'
                        : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50/80 hover:shadow-sm'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-primary transition-colors">
                          {tech.category}
                        </span>
                        {isSuggested && (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none text-[9px] font-bold px-1.5 py-0.2">
                            Sugerida
                          </Badge>
                        )}
                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors leading-tight">
                        {tech.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-[11px] text-slate-500">
                      <span className="font-semibold">{tech.items.length} puntos de chequeo</span>
                      <span className="text-primary font-bold group-hover:translate-x-0.5 transition-transform flex items-center">
                        Seleccionar <ChevronRight className="h-3 w-3 ml-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
