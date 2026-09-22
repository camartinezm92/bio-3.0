import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'warning' | 'info';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  icon = 'warning',
  isLoading = false
}: ConfirmModalProps) {
  const getIcon = () => {
    switch (icon) {
      case 'trash':
        return <Trash2 className="h-6 w-6 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-600" />;
      case 'info':
      default:
        return <Info className="h-6 w-6 text-indigo-600" />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-50 border-rose-100 text-rose-600';
      case 'warning':
        return 'bg-amber-50 border-amber-100 text-amber-600';
      case 'primary':
      default:
        return 'bg-indigo-50 border-indigo-100 text-indigo-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-2xl border shrink-0", getIconBg())}>
            {getIcon()}
          </div>
          <div className="space-y-1.5 flex-1 pt-0.5">
            <DialogTitle className="text-base font-black text-slate-900 leading-snug">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 border-t border-slate-100 pt-4 bg-transparent p-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl h-10 px-5 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={cn(
              "rounded-xl h-10 px-5 text-xs font-bold text-white shadow-sm w-full sm:w-auto",
              variant === 'danger' && "bg-rose-600 hover:bg-rose-700 active:bg-rose-800",
              variant === 'warning' && "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
              variant === 'primary' && "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
            )}
          >
            {isLoading ? 'Procesando...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  buttonText?: string;
}

export function FeedbackModal({
  isOpen,
  onClose,
  title,
  description,
  type = 'info',
  buttonText = 'Entendido'
}: FeedbackModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-6 w-6 text-emerald-600" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-rose-600" />;
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-amber-600" />;
      case 'info':
      default:
        return <Info className="h-6 w-6 text-indigo-600" />;
    }
  };

  const getBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 border-emerald-100';
      case 'error':
        return 'bg-rose-50 border-rose-100';
      case 'warning':
        return 'bg-amber-50 border-amber-100';
      case 'info':
      default:
        return 'bg-indigo-50 border-indigo-100';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-2xl border shrink-0", getBg())}>
            {getIcon()}
          </div>
          <div className="space-y-1.5 flex-1 pt-0.5">
            <DialogTitle className="text-base font-black text-slate-900 leading-snug">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end border-t border-slate-100 pt-4 bg-transparent p-0">
          <Button
            type="button"
            onClick={onClose}
            className="rounded-xl h-10 px-6 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
          >
            {buttonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
