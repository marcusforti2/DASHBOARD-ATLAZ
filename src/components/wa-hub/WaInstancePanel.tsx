import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, QrCode, RefreshCw, PowerOff, Loader2, X, CheckCircle2, Smartphone } from 'lucide-react';
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
  const [showModal, setShowModal] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(0);
  const [justConnected, setJustConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getInstanceStatus(instanceName);
      const newState = data?.state ?? 'unknown';
      setState(newState);

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

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const isConnected = state === 'open';

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await getInstanceStatus(instanceName);
        const newState = data?.state ?? 'unknown';
        if (newState === 'open') {
          setState('open');
          setJustConnected(true);
          setQrData(null);
          if (pollRef.current) clearInterval(pollRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (instanceId) {
            await supabase.from('wa_instances').update({ is_connected: true } as any).eq('id', instanceId);
          }
          toast.success('WhatsApp conectado! ✅');
          // Auto-close modal after 2s
          setTimeout(() => {
            setShowModal(false);
            setJustConnected(false);
          }, 2500);
        }
      } catch { /* ignore */ }
    }, 4000);
  }, [instanceName, instanceId]);

  const startCountdown = useCallback(() => {
    setQrCountdown(45);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setQrCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      setJustConnected(false);
      const qr = await connectInstance(instanceName);
      setQrData(qr);
      setShowModal(true);
      startPolling();
      startCountdown();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao obter QR Code');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshQr = async () => {
    try {
      setActionLoading(true);
      const qr = await connectInstance(instanceName);
      setQrData(qr);
      startCountdown();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar novo QR');
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

  const closeModal = () => {
    setShowModal(false);
    setQrData(null);
    setJustConnected(false);
    if (pollRef.current) clearInterval(pollRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    fetchStatus();
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

      {/* QR Code Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${justConnected ? 'bg-primary/15' : 'bg-secondary'}`}>
                  {justConnected ? (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  ) : (
                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {justConnected ? 'Conectado!' : 'Conectar WhatsApp'}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">{instanceName} — {closerName}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success State */}
            {justConnected ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-scale-in">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">WhatsApp conectado com sucesso!</p>
                  <p className="text-xs text-muted-foreground mt-1">A instância está pronta para uso.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Instructions */}
                <div className="flex gap-2 p-3 rounded-lg bg-muted/50 mb-4">
                  <QrCode className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-[11px] text-muted-foreground leading-relaxed space-y-1">
                    <p><strong>1.</strong> Abra o WhatsApp no celular</p>
                    <p><strong>2.</strong> Toque em <strong>Configurações → Aparelhos conectados</strong></p>
                    <p><strong>3.</strong> Toque em <strong>Conectar aparelho</strong></p>
                    <p><strong>4.</strong> Escaneie o QR Code abaixo</p>
                  </div>
                </div>

                {/* QR Code Area */}
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    {qrData?.base64 ? (
                      <>
                        <img
                          src={qrData.base64}
                          alt="QR Code WhatsApp"
                          className={`w-64 h-64 rounded-xl border-2 border-border transition-opacity ${qrCountdown === 0 ? 'opacity-30' : ''}`}
                        />
                        {qrCountdown === 0 && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <p className="text-xs font-semibold text-foreground mb-2">QR Code expirado</p>
                            <button
                              onClick={handleRefreshQr}
                              disabled={actionLoading}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                            >
                              {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Gerar novo
                            </button>
                          </div>
                        )}
                      </>
                    ) : qrData?.pairingCode || qrData?.code ? (
                      <div className="w-64 h-64 rounded-xl border-2 border-border flex items-center justify-center bg-secondary">
                        <div className="text-center px-4">
                          <p className="text-[11px] text-muted-foreground mb-2">Código de pareamento:</p>
                          <span className="font-mono font-bold text-foreground text-2xl tracking-wider">
                            {qrData.pairingCode ?? qrData.code}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-64 h-64 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-secondary">
                        <div className="text-center">
                          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">Gerando QR Code...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status bar */}
                  <div className="flex items-center justify-between w-full max-w-[256px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-[11px] text-muted-foreground">Aguardando leitura...</span>
                    </div>
                    {qrCountdown > 0 && (
                      <span className={`text-[11px] font-mono font-medium ${qrCountdown <= 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {qrCountdown}s
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 w-full max-w-[256px]">
                    <button
                      onClick={handleRefreshQr}
                      disabled={actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
                    >
                      {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Novo QR
                    </button>
                    <button
                      onClick={() => { fetchStatus(); }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle2 className="w-3 h-3" /> Já escaneei
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
