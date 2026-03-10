import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Sparkles, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  imageFile: File | null;
  onSend: (imageUrl: string) => Promise<void>;
}

export default function StickerPreviewDialog({ open, onClose, imageFile, onSend }: Props) {
  const [removeBackground, setRemoveBackground] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalUploadedUrl, setOriginalUploadedUrl] = useState<string | null>(null);

  // Generate local preview when file changes
  const localPreview = imageFile ? URL.createObjectURL(imageFile) : null;

  const displayUrl = processedUrl || previewUrl || localPreview;

  const uploadOriginal = async (): Promise<string> => {
    if (originalUploadedUrl) return originalUploadedUrl;
    if (!imageFile) throw new Error('No file');

    const ext = imageFile.name.split('.').pop() || 'webp';
    const filePath = `sticker_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const { error } = await supabase.storage.from('wa-media').upload(filePath, imageFile, { contentType: imageFile.type, upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('wa-media').getPublicUrl(filePath);
    setOriginalUploadedUrl(publicUrl);
    setPreviewUrl(publicUrl);
    return publicUrl;
  };

  const handleProcessAI = async () => {
    if (!imageFile) return;
    setProcessing(true);
    try {
      const uploadedUrl = await uploadOriginal();

      const { data, error } = await supabase.functions.invoke('generate-sticker', {
        body: { imageUrl: uploadedUrl, removeBackground },
      });

      if (error) throw error;

      if (data?.imageBase64) {
        // Upload AI result to storage
        const base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/png' });
        const stickerPath = `sticker_ai_${Date.now()}.png`;
        const { error: upErr } = await supabase.storage.from('wa-media').upload(stickerPath, blob, { contentType: 'image/png', upsert: false });
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('wa-media').getPublicUrl(stickerPath);
        setProcessedUrl(publicUrl);
        toast.success('Figurinha processada! ✨');
      } else if (data?.fallback) {
        toast.info('IA não conseguiu processar. Envie a original.');
      } else {
        throw new Error('No image returned');
      }
    } catch (err) {
      console.error('AI sticker error:', err);
      toast.error('Erro ao processar com IA.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setProcessedUrl(null);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      let urlToSend = processedUrl;
      if (!urlToSend) {
        urlToSend = await uploadOriginal();
      }
      await onSend(urlToSend);
      handleClose();
    } catch (err) {
      console.error('Error sending sticker:', err);
      toast.error('Erro ao enviar figurinha.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setProcessedUrl(null);
    setOriginalUploadedUrl(null);
    setRemoveBackground(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Pré-visualizar Figurinha</DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="flex items-center justify-center py-4">
          <div className="w-48 h-48 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
            {displayUrl ? (
              <img src={displayUrl} alt="Sticker preview" className="w-full h-full object-contain" />
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma imagem</p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <Label htmlFor="remove-bg" className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Remover fundo (IA)
            </Label>
            <Switch
              id="remove-bg"
              checked={removeBackground}
              onCheckedChange={setRemoveBackground}
              disabled={processing || sending}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleProcessAI}
              disabled={processing || sending}
            >
              {processing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              {processing ? 'Processando...' : 'Processar com IA'}
            </Button>

            {processedUrl && (
              <Button variant="ghost" size="sm" onClick={handleReset} disabled={processing || sending}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Original
              </Button>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleClose} disabled={processing || sending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={processing || sending || !displayUrl}>
            {sending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
