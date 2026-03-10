import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Loader2, Image, Mic, Square, Paperclip, Zap, Sparkles, ChevronDown, User, Sticker, Workflow } from 'lucide-react';
import { WaConversation, WaMessage, useQuickReplies } from '@/hooks/use-wa-hub';
import { WaAiTools } from './WaAiTools';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import StickerPreviewDialog from './StickerPreviewDialog';

const AVATAR_COLORS = ['152 60% 36%', '210 90% 50%', '280 65% 50%', '30 90% 50%', '0 72% 51%', '180 60% 40%'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface Props {
  conversation: WaConversation;
  messages: WaMessage[];
  messagesLoading?: boolean;
  onBack: () => void;
  onSend: (text: string) => Promise<void>;
  onSendMedia?: (mediaType: string, mediaUrl: string, caption?: string) => Promise<void>;
  onSendAudio?: (audioUrl: string) => Promise<void>;
  onSendSticker?: (imageUrl: string) => Promise<void>;
  tags?: WaTag[];
  assignedTagIds?: string[];
  onAddTag?: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag?: (contactId: string, tagId: string) => Promise<void>;
  onToggleProfile?: () => void;
  showProfileButton?: boolean;
}

function AudioBubble({ mediaUrl }: { mediaUrl: string }) {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleOpenExternal = () => {
    window.open(mediaUrl, '_blank');
  };

  const handleTranscribe = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: {
          messages: [{
            role: 'user',
            content: `Transcreva este áudio de WhatsApp. A URL do áudio é: ${mediaUrl}\n\nSe não conseguir acessar o áudio, responda: "Transcrição indisponível para este formato de áudio."\n\nTranscrição:`
          }],
        },
      });
      if (error) throw error;
      setTranscription(data?.content || data?.message || 'Transcrição indisponível');
    } catch {
      setTranscription('Erro ao transcrever');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-1.5">
      {!audioError ? (
        <audio
          ref={audioRef}
          src={mediaUrl}
          controls
          className="max-w-full min-w-[220px] h-10"
          preload="auto"
          onError={() => setAudioError(true)}
        />
      ) : (
        <button
          onClick={handleOpenExternal}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 text-xs text-foreground hover:bg-background transition-colors"
        >
          <Mic className="w-3.5 h-3.5" /> Ouvir áudio ↗
        </button>
      )}
      {transcription ? (
        <p className="text-[10px] italic text-muted-foreground bg-background/50 rounded px-2 py-1">📝 {transcription}</p>
      ) : (
        <button onClick={handleTranscribe} disabled={loading} className="text-[9px] text-muted-foreground hover:text-foreground flex items-center gap-1 disabled:opacity-50">
          {loading ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />} Transcrever
        </button>
      )}
    </div>
  );
}

function MediaBubble({ mediaType, mediaUrl, mediaMime, text }: { mediaType: string; mediaUrl: string | null; mediaMime: string | null; text: string }) {
  if (!mediaUrl) return <p className="italic text-xs opacity-70">{text}</p>;

  switch (mediaType) {
    case 'image':
      return (
        <div className="space-y-1">
          <img src={mediaUrl} alt="imagem" className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          {text && !text.startsWith('📷') && <p className="text-sm">{text}</p>}
        </div>
      );
    case 'video':
      return (
        <div className="space-y-1">
          <video src={mediaUrl} controls className="rounded-lg max-w-full max-h-60" />
          {text && !text.startsWith('🎥') && <p className="text-sm">{text}</p>}
        </div>
      );
    case 'audio':
      return <AudioBubble mediaUrl={mediaUrl} />;
    case 'sticker':
      return <img src={mediaUrl} alt="sticker" className="w-32 h-32 object-contain" />;
    case 'document':
      return (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs underline">
          <Paperclip className="w-3 h-3" />{text || 'Documento'}
        </a>
      );
    default: return <p>{text}</p>;
  }
}

function getSupportedAudioMime(): string {
  const mimes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const mime of mimes) { if (MediaRecorder.isTypeSupported(mime)) return mime; }
  return '';
}

