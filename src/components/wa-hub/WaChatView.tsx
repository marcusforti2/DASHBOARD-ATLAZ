import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Loader2, Image, Mic, Square, Paperclip, Zap, Sparkles, ChevronDown, User, Sticker, Workflow } from 'lucide-react';
import { WaConversation, WaMessage, useQuickReplies } from '@/hooks/use-wa-hub';
import { WaAiTools } from './WaAiTools';
import { WaContactTagBadges } from './WaContactTagBadges';
import { getAvatarColor, formatTime, formatDateSeparator } from '@/lib/wa-utils';
import type { WaTag } from '@/hooks/use-wa-tags';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import StickerPreviewDialog from './StickerPreviewDialog';

interface Props {
  conversation: WaConversation;
  messages: WaMessage[];
  messagesLoading: boolean;
  onBack: () => void;
  onSend: (text: string) => Promise<void>;
  onSendMedia: (mediaType: string, mediaUrl: string, caption?: string) => Promise<void>;
  onSendAudio: (audioUrl: string) => Promise<void>;
  onSendSticker: (imageUrl: string) => Promise<void>;
  tags: WaTag[];
  assignedTagIds: string[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
  onToggleProfile?: () => void;
  showProfileButton?: boolean;
}

export default function WaChatView({
  conversation, messages, messagesLoading, onBack, onSend, onSendMedia, onSendAudio, onSendSticker,
  tags, assignedTagIds, onAddTag, onRemoveTag, onToggleProfile, showProfileButton,
}: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [mediaPopoverOpen, setMediaPopoverOpen] = useState(false);
  const [stickerPreviewUrl, setStickerPreviewUrl] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const { replies: quickReplies } = useQuickReplies();

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await onSend(text); setText(''); }
    finally { setSending(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, mediaType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Arquivo muito grande (máx. 10MB)'); return; }
    const filename = `${conversation.contact.phone}-${Date.now()}-${file.name}`;
    try {
      const { data, error } = await supabase.storage.from('whatsapp-media').upload(filename, file, {
        cacheControl: '3600', upsert: false,
      });
      if (error) throw error;
      if (!data?.path) throw new Error('Falha ao salvar arquivo');
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/whatsapp-media/${data.path}`;
      await onSendMedia(mediaType, url);
      toast.success('Arquivo enviado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar arquivo');
    } finally {
      setMediaPopoverOpen(false);
      e.target.value = ''; // reset input
    }
  };

  const handleSendAudio = async (audioUrl: string) => {
    try { await onSendAudio(audioUrl); }
    catch (err: any) { toast.error(err.message || 'Erro ao enviar áudio'); }
  };

  const handleSendSticker = async (imageUrl: string) => {
    try { await onSendSticker(imageUrl); }
    catch (err: any) { toast.error(err.message || 'Erro ao enviar figurinha'); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="lg:hidden p-1.5 rounded-full hover:bg-muted">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: `hsl(${getAvatarColor(conversation.contact.name)})` }}>
          {conversation.contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{conversation.contact.name}</p>
          <p className="text-xs text-muted-foreground truncate">{conversation.contact.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          {showProfileButton && (
            <button onClick={onToggleProfile} className="p-1.5 rounded-full hover:bg-muted">
              <User className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
          <WaAiTools conversation={conversation} onSend={onSend} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
        ) : (
          messages.map((message, i, arr) => {
            const prev = arr[i - 1];
            const showDateSeparator = !prev || formatDateSeparator(message.created_at) !== formatDateSeparator(prev.created_at);
            return (
              <div key={message.id}>
                {showDateSeparator && (
                  <div className="text-center py-2">
                    <span className="text-[11px] text-muted-foreground px-2 py-1 rounded-full bg-muted/30">
                      {formatDateSeparator(message.created_at)}
                    </span>
                  </div>
                )}
                <ChatMessage message={message} conversation={conversation} />
              </div>
            );
          })
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Composer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        {tags && (
          <div className="mb-2">
            <WaContactTagBadges contactId={conversation.contact.id} assignedTagIds={assignedTagIds}
              allTags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
          </div>
        )}
        <div className="flex items-end gap-3">
          <Popover open={mediaPopoverOpen} onOpenChange={setMediaPopoverOpen}>
            <PopoverTrigger className="p-2 rounded-full text-muted-foreground hover:bg-muted">
              <Paperclip className="w-4 h-4" />
            </PopoverTrigger>
            <PopoverContent align="start" className="p-3 w-[160px] space-y-2">
              <label htmlFor="image-upload" className="flex items-center gap-2 text-sm text-foreground hover:text-primary cursor-pointer">
                <Image className="w-4 h-4" /> Enviar Imagem
              </label>
              <input type="file" id="image-upload" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'image')} />
              <label htmlFor="video-upload" className="flex items-center gap-2 text-sm text-foreground hover:text-primary cursor-pointer">
                <Square className="w-4 h-4" /> Enviar Vídeo
              </label>
              <input type="file" id="video-upload" accept="video/*" className="hidden" onChange={(e) => handleUpload(e, 'video')} />
              <StickerButton onSendSticker={handleSendSticker} onPreview={(url) => { setStickerPreviewUrl(url); setMediaPopoverOpen(false); }} />
              <AudioRecorder onSendAudio={handleSendAudio} onClose={() => setMediaPopoverOpen(false)} />
            </PopoverContent>
          </Popover>
          <div className="relative flex-1">
            <input type="text" value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Digite uma mensagem"
              className="w-full pl-3 pr-12 py-2 text-sm rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            {quickReplies && quickReplies.length > 0 && (
              <Popover>
                <PopoverTrigger className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:bg-muted rounded">
                  <ChevronDown className="w-4 h-4" />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[220px] p-2 space-y-1">
                  {quickReplies.map(qr => (
                    <button key={qr.id} onClick={() => { setText(qr.text); }} className="w-full text-left text-sm text-foreground hover:text-primary px-2 py-1 rounded hover:bg-muted">{qr.text}</button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>
          <button onClick={handleSend} disabled={sending} className="p-2 rounded-full text-muted-foreground hover:bg-muted">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <StickerPreviewDialog imageUrl={stickerPreviewUrl} onSend={handleSendSticker} onOpenChange={setStickerPreviewUrl} />
    </div>
  );
}

/* ── Chat Message ── */
function ChatMessage({ message, conversation }: { message: WaMessage; conversation: WaConversation }) {
  const isMe = message.sender === 'me';
  return (
    <div className={`flex flex-col gap-1.5 ${isMe ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMe && (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ backgroundColor: `hsl(${getAvatarColor(conversation.contact.name)})` }}>
            {conversation.contact.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className={`rounded-xl px-3 py-2 text-sm max-w-[70%] ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
          {message.text}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground">{formatTime(message.created_at)}</span>
    </div>
  );
}

/* ── Audio Recorder ── */
function AudioRecorder({ onSendAudio, onClose }: { onSendAudio: (url: string) => Promise<void>; onClose: () => void }) {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };
      audioChunks.current = [];
      mediaRecorder.current.start();
      setRecording(true);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gravar áudio');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  const sendAudio = async () => {
    if (!audioUrl) return;
    try { await onSendAudio(audioUrl); toast.success('Áudio enviado!'); }
    catch (err: any) { toast.error(err.message || 'Erro ao enviar áudio'); }
    finally { clearAudio(); onClose(); }
  };

  const clearAudio = () => {
    setAudioUrl(null);
    URL.revokeObjectURL(audioUrl || '');
  };

  return (
    <div className="space-y-2">
      {!audioUrl ? (
        <button onClick={recording ? stopRecording : startRecording} className="flex items-center gap-2 text-sm text-foreground hover:text-primary">
          <Mic className="w-4 h-4" /> {recording ? 'Parar Gravação' : 'Gravar Áudio'}
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <audio src={audioUrl} controls className="w-32" />
          <button onClick={sendAudio} className="text-sm text-foreground hover:text-primary">Enviar</button>
          <button onClick={clearAudio} className="text-sm text-muted-foreground hover:text-destructive">Cancelar</button>
        </div>
      )}
    </div>
  );
}

/* ── Sticker Button ── */
function StickerButton({ onSendSticker, onPreview }: { onSendSticker: (url: string) => Promise<void>; onPreview: (url: string) => void }) {
  const [stickers, setStickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStickers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage.from('whatsapp-stickers').list('', { limit: 24 });
        if (error) throw error;
        const urls = data.map(file => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/whatsapp-stickers/${file.name}`);
        setStickers(urls);
      } catch (err: any) {
        toast.error(err.message || 'Erro ao carregar figurinhas');
      } finally {
        setLoading(false);
      }
    };
    fetchStickers();
  }, []);

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-2 text-sm text-foreground hover:text-primary cursor-pointer">
        <Sticker className="w-4 h-4" /> Enviar Figurinha
      </PopoverTrigger>
      <PopoverContent align="start" className="p-3 w-[260px] space-y-2">
        {loading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {stickers.map(url => (
              <button key={url} onClick={() => onPreview(url)} className="aspect-square rounded-md overflow-hidden border border-transparent hover:border-primary/30">
                <img src={url} alt="Sticker" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
