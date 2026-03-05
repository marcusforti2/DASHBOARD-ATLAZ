export type QuestionType = 'multiple-choice' | 'open-text' | 'scale' | 'yes-no';

export interface QuestionOption {
  label: string;
  value: string;
}

export interface Question {
  id: number;
  block: number;
  blockTitle: string;
  blockSubtitle: string;
  text: string;
  hint?: string;
  type: QuestionType;
  options?: QuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  placeholder?: string;
  reversed?: boolean;
}

export interface TestAnswer {
  questionId: number;
  value: string;
}

const BLOCK_TITLES = [
  { title: 'Dominância (D)', subtitle: 'Condução e decisão em vendas' },
  { title: 'Influência (I)', subtitle: 'Comunicação e conexão com o lead' },
  { title: 'Estabilidade (S)', subtitle: 'Controle emocional em negociação' },
  { title: 'Conformidade (C)', subtitle: 'Método e estrutura comercial' },
  { title: 'Papel do Closer', subtitle: 'Visão sobre a função e o processo' },
  { title: 'Diagnóstico do Cliente', subtitle: 'Capacidade de investigação e escuta' },
  { title: 'Construção de Valor', subtitle: 'Como você conecta problema e solução' },
  { title: 'Condução da Decisão', subtitle: 'Postura no momento de fechar' },
];

function b(block: number) {
  return { block, blockTitle: BLOCK_TITLES[block - 1].title, blockSubtitle: BLOCK_TITLES[block - 1].subtitle };
}

function mc(opts: string[]): { type: QuestionType; options: QuestionOption[] } {
  return {
    type: 'multiple-choice',
    options: opts.map((o, i) => ({ label: o, value: String.fromCharCode(65 + i) })),
  };
}

const ot = { type: 'open-text' as QuestionType, placeholder: 'Escreva sua resposta com honestidade...', hint: 'Responda com suas próprias palavras. Não existe resposta certa — quanto mais sincero, melhor.' };

function scale15() {
  return { type: 'scale' as QuestionType, scaleMin: 1, scaleMax: 5, scaleMinLabel: 'Não me identifico', scaleMaxLabel: 'Me identifico muito' };
}

function scale(min: number, max: number, minL: string, maxL: string) {
  return { type: 'scale' as QuestionType, scaleMin: min, scaleMax: max, scaleMinLabel: minL, scaleMaxLabel: maxL };
}

