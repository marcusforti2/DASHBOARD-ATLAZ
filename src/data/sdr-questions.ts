import { Question, QuestionType } from './dna-questions';

const SDR_BLOCK_TITLES = [
  { title: 'Dominância (D)', subtitle: 'Ação, decisão e iniciativa' },
  { title: 'Influência (I)', subtitle: 'Comunicação, conexão e energia social' },
  { title: 'Estabilidade (S)', subtitle: 'Consistência, paciência e resiliência' },
  { title: 'Conformidade (C)', subtitle: 'Organização, processo e atenção a detalhes' },
  { title: 'Pressão & Resiliência', subtitle: 'Como você lida com pressão e adversidade' },
  { title: 'Decisão Prática', subtitle: 'Como você age em situações reais de prospecção' },
  { title: 'Maturidade Comercial', subtitle: 'Sua visão e experiência real em vendas' },
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

function mc(opts: string[]): { type: QuestionType; options: { label: string; value: string }[] } {
  return {
    type: 'multiple-choice',
    options: opts.map((o, i) => ({ label: o, value: String.fromCharCode(65 + i) })),
  };
}

const ot = {
  type: 'open-text' as QuestionType,
  placeholder: 'Escreva sua resposta com honestidade...',
  hint: 'Responda com suas próprias palavras. Não existe resposta certa — quanto mais sincero, melhor.',
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

  // ===== BLOCO 5 – PRESSÃO & RESILIÊNCIA (Escala) – 15 perguntas =====
  { id: 41, ...sdrBlock(5), text: 'Consigo continuar trabalhando normalmente mesmo após receber várias rejeições.', ...sdrScale },
  { id: 42, ...sdrBlock(5), text: 'Não deixo meu humor afetar minha produtividade.', ...sdrScale },
  { id: 43, ...sdrBlock(5), text: 'Consigo manter disciplina mesmo em dias difíceis.', ...sdrScale },
  { id: 44, ...sdrBlock(5), text: 'Quando algo não funciona, procuro rapidamente ajustar minha abordagem.', ...sdrScale },
  { id: 45, ...sdrBlock(5), text: 'Não dependo de motivação para executar minhas tarefas.', ...sdrScale },
  { id: 46, ...sdrBlock(5), text: 'Me sinto confortável trabalhando com metas desafiadoras.', ...sdrScale },
  { id: 47, ...sdrBlock(5), text: 'Consigo lidar bem com pressão por resultado.', ...sdrScale },
  { id: 48, ...sdrBlock(5), text: 'Quando cometo um erro, procuro entender o que aconteceu e melhorar.', ...sdrScale },
  { id: 49, ...sdrBlock(5), text: 'Prefiro ambientes de trabalho onde o desempenho é constantemente medido.', ...sdrScale },
  { id: 50, ...sdrBlock(5), text: 'Não tenho problema em receber feedback direto sobre minha performance.', ...sdrScale },
  { id: 51, ...sdrBlock(5), text: 'Consigo manter foco em resultados mesmo quando o processo é difícil.', ...sdrScale },
  { id: 52, ...sdrBlock(5), text: 'Tenho facilidade em continuar tentando após fracassos.', ...sdrScale },
  { id: 53, ...sdrBlock(5), text: 'Me sinto motivado quando tenho metas claras para atingir.', ...sdrScale },
  { id: 54, ...sdrBlock(5), text: 'Sou competitivo comigo mesmo em relação aos meus resultados.', ...sdrScale },
  { id: 55, ...sdrBlock(5), text: 'Consigo lidar bem com frustrações no trabalho.', ...sdrScale },

  // ===== BLOCO 6 – DECISÃO PRÁTICA (Múltipla Escolha) – 15 perguntas =====
  { id: 56, ...sdrBlock(6), text: 'Um lead responde de forma seca e parece desinteressado. Você:', ...mc(['Tenta uma nova abordagem', 'Encerra a conversa educadamente', 'Tenta entender o motivo', 'Deixa para falar depois']) },
  { id: 57, ...sdrBlock(6), text: 'Após várias rejeições seguidas você:', ...mc(['Continua prospectando normalmente', 'Diminui o ritmo', 'Muda de tarefa', 'Faz uma pausa']) },
  { id: 58, ...sdrBlock(6), text: 'Se um lead ignora suas mensagens você:', ...mc(['Tenta outra abordagem', 'Faz follow-up depois', 'Assume que não há interesse', 'Tenta outro canal']) },
  { id: 59, ...sdrBlock(6), text: 'Quando você percebe que a conversa está esfriando você:', ...mc(['Muda a direção da conversa', 'Tenta criar conexão', 'Faz uma pergunta direta', 'Encerra']) },
  { id: 60, ...sdrBlock(6), text: 'Se você não bateu sua meta no mês:', ...mc(['Analisa o que aconteceu', 'Trabalha mais no mês seguinte', 'Pede ajuda', 'Fica frustrado']) },
  { id: 61, ...sdrBlock(6), text: 'Quando recebe um feedback crítico você:', ...mc(['Tenta aplicar imediatamente', 'Reflete antes de aplicar', 'Discute o ponto', 'Ignora']) },
  { id: 62, ...sdrBlock(6), text: 'Se uma estratégia de abordagem não funciona você:', ...mc(['Testa outra', 'Pede opinião', 'Insiste mais', 'Muda o tipo de lead']) },
  { id: 63, ...sdrBlock(6), text: 'Quando a meta aumenta você:', ...mc(['Se motiva', 'Se desafia', 'Se preocupa', 'Reorganiza sua estratégia']) },
  { id: 64, ...sdrBlock(6), text: 'Quando um lead diz "não tenho interesse" você:', ...mc(['Pergunta o motivo', 'Agradece e encerra', 'Tenta reverter', 'Agenda follow-up']) },
  { id: 65, ...sdrBlock(6), text: 'Quando percebe que uma abordagem funcionou bem você:', ...mc(['Tenta replicar', 'Compartilha com o time', 'Adapta para outros leads', 'Registra como aprendizado']) },
  { id: 66, ...sdrBlock(6), text: 'Se um dia de prospecção foi muito ruim você:', ...mc(['Reflete sobre o que aconteceu', 'Descansa e recomeça', 'Muda estratégia', 'Ignora e segue']) },
  { id: 67, ...sdrBlock(6), text: 'Quando alguém do time performa muito mais que você:', ...mc(['Tenta aprender com ele', 'Se motiva', 'Se compara', 'Ignora']) },
  { id: 68, ...sdrBlock(6), text: 'Quando não sabe como lidar com uma situação você:', ...mc(['Pesquisa', 'Pergunta ao time', 'Tenta resolver sozinho', 'Testa alternativas']) },
  { id: 69, ...sdrBlock(6), text: 'Se um lead demonstra interesse real você:', ...mc(['Aprofunda a conversa', 'Agenda reunião', 'Investiga mais', 'Envia material']) },
  { id: 70, ...sdrBlock(6), text: 'Quando percebe que está evoluindo você:', ...mc(['Aumenta metas', 'Busca novos desafios', 'Mantém consistência', 'Analisa o que melhorou']) },

  // ===== BLOCO 7 – MATURIDADE COMERCIAL (Abertas) – 10 perguntas =====
  { id: 71, ...sdrBlock(7), text: 'Conte uma situação em que você recebeu muitas rejeições seguidas. O que fez depois?', ...ot },
  { id: 72, ...sdrBlock(7), text: 'O que você faz para manter motivação quando o trabalho fica difícil?', ...ot },
  { id: 73, ...sdrBlock(7), text: 'Qual foi o maior desafio que você já enfrentou trabalhando com pessoas ou clientes?', ...ot },
  { id: 74, ...sdrBlock(7), text: 'Como você reage quando percebe que não está atingindo os resultados esperados?', ...ot },
  { id: 75, ...sdrBlock(7), text: 'O que diferencia, na sua opinião, um profissional de vendas resiliente de um que desiste rápido?', ...ot },
  { id: 76, ...sdrBlock(7), text: 'Conte um erro profissional que você já cometeu e o que aprendeu com ele.', ...ot },
  { id: 77, ...sdrBlock(7), text: 'O que te motiva a continuar tentando quando algo não está funcionando?', ...ot },
  { id: 78, ...sdrBlock(7), text: 'Qual tipo de situação no trabalho mais testa sua paciência ou controle emocional?', ...ot },
  { id: 79, ...sdrBlock(7), text: 'O que você faz para melhorar continuamente seu desempenho profissional?', ...ot },
  { id: 80, ...sdrBlock(7), text: 'O que você acredita que faz alguém ter sucesso em vendas a longo prazo?', ...ot },
];

export const SDR_MIN_CHARS = 50;
