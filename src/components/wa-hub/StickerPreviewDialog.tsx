import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Send, Sparkles, RotateCcw, Workflow } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type StickerMode = 'normal' | 'process';

interface Props {
  open: boolean;
  onClose: () => void;
  imageFile: File | null;
  onSend: (imageUrl: string) => Promise<void>;
  autoMode?: StickerMode;
}

export default function StickerPreviewDialog({ open, onClose, imageFile, onSend, autoMode }: Props) {
  const [removeBackground, setRemoveBackground] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalUploadedUrl, setOriginalUploadedUrl] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<StickerMode>('normal');

  // Auto-process when autoMode is set
  useEffect(() => {
    if (open && autoMode && imageFile && !processing && !processedUrl) {
      setActiveMode(autoMode);
      // Slight delay to let dialog render
      const t = setTimeout(() => handleProcessAI(autoMode), 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoMode, imageFile]);

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

  const handleProcessAI = async (mode?: StickerMode) => {
    if (!imageFile) return;
    const useMode = mode || activeMode;
    setProcessing(true);
    try {
      const uploadedUrl = await uploadOriginal();

      const { data, error } = await supabase.functions.invoke('generate-sticker', {
        body: {
          imageUrl: uploadedUrl,
          removeBackground: useMode === 'normal' ? removeBackground : false,
          mode: useMode === 'process' ? 'process' : undefined,
        },
      });

      if (error) throw error;

      if (data?.imageBase64) {
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
        toast.success(useMode === 'process' ? 'Processo transformado em figurinha! 🔄' : 'Figurinha processada! ✨');
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
    setActiveMode('normal');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {activeMode === 'process' ? '🔄 Processo → Figurinha' : 'Pré-visualizar Figurinha'}
          </DialogTitle>
        </DialogHeader>

        {/* Preview */}
        <div className="flex items-center justify-center py-4">
          <div className="w-48 h-48 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden relative">
            {processing && (
              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">
                  {activeMode === 'process' ? 'Criando figurinha...' : 'Processando...'}
                </span>
              </div>
            )}
            {displayUrl ? (
              <img src={displayUrl} alt="Sticker preview" className="w-full h-full object-contain" />
            ) : (
              <p className="text-xs text-muted-foreground">Nenhuma imagem</p>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Mode tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
            <button
              onClick={() => setActiveMode('normal')}
              className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                activeMode === 'normal' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              disabled={processing || sending}
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              Figurinha
            </button>
            <button
              onClick={() => setActiveMode('process')}
              className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                activeMode === 'process' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              disabled={processing || sending}
            >
              <Workflow className="w-3 h-3 inline mr-1" />
              Processo
            </button>
          </div>

          {activeMode === 'normal' && (
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
          )}

          {activeMode === 'process' && (
            <p className="text-xs text-muted-foreground px-1">
              A IA vai transformar a foto do processo em uma figurinha estilizada com ícones e setas.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleProcessAI()}
              disabled={processing || sending}
            >
              {processing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : activeMode === 'process' ? (
                <Workflow className="w-3.5 h-3.5 mr-1.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              )}
              {processing ? 'Processando...' : activeMode === 'process' ? 'Gerar do Processo' : 'Processar com IA'}
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
