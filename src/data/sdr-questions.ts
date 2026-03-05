import { Question, QuestionType } from './dna-questions';

const SDR_BLOCK_TITLES = [
  { title: 'Dominância (D)', subtitle: 'Ação, decisão e iniciativa' },
  { title: 'Influência (I)', subtitle: 'Comunicação, conexão e energia social' },
  { title: 'Estabilidade (S)', subtitle: 'Consistência, paciência e resiliência' },
  { title: 'Conformidade (C)', subtitle: 'Organização, processo e atenção a detalhes' },
];

function sdrBlock(block: number) {
  return { block, blockTitle: SDR_BLOCK_TITLES[block - 1].title, blockSubtitle: SDR_BLOCK_TITLES[block - 1].subtitle };
}

const sdrScale = {
  type: 'scale' as QuestionType,
  scaleMin: 1,
  scaleMax: 5,
  scaleMinLabel: 'Não me identifico',
  scaleMaxLabel: 'Me identifico muito',
};

export const sdrQuestions: Question[] = [
  // ===== BLOCO 1 – DOMINÂNCIA (D) – 10 perguntas =====
  { id: 1, ...sdrBlock(1), text: 'Quando percebo uma oportunidade de conversa com um lead, tomo iniciativa imediatamente.', ...sdrScale },
  { id: 2, ...sdrBlock(1), text: 'Se uma abordagem não funciona, rapidamente tento outra estratégia.', ...sdrScale },
  { id: 3, ...sdrBlock(1), text: 'Não tenho dificuldade em iniciar conversas com pessoas que nunca falei antes.', ...sdrScale },
  { id: 4, ...sdrBlock(1), text: 'Prefiro agir rápido a esperar todas as informações para começar uma abordagem.', ...sdrScale },
  { id: 5, ...sdrBlock(1), text: 'Quando um lead hesita em marcar reunião, tento conduzir a conversa para uma decisão.', ...sdrScale },
  { id: 6, ...sdrBlock(1), text: 'Me sinto confortável conduzindo uma conversa e direcionando o rumo dela.', ...sdrScale },
  { id: 7, ...sdrBlock(1), text: 'Quando alguém questiona minha abordagem, defendo meu ponto de vista com segurança.', ...sdrScale },
  { id: 8, ...sdrBlock(1), text: 'Prefiro ambientes de trabalho com metas desafiadoras e ritmo acelerado.', ...sdrScale },
  { id: 9, ...sdrBlock(1), text: 'Quando preciso atingir um resultado, busco alternativas até encontrar um caminho.', ...sdrScale },
  { id: 10, ...sdrBlock(1), text: 'Não tenho medo de incomodar um lead se acredito que posso ajudá-lo.', ...sdrScale },

  // ===== BLOCO 2 – INFLUÊNCIA (I) – 10 perguntas =====
  { id: 11, ...sdrBlock(2), text: 'Gosto de conversar com pessoas novas e conhecer suas histórias.', ...sdrScale },
  { id: 12, ...sdrBlock(2), text: 'Consigo criar conexão rapidamente mesmo em conversas curtas.', ...sdrScale },
  { id: 13, ...sdrBlock(2), text: 'Me sinto energizado quando passo boa parte do dia conversando com pessoas.', ...sdrScale },
  { id: 14, ...sdrBlock(2), text: 'Costumo adaptar minha forma de falar dependendo da pessoa com quem estou conversando.', ...sdrScale },
  { id: 15, ...sdrBlock(2), text: 'Tenho facilidade para manter uma conversa interessante com alguém que acabei de conhecer.', ...sdrScale },
  { id: 16, ...sdrBlock(2), text: 'Consigo transmitir entusiasmo quando apresento uma ideia ou oportunidade.', ...sdrScale },
  { id: 17, ...sdrBlock(2), text: 'Percebo rapidamente quando uma pessoa está engajada ou desinteressada na conversa.', ...sdrScale },
  { id: 18, ...sdrBlock(2), text: 'Gosto de ambientes onde há interação constante entre pessoas.', ...sdrScale },
  { id: 19, ...sdrBlock(2), text: 'Tenho facilidade em deixar as pessoas mais confortáveis durante uma conversa.', ...sdrScale },
  { id: 20, ...sdrBlock(2), text: 'Prefiro atividades que envolvem comunicação e interação com outras pessoas.', ...sdrScale },

  // ===== BLOCO 3 – ESTABILIDADE (S) – 10 perguntas =====
  { id: 21, ...sdrBlock(3), text: 'Consigo manter meu ritmo de trabalho mesmo após receber várias rejeições.', ...sdrScale },
  { id: 22, ...sdrBlock(3), text: 'Mesmo quando um lead é rude ou negativo, consigo manter postura calma.', ...sdrScale },
  { id: 23, ...sdrBlock(3), text: 'Consigo trabalhar bem com tarefas repetitivas se elas forem importantes para o resultado.', ...sdrScale },
  { id: 24, ...sdrBlock(3), text: 'Tenho paciência para desenvolver conversas que precisam de mais tempo.', ...sdrScale },
  { id: 25, ...sdrBlock(3), text: 'Consigo manter foco em atividades de prospecção durante longos períodos.', ...sdrScale },
  { id: 26, ...sdrBlock(3), text: 'Não deixo um "não" afetar muito meu humor ou motivação.', ...sdrScale },
  { id: 27, ...sdrBlock(3), text: 'Prefiro manter uma rotina de trabalho consistente ao longo do tempo.', ...sdrScale },
  { id: 28, ...sdrBlock(3), text: 'Consigo continuar prospectando mesmo após um dia difícil.', ...sdrScale },
  { id: 29, ...sdrBlock(3), text: 'Sou persistente quando acredito que uma oportunidade vale a pena.', ...sdrScale },
  { id: 30, ...sdrBlock(3), text: 'Tenho facilidade em manter disciplina mesmo quando ninguém está me supervisionando.', ...sdrScale },

  // ===== BLOCO 4 – CONFORMIDADE (C) – 10 perguntas =====
  { id: 31, ...sdrBlock(4), text: 'Prefiro trabalhar com processos e métodos claros.', ...sdrScale },
  { id: 32, ...sdrBlock(4), text: 'Gosto de entender bem um roteiro ou playbook antes de executá-lo.', ...sdrScale },
  { id: 33, ...sdrBlock(4), text: 'Costumo registrar minhas atividades e conversas de forma organizada.', ...sdrScale },
  { id: 34, ...sdrBlock(4), text: 'Antes de abordar um lead, gosto de pesquisar informações relevantes.', ...sdrScale },
  { id: 35, ...sdrBlock(4), text: 'Presto atenção aos detalhes da comunicação para evitar erros ou mal-entendidos.', ...sdrScale },
  { id: 36, ...sdrBlock(4), text: 'Procuro melhorar minhas abordagens analisando conversas anteriores.', ...sdrScale },
  { id: 37, ...sdrBlock(4), text: 'Gosto de aprender métodos estruturados para melhorar meu desempenho.', ...sdrScale },
  { id: 38, ...sdrBlock(4), text: 'Tenho facilidade em seguir processos definidos pela empresa.', ...sdrScale },
  { id: 39, ...sdrBlock(4), text: 'Costumo revisar meu trabalho para identificar pontos de melhoria.', ...sdrScale },
  { id: 40, ...sdrBlock(4), text: 'Prefiro trabalhar em um ambiente onde as expectativas e regras são claras.', ...sdrScale },
];

export const SDR_MIN_CHARS = 50;
