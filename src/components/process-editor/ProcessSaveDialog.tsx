import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ProcessSaveDialogProps { open: boolean; onOpenChange: (o: boolean) => void; onSave: (name: string, desc: string) => void; initialName?: string; initialDescription?: string; isUpdate?: boolean; }

export const ProcessSaveDialog: React.FC<ProcessSaveDialogProps> = ({ open, onOpenChange, onSave, initialName = '', initialDescription = '', isUpdate = false }) => {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);
  React.useEffect(() => { if (open) { setName(initialName); setDesc(initialDescription); } }, [open, initialName, initialDescription]);
  const handleSave = () => { if (!name.trim()) return; onSave(name.trim(), desc.trim()); onOpenChange(false); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{isUpdate ? 'Atualizar' : 'Salvar'} Processo</DialogTitle></DialogHeader>
      <div className="space-y-4"><div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Processo de Vendas" /></div><div className="space-y-2"><Label>Descrição</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descreva..." rows={3} /></div></div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={handleSave} disabled={!name.trim()}>{isUpdate ? 'Atualizar' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>
  );
};
