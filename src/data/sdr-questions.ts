import { Question, QuestionType } from './dna-questions';

const SDR_BLOCK_TITLES = [
  { title: 'Dominância (D)', subtitle: 'Ação, decisão e iniciativa' },
  { title: 'Influência (I)', subtitle: 'Comunicação, conexão e energia social' },
  { title: 'Estabilidade (S)', subtitle: 'Consistência, paciência e resiliência' },
  { title: 'Conformidade (C)', subtitle: 'Organização, processo e atenção a detalhes' },
  { title: 'Conhecimento sobre SDR', subtitle: 'Visão sobre a função e qualificação de leads' },
  { title: 'Estratégia de Abordagem', subtitle: 'Como você conduz conversas e toma decisões' },
  { title: 'Rotina de Trabalho', subtitle: 'Organização, disciplina e consistência' },
  { title: 'Padrão de Qualidade', subtitle: 'Qualidade de execução e evolução profissional' },
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
  // ==========================================
  // BLOCO 1 – DOMINÂNCIA (D) – 10 escala
  // ==========================================
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

  // ==========================================
  // BLOCO 2 – INFLUÊNCIA (I) – 10 escala
  // ==========================================
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

  // ==========================================
  // BLOCO 3 – ESTABILIDADE (S) – 10 escala
  // ==========================================
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

  // ==========================================
  // BLOCO 4 – CONFORMIDADE (C) – 10 escala
  // ==========================================
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

  // ==========================================
  // BLOCO 5 – CONHECIMENTO SOBRE SDR – 10 abertas
  // ==========================================
  { id: 41, ...sdrBlock(5), text: 'Na sua visão, qual é o principal objetivo do trabalho de um SDR dentro de um time comercial?', ...ot },
  { id: 42, ...sdrBlock(5), text: 'O que diferencia um lead curioso de um lead realmente qualificado para uma reunião de vendas?', ...ot },
  { id: 43, ...sdrBlock(5), text: 'Quais informações você acredita que um SDR precisa descobrir antes de agendar uma reunião para um closer?', ...ot },
  { id: 44, ...sdrBlock(5), text: 'Como você identifica se um lead realmente tem um problema que vale uma conversa mais profunda?', ...ot },
  { id: 45, ...sdrBlock(5), text: 'O que, na sua opinião, faz uma conversa inicial com um lead ser produtiva?', ...ot },
  { id: 46, ...sdrBlock(5), text: 'Quais são os erros mais comuns que SDRs cometem durante a prospecção?', ...ot },
  { id: 47, ...sdrBlock(5), text: 'O que você acredita que diferencia um SDR mediano de um SDR excelente?', ...ot },
  { id: 48, ...sdrBlock(5), text: 'Como um SDR pode aumentar a qualidade das reuniões que agenda para o time de vendas?', ...ot },
  { id: 49, ...sdrBlock(5), text: 'Na sua opinião, o que faz um lead aceitar conversar com um vendedor?', ...ot },
  { id: 50, ...sdrBlock(5), text: 'Como você definiria um lead ideal para prospectar?', ...ot },

  // ==========================================
  // BLOCO 6 – ESTRATÉGIA DE ABORDAGEM – 10 abertas
  // ==========================================
  { id: 51, ...sdrBlock(6), text: 'Quando você vai abordar um lead pela primeira vez, como decide qual abordagem usar?', ...ot },
  { id: 52, ...sdrBlock(6), text: 'O que você procura entender sobre um lead antes de iniciar uma conversa com ele?', ...ot },
  { id: 53, ...sdrBlock(6), text: 'Como você conduz uma conversa inicial para descobrir se existe um problema real?', ...ot },
  { id: 54, ...sdrBlock(6), text: 'Em que momento você acredita que faz sentido sugerir o agendamento de uma reunião?', ...ot },
  { id: 55, ...sdrBlock(6), text: 'Como você reage quando percebe que o lead está pouco engajado na conversa?', ...ot },
  { id: 56, ...sdrBlock(6), text: 'O que você faz quando um lead responde de forma muito curta ou pouco interessada?', ...ot },
  { id: 57, ...sdrBlock(6), text: 'Como você tenta manter uma conversa produtiva com alguém que você acabou de conhecer?', ...ot },
  { id: 58, ...sdrBlock(6), text: 'Como você lida com objeções simples durante a prospecção?', ...ot },
  { id: 59, ...sdrBlock(6), text: 'Se um lead disser que não tem tempo para conversar, o que você costuma fazer?', ...ot },
  { id: 60, ...sdrBlock(6), text: 'Como você decide quando insistir e quando encerrar uma abordagem?', ...ot },

  // ==========================================
  // BLOCO 7 – ROTINA DE TRABALHO – 10 abertas
  // ==========================================
  { id: 61, ...sdrBlock(7), text: 'Descreva como seria um dia ideal de trabalho para um SDR.', ...ot },
  { id: 62, ...sdrBlock(7), text: 'Como você organiza sua rotina para garantir que está prospectando com consistência?', ...ot },
  { id: 63, ...sdrBlock(7), text: 'Como você define prioridades entre diferentes tarefas no trabalho?', ...ot },
  { id: 64, ...sdrBlock(7), text: 'O que você faz para manter produtividade mesmo em tarefas repetitivas?', ...ot },
  { id: 65, ...sdrBlock(7), text: 'Como você mantém disciplina quando está trabalhando sem supervisão direta?', ...ot },
  { id: 66, ...sdrBlock(7), text: 'Como você costuma organizar ou registrar suas conversas com leads?', ...ot },
  { id: 67, ...sdrBlock(7), text: 'O que você faz quando percebe que sua rotina de prospecção está caindo de ritmo?', ...ot },
  { id: 68, ...sdrBlock(7), text: 'Como você garante que não perde oportunidades de follow-up com leads?', ...ot },
  { id: 69, ...sdrBlock(7), text: 'O que você faz para melhorar sua produtividade ao longo do tempo?', ...ot },
  { id: 70, ...sdrBlock(7), text: 'Que tipo de rotina você acredita que ajuda um SDR a ter alta performance?', ...ot },

  // ==========================================
  // BLOCO 8 – PADRÃO DE QUALIDADE – 10 abertas
  // ==========================================
  { id: 71, ...sdrBlock(8), text: 'O que significa, para você, fazer uma prospecção de qualidade?', ...ot },
  { id: 72, ...sdrBlock(8), text: 'Como você garante que suas mensagens ou abordagens não sejam genéricas?', ...ot },
  { id: 73, ...sdrBlock(8), text: 'O que você faz para representar bem a empresa durante uma conversa com um lead?', ...ot },
  { id: 74, ...sdrBlock(8), text: 'Como você se prepara antes de falar com um lead importante?', ...ot },
  { id: 75, ...sdrBlock(8), text: 'O que você faz depois de uma conversa que não saiu como esperado?', ...ot },
  { id: 76, ...sdrBlock(8), text: 'Como você identifica que precisa melhorar sua forma de abordar leads?', ...ot },
  { id: 77, ...sdrBlock(8), text: 'Como você costuma aprender com erros ou abordagens que não funcionaram?', ...ot },
  { id: 78, ...sdrBlock(8), text: 'Como você equilibra quantidade de abordagens com qualidade das conversas?', ...ot },
  { id: 79, ...sdrBlock(8), text: 'Que tipo de comportamento de um SDR pode prejudicar a imagem da empresa?', ...ot },
  { id: 80, ...sdrBlock(8), text: 'O que você faz constantemente para evoluir como profissional de vendas?', ...ot },

  // ==========================================
  // BLOCO 9 – PRESSÃO & RESILIÊNCIA – 15 escala
  // ==========================================
  { id: 81, ...sdrBlock(9), text: 'Consigo continuar trabalhando normalmente mesmo após receber várias rejeições.', ...sdrScale },
  { id: 82, ...sdrBlock(9), text: 'Não deixo meu humor afetar minha produtividade.', ...sdrScale },
  { id: 83, ...sdrBlock(9), text: 'Consigo manter disciplina mesmo em dias difíceis.', ...sdrScale },
  { id: 84, ...sdrBlock(9), text: 'Quando algo não funciona, procuro rapidamente ajustar minha abordagem.', ...sdrScale },
  { id: 85, ...sdrBlock(9), text: 'Não dependo de motivação para executar minhas tarefas.', ...sdrScale },
  { id: 86, ...sdrBlock(9), text: 'Me sinto confortável trabalhando com metas desafiadoras.', ...sdrScale },
  { id: 87, ...sdrBlock(9), text: 'Consigo lidar bem com pressão por resultado.', ...sdrScale },
  { id: 88, ...sdrBlock(9), text: 'Quando cometo um erro, procuro entender o que aconteceu e melhorar.', ...sdrScale },
  { id: 89, ...sdrBlock(9), text: 'Prefiro ambientes de trabalho onde o desempenho é constantemente medido.', ...sdrScale },
  { id: 90, ...sdrBlock(9), text: 'Não tenho problema em receber feedback direto sobre minha performance.', ...sdrScale },
  { id: 91, ...sdrBlock(9), text: 'Consigo manter foco em resultados mesmo quando o processo é difícil.', ...sdrScale },
  { id: 92, ...sdrBlock(9), text: 'Tenho facilidade em continuar tentando após fracassos.', ...sdrScale },
  { id: 93, ...sdrBlock(9), text: 'Me sinto motivado quando tenho metas claras para atingir.', ...sdrScale },
  { id: 94, ...sdrBlock(9), text: 'Sou competitivo comigo mesmo em relação aos meus resultados.', ...sdrScale },
  { id: 95, ...sdrBlock(9), text: 'Consigo lidar bem com frustrações no trabalho.', ...sdrScale },

  // ==========================================
  // BLOCO 10 – DECISÃO PRÁTICA – 15 múltipla escolha
  // ==========================================
  { id: 96, ...sdrBlock(10), text: 'Um lead responde de forma seca e parece desinteressado. Você:', ...mc(['Tenta uma nova abordagem', 'Encerra a conversa educadamente', 'Tenta entender o motivo', 'Deixa para falar depois']) },
  { id: 97, ...sdrBlock(10), text: 'Após várias rejeições seguidas você:', ...mc(['Continua prospectando normalmente', 'Diminui o ritmo', 'Muda de tarefa', 'Faz uma pausa']) },
  { id: 98, ...sdrBlock(10), text: 'Se um lead ignora suas mensagens você:', ...mc(['Tenta outra abordagem', 'Faz follow-up depois', 'Assume que não há interesse', 'Tenta outro canal']) },
  { id: 99, ...sdrBlock(10), text: 'Quando você percebe que a conversa está esfriando você:', ...mc(['Muda a direção da conversa', 'Tenta criar conexão', 'Faz uma pergunta direta', 'Encerra']) },
  { id: 100, ...sdrBlock(10), text: 'Se você não bateu sua meta no mês:', ...mc(['Analisa o que aconteceu', 'Trabalha mais no mês seguinte', 'Pede ajuda', 'Fica frustrado']) },
  { id: 101, ...sdrBlock(10), text: 'Quando recebe um feedback crítico você:', ...mc(['Tenta aplicar imediatamente', 'Reflete antes de aplicar', 'Discute o ponto', 'Ignora']) },
  { id: 102, ...sdrBlock(10), text: 'Se uma estratégia de abordagem não funciona você:', ...mc(['Testa outra', 'Pede opinião', 'Insiste mais', 'Muda o tipo de lead']) },
  { id: 103, ...sdrBlock(10), text: 'Quando a meta aumenta você:', ...mc(['Se motiva', 'Se desafia', 'Se preocupa', 'Reorganiza sua estratégia']) },
  { id: 104, ...sdrBlock(10), text: 'Quando um lead diz "não tenho interesse" você:', ...mc(['Pergunta o motivo', 'Agradece e encerra', 'Tenta reverter', 'Agenda follow-up']) },
  { id: 105, ...sdrBlock(10), text: 'Quando percebe que uma abordagem funcionou bem você:', ...mc(['Tenta replicar', 'Compartilha com o time', 'Adapta para outros leads', 'Registra como aprendizado']) },
  { id: 106, ...sdrBlock(10), text: 'Se um dia de prospecção foi muito ruim você:', ...mc(['Reflete sobre o que aconteceu', 'Descansa e recomeça', 'Muda estratégia', 'Ignora e segue']) },
  { id: 107, ...sdrBlock(10), text: 'Quando alguém do time performa muito mais que você:', ...mc(['Tenta aprender com ele', 'Se motiva', 'Se compara', 'Ignora']) },
  { id: 108, ...sdrBlock(10), text: 'Quando não sabe como lidar com uma situação você:', ...mc(['Pesquisa', 'Pergunta ao time', 'Tenta resolver sozinho', 'Testa alternativas']) },
  { id: 109, ...sdrBlock(10), text: 'Se um lead demonstra interesse real você:', ...mc(['Aprofunda a conversa', 'Agenda reunião', 'Investiga mais', 'Envia material']) },
  { id: 110, ...sdrBlock(10), text: 'Quando percebe que está evoluindo você:', ...mc(['Aumenta metas', 'Busca novos desafios', 'Mantém consistência', 'Analisa o que melhorou']) },

  // ==========================================
  // BLOCO 11 – MATURIDADE COMERCIAL – 10 abertas
  // ==========================================
  { id: 111, ...sdrBlock(11), text: 'Conte uma situação em que você recebeu muitas rejeições seguidas. O que fez depois?', ...ot },
  { id: 112, ...sdrBlock(11), text: 'O que você faz para manter motivação quando o trabalho fica difícil?', ...ot },
  { id: 113, ...sdrBlock(11), text: 'Qual foi o maior desafio que você já enfrentou trabalhando com pessoas ou clientes?', ...ot },
  { id: 114, ...sdrBlock(11), text: 'Como você reage quando percebe que não está atingindo os resultados esperados?', ...ot },
  { id: 115, ...sdrBlock(11), text: 'O que diferencia, na sua opinião, um profissional de vendas resiliente de um que desiste rápido?', ...ot },
  { id: 116, ...sdrBlock(11), text: 'Conte um erro profissional que você já cometeu e o que aprendeu com ele.', ...ot },
  { id: 117, ...sdrBlock(11), text: 'O que te motiva a continuar tentando quando algo não está funcionando?', ...ot },
  { id: 118, ...sdrBlock(11), text: 'Qual tipo de situação no trabalho mais testa sua paciência ou controle emocional?', ...ot },
  { id: 119, ...sdrBlock(11), text: 'O que você faz para melhorar continuamente seu desempenho profissional?', ...ot },
  { id: 120, ...sdrBlock(11), text: 'O que você acredita que faz alguém ter sucesso em vendas a longo prazo?', ...ot },
];

export const SDR_MIN_CHARS = 50;
