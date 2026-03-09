import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Send, Loader2, Image, Mic, Square, Paperclip } from 'lucide-react';
import { WaConversation } from '@/hooks/use-wa-hub';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface Props {
  conversation: WaConversation;
  onBack: () => void;
  onSend: (text: string) => Promise<void>;
  onSendMedia?: (mediaType: string, mediaUrl: string, caption?: string) => Promise<void>;
  onSendAudio?: (audioUrl: string) => Promise<void>;
  tags?: WaTag[];
  assignedTagIds?: string[];
  onAddTag?: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag?: (contactId: string, tagId: string) => Promise<void>;
}

function MediaBubble({ mediaType, mediaUrl, mediaMime, text }: { mediaType: string; mediaUrl: string | null; mediaMime: string | null; text: string }) {
  if (!mediaUrl) {
    return <p className="italic text-xs opacity-70">{text}</p>;
  }

  switch (mediaType) {
    case 'image':
      return (
        <div className="space-y-1">
          <img
            src={mediaUrl}
            alt="imagem"
            className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer"
            onClick={() => window.open(mediaUrl, '_blank')}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
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
      return (
        <audio src={mediaUrl} controls className="max-w-full min-w-[200px]" preload="metadata" />
      );
    case 'sticker':
      return (
        <img
          src={mediaUrl}
          alt="sticker"
          className="w-32 h-32 object-contain"
          onError={(e) => { (e.target as HTMLImageElement).alt = '🎨 Sticker'; }}
        />
      );
    case 'document':
      return (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs underline">
          <Paperclip className="w-3 h-3" />
          {text || 'Documento'}
        </a>
      );
    default:
      return <p>{text}</p>;
  }
}

/** Get a supported audio MIME type for MediaRecorder */
function getSupportedAudioMime(): string {
  const mimes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mime of mimes) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ''; // fallback — browser will choose
}

export function WaChatView({ conversation, onBack, onSend, onSendMedia, onSendAudio, tags, assignedTagIds, onAddTag, onRemoveTag }: Props) {
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages.length]);

  const handleSend = async () => {
    if (!msgText.trim()) return;
    try {
      setSending(true);
      await onSend(msgText.trim());
      setMsgText('');
    } catch {
      // error handled by parent
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendMedia) return;

    // Validate file size (max 16MB for WhatsApp)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 16MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setUploadingMedia(true);
      const ext = file.name.split('.').pop() || 'bin';
      const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('wa-media')
        .upload(filePath, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('wa-media')
        .getPublicUrl(filePath);

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const mediaType = isImage ? 'image' : isVideo ? 'video' : 'document';

      await onSendMedia(mediaType, publicUrl, '');
      toast.success('Mídia enviada!');
    } catch (err) {
      console.error('Error uploading media:', err);
      toast.error('Erro ao enviar mídia. Tente novamente.');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMime();
      const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setRecordingTime(0);

        if (!onSendAudio || audioChunksRef.current.length === 0) return;

        try {
          setSending(true);
          const actualMime = mediaRecorder.mimeType || 'audio/webm';
          const ext = actualMime.includes('ogg') ? 'ogg' : actualMime.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(audioChunksRef.current, { type: actualMime });
          const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('wa-media')
            .upload(filePath, blob, { contentType: actualMime, upsert: false });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('wa-media')
            .getPublicUrl(filePath);

          await onSendAudio(publicUrl);
          toast.success('Áudio enviado!');
        } catch (err) {
          console.error('Error sending audio:', err);
          toast.error('Erro ao enviar áudio. Tente novamente.');
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast.error('Permissão do microfone negada. Habilite nas configurações do navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-border bg-card shrink-0">
        <button onClick={onBack} className="lg:hidden p-1 rounded text-muted-foreground hover:bg-muted">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: `hsl(${getAvatarColor(conversation.contact.name)})` }}
        >
          {conversation.contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{conversation.contact.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">{conversation.contact.phone}</p>
            {tags && assignedTagIds && onAddTag && onRemoveTag && (
              <WaContactTagBadges
                contactId={conversation.contact.id}
                assignedTagIds={assignedTagIds}
                allTags={tags}
                onAdd={onAddTag}
                onRemove={onRemoveTag}
              />
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {conversation.messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.sender === 'agent'
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted text-foreground rounded-bl-md'
            }`}>
              {msg.media_type && msg.media_type !== 'location' && msg.media_type !== 'contact' ? (
                <MediaBubble
                  mediaType={msg.media_type}
                  mediaUrl={msg.media_url}
                  mediaMime={msg.media_mime_type}
                  text={msg.text}
                />
              ) : (
                <p>{msg.text}</p>
              )}
              <p className={`text-[9px] mt-1 ${msg.sender === 'agent' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border bg-card shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex items-center gap-2">
          {/* Attach media */}
          {onSendMedia && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia || sending || recording}
              className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              title="Enviar foto/vídeo/documento"
            >
              {uploadingMedia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            </button>
          )}

          {/* Audio record */}
          {onSendAudio && (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={sending || uploadingMedia}
              className={`p-2.5 rounded-xl transition-colors ${
                recording
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'text-muted-foreground hover:bg-muted'
              } disabled:opacity-50`}
              title={recording ? 'Parar gravação' : 'Gravar áudio'}
            >
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {recording ? (
            <div className="flex-1 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-destructive font-medium">
                Gravando {formatRecordingTime(recordingTime)}
              </span>
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
            <button
              onClick={handleSend}
              disabled={sending || !msgText.trim() || uploadingMedia}
              className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