export const questions: Question[] = [
  // ===== BLOCO 1 — DOMINÂNCIA (D) — condução e decisão (10) =====
  { id: 1, ...b(1), text: 'Durante uma reunião de vendas, me sinto confortável conduzindo o rumo da conversa.', ...scale15() },
  { id: 2, ...b(1), text: 'Quando percebo que o cliente está desviando do foco, consigo trazer a conversa de volta ao objetivo.', ...scale15() },
  { id: 3, ...b(1), text: 'Não tenho dificuldade em fazer perguntas diretas quando preciso de clareza.', ...scale15() },
  { id: 4, ...b(1), text: 'Quando percebo hesitação no cliente, procuro entender rapidamente o que está travando a decisão.', ...scale15() },
  { id: 5, ...b(1), text: 'Me sinto confortável conduzindo conversas que envolvem decisões importantes.', ...scale15() },
  { id: 6, ...b(1), text: 'Consigo manter firmeza mesmo quando o cliente tenta controlar o ritmo da reunião.', ...scale15() },
  { id: 7, ...b(1), text: 'Quando percebo uma oportunidade de fechamento, conduzo a conversa para avançar.', ...scale15() },
  { id: 8, ...b(1), text: 'Prefiro conversas com direção clara a reuniões que terminam sem decisão.', ...scale15() },
  { id: 9, ...b(1), text: 'Tenho facilidade em assumir a liderança da conversa quando necessário.', ...scale15() },
  { id: 10, ...b(1), text: 'Prefiro evitar momentos de tensão em uma reunião de vendas.', ...scale15(), reversed: true },

  // ===== BLOCO 2 — INFLUÊNCIA (I) — comunicação e conexão (10) =====
  { id: 11, ...b(2), text: 'Tenho facilidade em criar conexão com pessoas que acabei de conhecer.', ...scale15() },
  { id: 12, ...b(2), text: 'Consigo adaptar minha comunicação dependendo do perfil do cliente.', ...scale15() },
  { id: 13, ...b(2), text: 'Tenho facilidade em manter uma conversa envolvente durante uma reunião.', ...scale15() },
  { id: 14, ...b(2), text: 'Consigo perceber quando o cliente está mais interessado ou mais distante na conversa.', ...scale15() },
  { id: 15, ...b(2), text: 'Consigo explicar ideias complexas de forma simples.', ...scale15() },
  { id: 16, ...b(2), text: 'Tenho facilidade em deixar o cliente confortável para falar abertamente.', ...scale15() },
  { id: 17, ...b(2), text: 'Durante uma reunião, consigo manter o cliente engajado na conversa.', ...scale15() },
  { id: 18, ...b(2), text: 'Consigo transmitir segurança quando apresento uma solução.', ...scale15() },
  { id: 19, ...b(2), text: 'Tenho facilidade em gerar empatia com diferentes tipos de pessoas.', ...scale15() },
  { id: 20, ...b(2), text: 'Normalmente prefiro deixar o cliente conduzir toda a conversa.', ...scale15(), reversed: true },

  // ===== BLOCO 3 — ESTABILIDADE (S) — controle emocional (10) =====
  { id: 21, ...b(3), text: 'Consigo manter calma mesmo quando a reunião se torna difícil.', ...scale15() },
  { id: 22, ...b(3), text: 'Não deixo pressão por resultado afetar minha clareza durante a conversa.', ...scale15() },
  { id: 23, ...b(3), text: 'Consigo lidar bem com clientes indecisos.', ...scale15() },
  { id: 24, ...b(3), text: 'Mesmo quando o cliente discorda de mim, consigo manter postura profissional.', ...scale15() },
  { id: 25, ...b(3), text: 'Consigo manter controle emocional durante negociações mais complexas.', ...scale15() },
  { id: 26, ...b(3), text: 'Não me desestabilizo facilmente durante uma reunião.', ...scale15() },
  { id: 27, ...b(3), text: 'Tenho paciência para conduzir conversas que exigem mais tempo.', ...scale15() },
  { id: 28, ...b(3), text: 'Não deixo frustrações de uma reunião afetarem a próxima.', ...scale15() },
  { id: 29, ...b(3), text: 'Consigo manter consistência no meu desempenho ao longo do tempo.', ...scale15() },
  { id: 30, ...b(3), text: 'Quando uma reunião começa a ficar difícil, prefiro encerrar rapidamente.', ...scale15(), reversed: true },

  // ===== BLOCO 4 — CONFORMIDADE (C) — método e estrutura (10) =====
  { id: 31, ...b(4), text: 'Procuro seguir uma estrutura clara durante reuniões de vendas.', ...scale15() },
  { id: 32, ...b(4), text: 'Antes de apresentar uma solução, procuro entender profundamente o problema do cliente.', ...scale15() },
  { id: 33, ...b(4), text: 'Tenho disciplina para seguir as etapas do processo comercial.', ...scale15() },
  { id: 34, ...b(4), text: 'Presto atenção em detalhes importantes durante conversas com clientes.', ...scale15() },
  { id: 35, ...b(4), text: 'Procuro organizar mentalmente as informações que o cliente compartilha.', ...scale15() },
  { id: 36, ...b(4), text: 'Busco melhorar minha performance analisando reuniões anteriores.', ...scale15() },
  { id: 37, ...b(4), text: 'Gosto de trabalhar com métodos estruturados de venda.', ...scale15() },
  { id: 38, ...b(4), text: 'Procuro registrar informações importantes obtidas durante reuniões.', ...scale15() },
  { id: 39, ...b(4), text: 'Busco melhorar continuamente minha abordagem de vendas.', ...scale15() },
  { id: 40, ...b(4), text: 'Prefiro conduzir reuniões de forma totalmente improvisada.', ...scale15(), reversed: true },

  // ===== BLOCO 5 — PAPEL DO CLOSER (10) =====
  { id: 41, ...b(5), text: 'Na sua visão, qual é o verdadeiro papel de um closer dentro de um processo comercial?', ...ot },
  { id: 42, ...b(5), text: 'O que diferencia uma boa reunião de vendas de uma reunião comum?', ...ot },
  { id: 43, ...b(5), text: 'O que você acredita que um closer precisa entender antes de tentar vender algo?', ...ot },
  { id: 44, ...b(5), text: 'Qual é o erro mais comum que closers cometem em reuniões de vendas?', ...ot },
  { id: 45, ...b(5), text: 'O que faz um cliente confiar em um vendedor durante uma reunião?', ...ot },
  { id: 46, ...b(5), text: 'Na sua opinião, o que diferencia um closer mediano de um closer excelente?', ...ot },
  { id: 47, ...b(5), text: 'Qual é o maior erro que um vendedor pode cometer ao tentar fechar uma venda?', ...ot },
  { id: 48, ...b(5), text: 'Como um closer pode gerar valor antes de falar sobre preço?', ...ot },
  { id: 49, ...b(5), text: 'O que faz uma reunião de vendas parecer profissional para o cliente?', ...ot },
  { id: 50, ...b(5), text: 'Como você definiria uma venda bem conduzida?', ...ot },

  // ===== BLOCO 6 — DIAGNÓSTICO DO CLIENTE (10) =====
  { id: 51, ...b(6), text: 'Como você costuma começar uma reunião de vendas?', ...ot },
  { id: 52, ...b(6), text: 'Que tipo de perguntas você faz para entender o problema do cliente?', ...ot },
  { id: 53, ...b(6), text: 'Como você identifica se o problema do cliente é realmente importante para ele?', ...ot },
  { id: 54, ...b(6), text: 'O que você faz quando o cliente não consegue explicar claramente o problema que tem?', ...ot },
  { id: 55, ...b(6), text: 'Como você ajuda o cliente a refletir sobre a situação atual dele?', ...ot },
  { id: 56, ...b(6), text: 'O que você busca entender sobre o negócio ou contexto do cliente durante a reunião?', ...ot },
  { id: 57, ...b(6), text: 'Como você identifica se o cliente realmente quer resolver o problema ou apenas está curioso?', ...ot },
  { id: 58, ...b(6), text: 'Como você conduz a conversa para descobrir a real prioridade do cliente?', ...ot },
  { id: 59, ...b(6), text: 'O que você faz quando percebe que o cliente ainda não vê urgência no problema?', ...ot },
  { id: 60, ...b(6), text: 'Como você diferencia um cliente pronto para decisão de um cliente apenas explorando opções?', ...ot },

  // ===== BLOCO 7 — CONSTRUÇÃO DE VALOR (10) =====
  { id: 61, ...b(7), text: 'O que significa, para você, construir valor durante uma reunião de vendas?', ...ot },
  { id: 62, ...b(7), text: 'Como você conecta o problema do cliente com a solução que está oferecendo?', ...ot },
  { id: 63, ...b(7), text: 'O que você faz para ajudar o cliente a perceber o impacto do problema que ele tem?', ...ot },
  { id: 64, ...b(7), text: 'Como você conduz a conversa antes de apresentar a solução?', ...ot },
  { id: 65, ...b(7), text: 'O que você faz para garantir que o cliente entendeu o valor da solução?', ...ot },
  { id: 66, ...b(7), text: 'Como você evita que a conversa vire apenas uma apresentação do produto?', ...ot },
  { id: 67, ...b(7), text: 'Como você conduz a conversa para que o cliente participe da construção da solução?', ...ot },
  { id: 68, ...b(7), text: 'O que você faz quando percebe que o cliente ainda não entende completamente o valor da solução?', ...ot },
  { id: 69, ...b(7), text: 'Como você usa exemplos ou casos para reforçar o valor da solução?', ...ot },
  { id: 70, ...b(7), text: 'Como você conduz a transição entre diagnóstico e apresentação da solução?', ...ot },

  // ===== BLOCO 8 — CONDUÇÃO DA DECISÃO (10) =====
  { id: 71, ...b(8), text: 'Em que momento você acredita que é correto apresentar o preço ou investimento?', ...ot },
  { id: 72, ...b(8), text: 'Como você conduz a conversa para chegar naturalmente ao momento de decisão?', ...ot },
  { id: 73, ...b(8), text: 'O que você faz quando o cliente diz que precisa pensar?', ...ot },
  { id: 74, ...b(8), text: 'Como você identifica se uma objeção é real ou apenas uma forma de adiar a decisão?', ...ot },
  { id: 75, ...b(8), text: 'Como você lida com clientes que querem negociar preço antes de entender valor?', ...ot },
  { id: 76, ...b(8), text: 'O que você faz quando o cliente demonstra interesse mas não toma decisão?', ...ot },
  { id: 77, ...b(8), text: 'Como você conduz uma conversa quando percebe que o cliente está inseguro?', ...ot },
  { id: 78, ...b(8), text: 'O que você faz quando percebe que a reunião está perdendo direção?', ...ot },
  { id: 79, ...b(8), text: 'Como você mantém controle da reunião sem parecer agressivo?', ...ot },
  { id: 80, ...b(8), text: 'O que significa, para você, conduzir uma decisão com responsabilidade?', ...ot },
];

export const MIN_CHARS = 50;
