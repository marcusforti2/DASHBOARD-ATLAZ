import { useState } from 'react';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { WaConversation } from '@/hooks/use-wa-hub';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';

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
}

export function WaChatView({ conversation, onBack, onSend }: Props) {
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!msgText.trim()) return;
    try {
      setSending(true);
      await onSend(msgText.trim());
      setMsgText('');
    } finally {
      setSending(false);
    }
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
        <div>
          <p className="text-sm font-semibold text-foreground">{conversation.contact.name}</p>
          <p className="text-[10px] text-muted-foreground">{conversation.contact.phone}</p>
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
              <p>{msg.text}</p>
              <p className={`text-[9px] mt-1 ${msg.sender === 'agent' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                {formatTime(msg.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Digite uma mensagem..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleSend}
            disabled={sending || !msgText.trim()}
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
