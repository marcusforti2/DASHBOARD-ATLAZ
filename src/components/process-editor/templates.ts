import { ProcessTemplate } from './types';

const H = 280, V = 120, X = 100, Y = 200;

export const processTemplates: ProcessTemplate[] = [
  {
    id: 'processo-vendas-b2b', name: 'Processo de Vendas B2B', description: 'Fluxo completo de vendas B2B', category: 'Vendas',
    nodes: [
      { id: '1', type: 'processNode', position: { x: X, y: Y }, data: { type: 'inicio', label: 'Novo Lead' } },
      { id: '2', type: 'processNode', position: { x: X+H, y: Y }, data: { type: 'qualificacao', label: 'Qualificação BANT', responsavel: 'SDR' } },
      { id: '3', type: 'processNode', position: { x: X+H*2, y: Y }, data: { type: 'decisao', label: 'Qualificado?' } },
      { id: '4', type: 'processNode', position: { x: X+H*3, y: Y }, data: { type: 'reuniao', label: 'Demonstração', responsavel: 'Closer', tempoEstimado: 1, tempoUnidade: 'horas' } },
      { id: '5', type: 'processNode', position: { x: X+H*4, y: Y }, data: { type: 'proposta', label: 'Enviar Proposta' } },
      { id: '6', type: 'processNode', position: { x: X+H*5, y: Y }, data: { type: 'decisao', label: 'Fechou?' } },
      { id: '7', type: 'processNode', position: { x: X+H*6, y: Y }, data: { type: 'fim', label: 'Cliente Ganho' } },
      { id: '8', type: 'processNode', position: { x: X+H*3, y: Y+V }, data: { type: 'lead_nutrição', label: 'Nurture' } },
      { id: '9', type: 'processNode', position: { x: X+H*6, y: Y+V }, data: { type: 'fim', label: 'Perdido' } },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' }, { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '4', label: 'Sim' }, { id: 'e4', source: '3', target: '8', label: 'Não' },
      { id: 'e5', source: '4', target: '5' }, { id: 'e6', source: '5', target: '6' },
      { id: 'e7', source: '6', target: '7', label: 'Sim' }, { id: 'e8', source: '6', target: '9', label: 'Não' },
    ]
  },
  {
    id: 'onboarding-cliente', name: 'Onboarding de Cliente', description: 'Processo de integração de novo cliente', category: 'Sucesso do Cliente',
    nodes: [
      { id: '1', type: 'processNode', position: { x: X, y: Y }, data: { type: 'inicio', label: 'Contrato Assinado' } },
      { id: '2', type: 'processNode', position: { x: X+H, y: Y }, data: { type: 'email_processo', label: 'Email de Boas-vindas' } },
      { id: '3', type: 'processNode', position: { x: X+H*2, y: Y }, data: { type: 'reuniao', label: 'Kickoff Call', tempoEstimado: 1, tempoUnidade: 'horas' } },
      { id: '4', type: 'processNode', position: { x: X+H*3, y: Y }, data: { type: 'etapa', label: 'Setup da Conta', responsavel: 'CS' } },
      { id: '5', type: 'processNode', position: { x: X+H*4, y: Y }, data: { type: 'etapa', label: 'Treinamento', tempoEstimado: 3, tempoUnidade: 'dias' } },
      { id: '6', type: 'processNode', position: { x: X+H*5, y: Y }, data: { type: 'checklist', label: 'Checklist de Entrega' } },
      { id: '7', type: 'processNode', position: { x: X+H*6, y: Y }, data: { type: 'fim', label: 'Cliente Ativo' } },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' }, { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '4' }, { id: 'e4', source: '4', target: '5' },
      { id: 'e5', source: '5', target: '6' }, { id: 'e6', source: '6', target: '7' },
    ]
  },
  {
    id: 'funil-lancamento', name: 'Funil de Lançamento', description: 'Estrutura de lançamento digital completo', category: 'Marketing Digital',
    nodes: [
      { id: '1', type: 'processNode', position: { x: X, y: Y }, data: { type: 'lead_captura', label: 'Captura de Leads' } },
      { id: '2', type: 'processNode', position: { x: X+H, y: Y }, data: { type: 'sequencia_email', label: 'Sequência de Aquecimento' } },
      { id: '3', type: 'processNode', position: { x: X+H*2, y: Y }, data: { type: 'webinar', label: 'Aula/Webinar' } },
      { id: '4', type: 'processNode', position: { x: X+H*3, y: Y }, data: { type: 'pagina_vendas', label: 'Página de Vendas' } },
      { id: '5', type: 'processNode', position: { x: X+H*4, y: Y }, data: { type: 'checkout', label: 'Checkout' } },
      { id: '6', type: 'processNode', position: { x: X+H*5, y: Y }, data: { type: 'upsell', label: 'Upsell' } },
      { id: '7', type: 'processNode', position: { x: X+H*6, y: Y }, data: { type: 'pagina_obrigado', label: 'Obrigado' } },
      { id: '8', type: 'processNode', position: { x: X+H*4, y: Y+V }, data: { type: 'abandono_carrinho', label: 'Recuperação' } },
    ],
    edges: [
      { id: 'e1', source: '1', target: '2' }, { id: 'e2', source: '2', target: '3' },
      { id: 'e3', source: '3', target: '4' }, { id: 'e4', source: '4', target: '5' },
      { id: 'e5', source: '5', target: '6' }, { id: 'e6', source: '6', target: '7' },
      { id: 'e7', source: '5', target: '8' },
    ]
  },
];

export const getTemplatesByCategory = () => {
  const map: Record<string, ProcessTemplate[]> = {};
  processTemplates.forEach(t => {
    if (!map[t.category]) map[t.category] = [];
    map[t.category].push(t);
  });
  return map;
};
