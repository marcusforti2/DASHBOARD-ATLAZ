import { Node, Edge } from '@xyflow/react';

export type ProcessNodeType = 
  | 'inicio' | 'fim' | 'decisao' | 'paralelo' | 'conector' | 'loop' | 'condicional'
  | 'etapa' | 'tarefa_manual' | 'tarefa_automatica' | 'aprovacao' | 'espera' | 'revisao' | 'validacao' | 'verificacao' | 'qualificacao' | 'priorizacao'
  | 'notificacao' | 'email_processo' | 'whatsapp_processo' | 'formulario' | 'reuniao' | 'ligacao' | 'sms' | 'direct' | 'telegram' | 'push_notification' | 'chatbot' | 'voicebot'
  | 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'pinterest' | 'threads' | 'kwai'
  | 'lead_captura' | 'lead_qualificacao' | 'lead_nutrição' | 'landing_page' | 'pagina_vendas' | 'pagina_obrigado' | 'checkout' | 'upsell' | 'downsell' | 'order_bump' | 'remarketing' | 'abandono_carrinho' | 'webinar' | 'lancamento' | 'sequencia_email'
  | 'sistema' | 'documento' | 'assinatura' | 'api' | 'banco_dados' | 'webhook' | 'crm_integracao' | 'erp' | 'zapier' | 'n8n' | 'make'
  | 'automacao' | 'trigger' | 'acao_automatica' | 'condicao_automacao' | 'delay' | 'split_ab' | 'tag_lead' | 'score_lead' | 'mover_pipeline'
  | 'nota' | 'sla' | 'responsavel_node' | 'checklist' | 'anexo' | 'contrato' | 'proposta'
  | 'pagamento' | 'faturamento' | 'orcamento' | 'cobranca' | 'reembolso' | 'comissao'
  | 'cliente' | 'fornecedor' | 'equipe' | 'lead' | 'prospect' | 'afiliado' | 'influencer'
  | 'metrica' | 'relatorio' | 'dashboard' | 'pixel' | 'utm' | 'analytics';

export type ProcessStatus = 'ativo' | 'inativo' | 'em_revisao';
export type TempoUnidade = 'minutos' | 'horas' | 'dias';
export type NodeCategory = 'fluxo' | 'operacional' | 'comunicacao' | 'integracao' | 'documentacao' | 'financeiro' | 'pessoas' | 'redes_sociais' | 'funil' | 'automacao' | 'analise';
export type EdgeColor = 'default' | 'red' | 'yellow' | 'blue' | 'green' | 'purple' | 'orange' | 'black';
export type NodeColor = 'default' | 'red' | 'yellow' | 'blue' | 'green' | 'purple' | 'orange';

export interface ProcessNodeData {
  type: ProcessNodeType;
  label: string;
  descricao?: string;
  responsavel?: string;
  departamento?: string;
  tempoEstimado?: number;
  tempoUnidade?: TempoUnidade;
  sla?: number;
  status?: ProcessStatus;
  condicao?: string;
  sistemaNome?: string;
  integracao?: string;
  notas?: string;
  cor?: NodeColor;
  link?: string;
  conversao?: number;
  valor?: number;
  [key: string]: unknown;
}

export interface ProcessTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: Node<ProcessNodeData>[];
  edges: Edge[];
}

export interface NodeTypeConfig {
  type: ProcessNodeType;
  label: string;
  category: NodeCategory;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultData: Partial<ProcessNodeData>;
  editableFields: string[];
}
