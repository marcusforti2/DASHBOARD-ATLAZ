import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, QrCode, RefreshCw, PowerOff, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  connectInstance,
  getInstanceStatus,
  disconnectInstance,
  restartInstance,
  QrCodeResponse,
} from '@/lib/evolutionApi';

interface Props {
  instanceName: string;
  closerName: string;
  instanceId?: string;
}

export function WaInstancePanel({ instanceName, closerName, instanceId }: Props) {
  const [state, setState] = useState<string>('unknown');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrData, setQrData] = useState<QrCodeResponse | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInstanceStatus(instanceName);
      const newState = data?.state ?? 'unknown';
      setState(newState);
      
      // Sync is_connected to database so dashboard/AI tabs stay accurate
      if (instanceId) {
        const isConn = newState === 'open';
        await supabase.from('wa_instances').update({ is_connected: isConn } as any).eq('id', instanceId);
      }
    } catch {
      setState('unknown');
      if (instanceId) {
        await supabase.from('wa_instances').update({ is_connected: false } as any).eq('id', instanceId);
      }
    } finally {
      setLoading(false);
    }
  }, [instanceName, instanceId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const isConnected = state === 'open';

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      const qr = await connectInstance(instanceName);
      setQrData(qr);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao obter QR Code');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setActionLoading(true);
      await disconnectInstance(instanceName);
      toast.success('Desconectado');
      await fetchStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    try {
      setActionLoading(true);
      await restartInstance(instanceName);
      toast.success('Reiniciado');
      await fetchStatus();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reiniciar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary/50 border border-border rounded-lg">
        {loading ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : isConnected ? (
          <Wifi className="w-4 h-4 text-primary" />
        ) : (
          <WifiOff className="w-4 h-4 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-foreground">{instanceName}</span>
          <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            isConnected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            {isConnected ? 'Conectado' : state === 'unknown' ? '...' : 'Desconectado'}
          </span>
        </div>

        {actionLoading ? (
          <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
        ) : (
          <div className="flex items-center gap-1">
            {!isConnected && (
              <button onClick={handleConnect} title="Conectar (QR)" className="p-1 rounded text-primary hover:bg-primary/10 transition-colors">
                <QrCode className="w-3.5 h-3.5" />
              </button>
            )}
            {isConnected && (
              <button onClick={handleDisconnect} title="Desconectar" className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
                <PowerOff className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handleRestart} title="Reiniciar" className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button onClick={fetchStatus} title="Atualizar status" className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {qrData && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Escanear QR Code</h3>
                <p className="text-xs text-muted-foreground">{instanceName} — {closerName}</p>
              </div>
              <button onClick={() => setQrData(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              {qrData.base64 ? (
                <img src={qrData.base64} alt="QR Code WhatsApp" className="w-64 h-64 rounded-lg border border-border" />
              ) : qrData.code || qrData.pairingCode ? (
                <div className="w-64 h-64 rounded-lg border border-border flex items-center justify-center bg-secondary">
                  <p className="text-xs text-muted-foreground text-center px-4">
                    Código de pareamento: <br />
                    <span className="font-mono font-bold text-foreground text-lg mt-2 block">{qrData.pairingCode ?? qrData.code}</span>
                  </p>
                </div>
              ) : (
                <div className="w-64 h-64 rounded-lg border border-border flex items-center justify-center bg-secondary">
                  <p className="text-xs text-muted-foreground">Já conectado ou QR expirado</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={handleConnect} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors">
                  <RefreshCw className="w-3 h-3" /> Novo QR
                </button>
                <button onClick={() => { setQrData(null); fetchStatus(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                  Já escaneei
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