export default function WaChatView({ conversation, messages, messagesLoading, onBack, onSend, onSendMedia, onSendAudio, onSendSticker, tags, assignedTagIds, onAddTag, onRemoveTag, onToggleProfile, showProfileButton }: Props) {
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [stickerMode, setStickerMode] = useState<string | null>(null);
  const [stickerCreateMode, setStickerCreateMode] = useState(false);
  const [stickerFile, setStickerFile] = useState<File | null>(null);
  const [stickerDialogOpen, setStickerDialogOpen] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stickerInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { replies } = useQuickReplies();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    if (!msgText.trim()) return;
    const text = msgText.trim();
    setMsgText('');
    try {
      setSending(true);
      await onSend(text);
    } catch { /* error handled by parent */ } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setMsgText(text);
    setShowQuickReplies(false);
  };

  const handleAiSuggest = async () => {
    if (messages.length === 0) { toast.info('Sem mensagens para analisar'); return; }
    try {
      setAiSuggesting(true);
      const lastMessages = messages.slice(-10).map(m => `${m.sender === 'agent' ? 'Agente' : 'Contato'}: ${m.text}`).join('\n');

      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: {
          messages: [{ role: 'user', content: `Analise esta conversa de WhatsApp comercial e sugira a MELHOR resposta que o agente deveria enviar agora. Seja direto e natural, como uma mensagem real de WhatsApp. Máximo 2 frases.\n\nConversa recente:\n${lastMessages}\n\nContato: ${conversation.contact.name}\n\nSugira a resposta ideal:` }],
        },
      });

      if (error) throw error;
      const suggestion = data?.content || data?.message || '';
      if (suggestion) {
        setMsgText(suggestion);
        toast.success('Sugestão de IA aplicada!');
      }
    } catch (err) {
      console.error('AI suggest error:', err);
      toast.error('Erro ao gerar sugestão');
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendMedia) return;
    if (file.size > 16 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 16MB.'); if (fileInputRef.current) fileInputRef.current.value = ''; return; }

    try {
      setUploadingMedia(true);
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('wa-media').upload(filePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('wa-media').getPublicUrl(filePath);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const mediaType = isImage ? 'image' : isVideo ? 'video' : 'document';
      await onSendMedia(mediaType, publicUrl, '');
      toast.success('Mídia enviada!');
    } catch (err) { console.error('Error uploading media:', err); toast.error('Erro ao enviar mídia.'); } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStickerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo 5MB.'); if (stickerInputRef.current) stickerInputRef.current.value = ''; return; }
    setStickerFile(file);
    setStickerDialogOpen(true);
    if (stickerInputRef.current) stickerInputRef.current.value = '';
  };

  const handleStickerSend = async (imageUrl: string) => {
    if (!onSendSticker) return;
    await onSendSticker(imageUrl);
    toast.success('Figurinha enviada! 🎨');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMime();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        setRecordingTime(0);
        if (!onSendAudio || audioChunksRef.current.length === 0) return;
        try {
          setSending(true);
          const actualMime = mediaRecorder.mimeType || 'audio/webm';
          const ext = actualMime.includes('ogg') ? 'ogg' : actualMime.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(audioChunksRef.current, { type: actualMime });
          const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
          const { error: uploadError } = await supabase.storage.from('wa-media').upload(filePath, blob, { contentType: actualMime, upsert: false });
          if (uploadError) throw uploadError;
          const { data: { publicUrl } } = supabase.storage.from('wa-media').getPublicUrl(filePath);
          await onSendAudio(publicUrl);
          toast.success('Áudio enviado!');
        } catch (err) { console.error('Error sending audio:', err); toast.error('Erro ao enviar áudio.'); } finally { setSending(false); }
      };

      mediaRecorder.start(250);
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) { console.error('Mic access denied:', err); toast.error('Permissão do microfone negada.'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const formatRecordingTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Group messages by date
  const groupedMessages: { date: string; msgs: WaMessage[] }[] = [];
  messages.forEach(msg => {
    const dateKey = new Date(msg.created_at).toDateString();
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === dateKey) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date: dateKey, msgs: [msg] });
    }
  });

  return (
    <div className="flex-1 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-border bg-card shrink-0">
        <button onClick={onBack} className="lg:hidden p-1 rounded text-muted-foreground hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: `hsl(${getAvatarColor(conversation.contact.name)})` }}>
          {conversation.contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{conversation.contact.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">{conversation.contact.phone}</p>
            {tags && assignedTagIds && onAddTag && onRemoveTag && (
              <WaContactTagBadges contactId={conversation.contact.id} assignedTagIds={assignedTagIds} allTags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
            )}
        </div>
        {showProfileButton && onToggleProfile && (
          <button onClick={onToggleProfile} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Perfil do lead">
            <User className="w-4 h-4" />
          </button>
        )}
      </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-1">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : (
          groupedMessages.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="text-[10px] bg-muted text-muted-foreground px-3 py-1 rounded-full font-medium">
                  {formatDateSeparator(group.msgs[0].created_at)}
                </span>
              </div>
              <div className="space-y-2">
                {group.msgs.map(msg => {
                  const isSticker = msg.media_type === 'sticker';
                  return (
                    <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'} animate-msg-in`}>
                      {isSticker ? (
                        <div className="max-w-[70%]">
                          {msg.media_url ? (
                            <img src={msg.media_url} alt="sticker" className="w-36 h-36 object-contain drop-shadow-md" />
                          ) : (
                            <p className="text-sm italic opacity-70">🎨 Sticker</p>
                          )}
                          <p className="text-[9px] mt-0.5 text-muted-foreground text-right">
                            {formatTime(msg.created_at)}
                            {msg.id.startsWith('optimistic') && ' · enviando...'}
                          </p>
                        </div>
                      ) : (
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                          msg.sender === 'agent'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted text-foreground rounded-bl-md'
                        }`}>
                          {msg.media_type && msg.media_type !== 'location' && msg.media_type !== 'contact' ? (
                            <MediaBubble mediaType={msg.media_type} mediaUrl={msg.media_url} mediaMime={msg.media_mime_type} text={msg.text} />
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                          )}
                          <p className={`text-[9px] mt-1 ${msg.sender === 'agent' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {formatTime(msg.created_at)}
                            {msg.id.startsWith('optimistic') && ' · enviando...'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies bar */}
      {showQuickReplies && (
        <div className="px-5 py-2 border-t border-border bg-secondary/50 animate-fade-in">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {replies.map(r => (
              <button
                key={r.id}
                onClick={() => handleQuickReply(r.text)}
                className="shrink-0 text-[10px] px-3 py-1.5 rounded-full bg-card border border-border text-foreground hover:bg-accent transition-colors font-medium"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI Tools */}
      <div className="px-5 py-2 border-t border-border bg-card/50 shrink-0">
        <WaAiTools messages={messages} contactName={conversation.contact.name} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border bg-card shrink-0">
        <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleFileSelect} />
        <input ref={stickerInputRef} type="file" accept="image/*,.webp" className="hidden" onChange={handleStickerSelect} />
        <div className="flex items-center gap-2">
          {/* Quick replies toggle */}
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className={`p-2.5 rounded-xl transition-colors ${showQuickReplies ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            title="Respostas rápidas"
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* AI suggest */}
          <button
            onClick={handleAiSuggest}
            disabled={aiSuggesting || sending || recording}
            className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Sugestão de IA"
          >
            {aiSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          </button>

          {/* Attach media */}
          {onSendMedia && (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia || sending || recording} className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50" title="Enviar foto/vídeo/documento">
              {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            </button>
          )}

          {/* Sticker */}
          {onSendSticker && (
            <button
              onClick={() => stickerInputRef.current?.click()}
              disabled={uploadingMedia || sending || recording}
              className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Figurinha"
            >
              <Sticker className="w-4 h-4" />
            </button>
          )}

          <StickerPreviewDialog
            open={stickerDialogOpen}
            onClose={() => { setStickerDialogOpen(false); setStickerFile(null); }}
            imageFile={stickerFile}
            onSend={handleStickerSend}
          />

          {/* Audio record */}
          {onSendAudio && (
            <button onClick={recording ? stopRecording : startRecording} disabled={sending || uploadingMedia} className={`p-2.5 rounded-xl transition-colors ${recording ? 'bg-destructive text-destructive-foreground animate-pulse' : 'text-muted-foreground hover:bg-muted'} disabled:opacity-50`} title={recording ? 'Parar gravação' : 'Gravar áudio'}>
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {recording ? (
            <div className="flex-1 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-destructive font-medium">Gravando {formatRecordingTime(recordingTime)}</span>
            </div>
          ) : (
            <input
              type="text"
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Digite uma mensagem..."
              disabled={uploadingMedia}
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          )}

          {!recording && (
            <button onClick={handleSend} disabled={sending || !msgText.trim() || uploadingMedia} className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
