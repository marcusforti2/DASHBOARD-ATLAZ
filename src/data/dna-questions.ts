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
  { title: 'Motivação & Propósito', subtitle: 'O que move você por dentro' },
  { title: 'Padrões Emocionais', subtitle: 'Seus padrões automáticos em vendas' },
  { title: 'Rotina & Disciplina', subtitle: 'Sua capacidade de sustentação' },
  { title: 'Comportamento em Call', subtitle: 'O que realmente acontece na ligação' },
  { title: 'Estilo Natural de Venda', subtitle: 'Sua identidade como vendedor' },
  { title: 'Perguntas Situacionais', subtitle: 'Perguntas que revelam a verdade' },
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
const yn = {
  type: 'multiple-choice' as QuestionType,
  options: [
    { label: 'Sim', value: 'sim' },
    { label: 'Não', value: 'nao' },
  ],
};

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

  // ===== BLOCO 5 – MOTIVAÇÃO & PROPÓSITO / ENEAGRAMA (20) =====
  { id: 41, ...b(5), text: 'O que mais te incomoda em uma call difícil?', hint: 'Escolha o que te gera mais desconforto emocional, não racional.', ...mc(['Perder o controle da situação', 'Não ser reconhecido pelo esforço', 'Não entender exatamente o que está acontecendo', 'Sentir que o lead não confia em você', 'Ficar exposto ou vulnerável']) },
  { id: 42, ...b(5), text: 'Quando você perde uma venda importante, o que sente primeiro?', ...ot },
  { id: 43, ...b(5), text: 'Você prefere:', hint: 'Não pense no que é "melhor" — pense no que você realmente busca no fundo.', ...mc(['Ser admirado pelo time', 'Ser respeitado pela competência', 'Ter segurança e estabilidade', 'Ser necessário e indispensável', 'Ser independente e autossuficiente']) },
  { id: 44, ...b(5), text: 'O que você faz quando sente que não está performando bem?', hint: 'Pense na sua reação automática, aquela que vem antes de você pensar racionalmente.', ...mc(['Dobro o esforço e busco resultado', 'Procuro validação de alguém', 'Me recolho e analiso sozinho', 'Fico ansioso e busco controle', 'Mudo de estratégia imediatamente']) },
  { id: 45, ...b(5), text: 'Qual é seu maior medo no trabalho?', ...ot },
  { id: 46, ...b(5), text: 'O que te faz sentir mais realizado?', ...mc(['Bater meta e ser o melhor', 'Ajudar alguém a ter resultado', 'Dominar um assunto profundamente', 'Ter previsibilidade e estabilidade', 'Ter liberdade de ação']) },
  { id: 47, ...b(5), text: 'Quando você está num dia ruim, como as pessoas percebem?', hint: 'Pense no que os outros notam, não no que você acha que demonstra.', ...mc(['Fico impaciente e direto demais', 'Fico carente de validação', 'Me isolo completamente', 'Fico controlador e rígido', 'Fico disperso e distraído']) },
  { id: 48, ...b(5), text: 'O que você busca de verdade na sua carreira?', ...ot },
  { id: 49, ...b(5), text: 'Quando você vê alguém do time vendendo mais que você:', hint: 'Seja honesto com sua reação interna, mesmo que não demonstre externamente.', ...mc(['Fico competitivo e quero ultrapassar', 'Fico feliz mas me comparo internamente', 'Analiso o que a pessoa faz de diferente', 'Não me afeta muito, sigo meu ritmo', 'Questiono se estou no caminho certo']) },
  { id: 50, ...b(5), text: 'Sua reação quando te elogiam em público:', ...mc(['Gosto e quero mais', 'Fico constrangido mas gosto', 'Prefiro elogio técnico e específico', 'Acho desnecessário mas aceito', 'Me questiono se é verdade']) },
  { id: 51, ...b(5), text: 'O que te faz levantar da cama todos os dias para vender?', ...ot },
  { id: 52, ...b(5), text: 'Você se identifica mais com qual frase?', hint: 'Escolha a frase que mais ressoa com seu impulso interno, não com sua função.', ...mc(['Eu preciso vencer', 'Eu preciso ser visto', 'Eu preciso entender', 'Eu preciso ter controle', 'Eu preciso ser livre']) },
  { id: 53, ...b(5), text: 'Em momentos de crise na empresa, você:', ...mc(['Assume a liderança', 'Cuida das pessoas ao redor', 'Busca informação e dados', 'Fica alerta e desconfiado', 'Se distancia emocionalmente']) },
  { id: 54, ...b(5), text: 'O que você faz quando não concorda com uma decisão da liderança?', hint: 'Pense na última vez que isso aconteceu. O que você fez de verdade?', ...mc(['Confronto e expresso', 'Aceito mas fico frustrado', 'Analiso e questiono com dados', 'Obedeço mas guardo opinião', 'Ignoro e sigo fazendo do meu jeito']) },
  { id: 55, ...b(5), text: 'Qual é a emoção que você mais evita sentir?', ...ot },
  { id: 56, ...b(5), text: 'Quando precisa pedir ajuda:', hint: 'Pense em situações reais de trabalho, não em teoria.', ...mc(['Evito ao máximo, resolvo sozinho', 'Peço naturalmente', 'Peço apenas se for técnico', 'Peço apenas se confiar muito na pessoa', 'Tento resolver de outro jeito antes']) },
  { id: 57, ...b(5), text: 'O que te faz mais ansioso no processo de venda?', hint: 'Identifique o que gera ansiedade real no seu corpo, não só desconforto intelectual.', ...mc(['Não ter controle sobre o resultado', 'A possibilidade de rejeição', 'Falta de informação do lead', 'Imprevisibilidade do processo', 'Ter que depender de outros']) },
  { id: 58, ...b(5), text: 'Se pudesse mudar uma coisa em você como vendedor, o que seria?', ...ot },
  { id: 59, ...b(5), text: 'O que mais te magoa no ambiente de trabalho?', hint: 'Magoa = algo que te afeta emocionalmente de verdade, não só incomoda.', ...mc(['Injustiça', 'Indiferença', 'Incompetência', 'Traição de confiança', 'Invasão do meu espaço']) },
  { id: 60, ...b(5), text: 'Como você recarrega sua energia depois de um dia difícil?', ...ot },

  // ===== BLOCO 6 – PADRÕES EMOCIONAIS / VÍCIOS (20) =====
  { id: 61, ...b(6), text: 'Quando o lead diz "vou pensar", você:', hint: 'Pense na sua reação real, não na técnica que te ensinaram.', ...mc(['Explica melhor o valor', 'Pergunta o que falta para decidir', 'Oferece um incentivo ou desconto', 'Aceita e agenda follow-up', 'Sente irritação ou frustração interna']) },
  { id: 62, ...b(6), text: 'Você já deu desconto antes de o lead pedir?', ...yn },
  { id: 63, ...b(6), text: 'Se sim, por que você deu desconto antecipadamente?', ...ot },
  { id: 64, ...b(6), text: 'Você sente desconforto com silêncio após falar o preço?', hint: 'Pense no momento exato em que você fala o valor e espera a reação do lead.', ...scale(0, 10, 'Nenhum desconforto', 'Desconforto extremo') },
  { id: 65, ...b(6), text: 'Quando sente que o lead vai dizer não, você:', hint: 'Pense naquele momento em que você "sabe" que vai perder — o que seu corpo faz?', ...mc(['Antecipa e tenta reverter', 'Fica ansioso e fala mais do que deveria', 'Aceita antes mesmo do lead falar', 'Mantenho postura e espero a resposta']) },
  { id: 66, ...b(6), text: 'Você costuma se justificar quando o lead questiona o preço?', hint: 'Justificar = explicar demais, dar razões, se defender. Diferente de argumentar valor.', ...mc(['Sempre', 'Na maioria das vezes', 'Às vezes', 'Raramente', 'Nunca']) },
  { id: 67, ...b(6), text: 'O que você sente quando um lead te ignora no follow-up?', ...ot },
  { id: 68, ...b(6), text: 'Você já prolongou uma call por medo de perder o lead?', ...yn },
  { id: 69, ...b(6), text: 'Quando sente que não vai bater a meta do mês:', hint: 'Pense nas últimas vezes que esteve abaixo da meta na terceira semana do mês.', ...mc(['Fico mais agressivo nas calls', 'Fico desmotivado e desacelero', 'Mudo a estratégia', 'Aceito e foco no próximo mês', 'Fico ansioso e perco qualidade']) },
  { id: 70, ...b(6), text: 'Você evita fazer calls em determinados horários por ansiedade?', ...yn },
  { id: 71, ...b(6), text: 'Quando percebe que está perdendo a call, o que sente no corpo?', ...ot },
  { id: 72, ...b(6), text: 'Você se pega concordando com objeções do lead para evitar conflito?', hint: 'Ex: o lead diz "tá caro" e você concorda antes de argumentar.', ...scale(0, 10, 'Nunca faço isso', 'Faço isso sempre') },
  { id: 73, ...b(6), text: 'Depois de uma call ruim, quanto tempo leva para se recuperar?', hint: 'Recuperar = voltar ao estado emocional normal para fazer a próxima call com qualidade.', ...mc(['Minutos - já parto pra próxima', 'Uma hora ou mais', 'Fico o dia todo afetado', 'Vários dias pensando nisso']) },
  { id: 74, ...b(6), text: 'Você sente necessidade de o lead gostar de você?', hint: 'Reflita: essa necessidade influencia suas decisões durante a negociação?', ...scale(0, 10, 'Não preciso', 'Preciso muito') },
  { id: 75, ...b(6), text: 'Qual é o padrão que você mais repete em calls que dão errado?', ...ot },
  { id: 76, ...b(6), text: 'Você já evitou falar preço por medo da reação do lead?', ...yn },
  { id: 77, ...b(6), text: 'Quando um lead elogia seu atendimento mas não compra, como se sente?', ...ot },
  { id: 78, ...b(6), text: 'Você costuma levar rejeição profissional para o lado pessoal?', hint: 'Pense nas últimas vezes que perdeu uma venda. Quanto isso te afetou fora do trabalho?', ...scale(0, 10, 'Nunca', 'Sempre') },
  { id: 79, ...b(6), text: 'Qual vício emocional você acha que mais atrapalha sua venda?', hint: 'Vício emocional = padrão automático que você repete sem perceber e que sabota seu resultado.', ...mc(['Necessidade de aprovação', 'Medo de confronto', 'Ansiedade por resultado', 'Perfeccionismo', 'Procrastinação emocional']) },
  { id: 80, ...b(6), text: 'O que te faz travar emocionalmente durante uma venda?', ...ot },

  // ===== BLOCO 7 – ROTINA E DISCIPLINA (15) =====
  { id: 81, ...b(7), text: 'Você estuda o script antes de cada call?', hint: 'Estudar = revisar ativamente, não apenas ter lido uma vez.', ...mc(['Sempre', 'Às vezes', 'Só quando lembro', 'Nunca']) },
  { id: 82, ...b(7), text: 'Quantas vezes você revisou suas últimas 5 calls?', type: 'open-text', placeholder: 'Digite um número...' },
  { id: 83, ...b(7), text: 'Se ninguém te cobrasse meta, você manteria o ritmo?', hint: 'Imagine que sua meta sumiu e ninguém vai te cobrar. O que muda?', ...mc(['Sim, com certeza', 'Não, preciso de pressão', 'Depende do momento']) },
  { id: 84, ...b(7), text: 'O que te faz quebrar sua rotina de trabalho?', ...ot },
  { id: 85, ...b(7), text: 'Você tem um ritual de preparação antes de calls importantes?', ...yn },
  { id: 86, ...b(7), text: 'Se sim, qual é esse ritual?', ...ot },
  { id: 87, ...b(7), text: 'Você acompanha suas próprias métricas diariamente?', hint: 'Métricas = taxa de conversão, nº de calls, ticket médio, etc.', ...mc(['Sim, obsessivamente', 'Sim, de vez em quando', 'Só quando cobram', 'Não acompanho']) },
  { id: 88, ...b(7), text: 'Qual a primeira coisa que você faz ao iniciar o dia de trabalho?', ...ot },
  { id: 89, ...b(7), text: 'Você consegue manter consistência por mais de 30 dias seguidos?', hint: 'Consistência = mesmo nível de energia, disciplina e resultado todos os dias.', ...mc(['Sim, naturalmente', 'Sim, mas com esforço', 'Começo bem mas perco ritmo', 'Não consigo manter']) },
  { id: 90, ...b(7), text: 'O que mais sabota sua disciplina?', hint: 'Pense no que te tira do trilho com mais frequência.', ...mc(['Distrações externas', 'Falta de motivação', 'Cansaço emocional', 'Falta de cobrança', 'Problemas pessoais']) },
  { id: 91, ...b(7), text: 'Você faz warm-up antes de começar as calls do dia?', hint: 'Warm-up = qualquer atividade para entrar no estado mental ideal antes de ligar.', ...mc(['Sim, sempre', 'Às vezes', 'Não, vou direto']) },
  { id: 92, ...b(7), text: 'Qual o horário do dia em que você performa melhor?', ...mc(['Manhã (8h-12h)', 'Início da tarde (13h-15h)', 'Final da tarde (15h-18h)', 'Noite (após 18h)']) },
  { id: 93, ...b(7), text: 'O que acontece com sua performance depois do almoço?', ...mc(['Mantém o mesmo nível', 'Cai bastante', 'Varia muito', 'Melhora']) },
  { id: 94, ...b(7), text: 'Você tem um sistema para gerenciar seus leads/pipeline?', ...mc(['Sim, bem organizado', 'Sim, mas bagunçado', 'Uso o CRM por obrigação', 'Não tenho sistema']) },
  { id: 95, ...b(7), text: 'O que você faz nos últimos 30 minutos do dia de trabalho?', ...ot },

  // ===== BLOCO 8 – COMPORTAMENTO EM CALL (20) =====
  { id: 96, ...b(8), text: 'Nos primeiros 30 segundos da call, o que você prioriza?', ...mc(['Gerar autoridade e posicionamento', 'Criar conexão e rapport', 'Fazer perguntas para entender o cenário', 'Seguir o script de abertura']) },
  { id: 97, ...b(8), text: 'Quando o lead fala mais que você na call:', ...mc(['Fico impaciente e retomo o controle', 'Gosto e deixo fluir', 'Escuto mas mentalmente organizo contrapontos', 'Espero pacientemente']) },
  { id: 98, ...b(8), text: 'Sua call ideal dura:', ...mc(['15-20 minutos (direto ao ponto)', '30-40 minutos (com rapport)', '40-60 minutos (consultiva detalhada)', 'Sem tempo fixo (depende do lead)']) },
  { id: 99, ...b(8), text: 'Quando o lead traz uma objeção inesperada:', hint: 'Objeção que você nunca ouviu ou que te pega desprevenido.', ...mc(['Respondo na hora com confiança', 'Ganho tempo e busco empatia', 'Peço um momento para pensar', 'Sigo o framework de contorno']) },
  { id: 100, ...b(8), text: 'Você grava e escuta suas próprias calls?', ...mc(['Sim, regularmente', 'Às vezes', 'Só quando pedem', 'Nunca']) },
  { id: 101, ...b(8), text: 'Como você lida com o silêncio durante a call?', hint: 'Silêncio = aquela pausa de 3-5 segundos depois de uma pergunta ou proposta.', ...mc(['Uso a meu favor (deixo o lead pensar)', 'Fico desconfortável e preencho', 'Depende da situação', 'Evito que aconteça']) },
  { id: 102, ...b(8), text: 'Quando o lead pergunta "quanto custa?", você:', ...mc(['Falo o preço direto', 'Contexto antes com valor', 'Faço mais perguntas antes', 'Depende do momento da call']) },
  { id: 103, ...b(8), text: 'O que mais te atrapalha durante uma call?', ...ot },
  { id: 104, ...b(8), text: 'Você adapta seu tom de voz conforme o perfil do lead?', hint: 'Ex: mais energia com leads animados, mais calma com leads analíticos.', ...mc(['Sim, naturalmente', 'Tento mas nem sempre consigo', 'Não penso nisso', 'Mantenho meu tom padrão']) },
  { id: 105, ...b(8), text: 'Quando percebe que está perdendo o lead:', ...mc(['Aumento a urgência', 'Mudo de abordagem', 'Faço uma pergunta provocativa', 'Aceito e finalizo profissionalmente']) },
  { id: 106, ...b(8), text: 'Quantas perguntas de diagnóstico você faz em média por call?', ...mc(['1-3 (vou direto)', '4-6 (equilíbrio)', '7-10 (detalhista)', '10+ (muito investigativo)']) },
  { id: 107, ...b(8), text: 'Você usa histórias/cases durante a call?', ...mc(['Sim, sempre', 'Às vezes', 'Raramente', 'Nunca']) },
  { id: 108, ...b(8), text: 'Como você encerra uma call que não vai fechar?', ...ot },
  { id: 109, ...b(8), text: 'Você sente diferença de performance entre calls por telefone vs vídeo?', ...mc(['Sim, sou melhor por telefone', 'Sim, sou melhor por vídeo', 'Não noto diferença', 'Depende do lead']) },
  { id: 110, ...b(8), text: 'O que te dá mais segurança antes de uma call?', ...mc(['Conhecer bem o lead/empresa', 'Ter o script pronto', 'Estar motivado', 'Ter batido meta']) },
  { id: 111, ...b(8), text: 'Quando o lead menciona o concorrente:', ...mc(['Ataco os pontos fracos do concorrente', 'Reposiciono nosso valor sem comparar', 'Peço mais detalhes sobre a experiência', 'Ignoro e sigo meu pitch']) },
  { id: 112, ...b(8), text: 'Você faz anotações durante a call?', ...mc(['Sim, detalhadas', 'Sim, pontos-chave', 'Às vezes', 'Não, confio na memória']) },
  { id: 113, ...b(8), text: 'Como você pede o fechamento?', hint: 'Pense na sua forma natural de pedir o "sim".', ...mc(['Direto: "Vamos fechar?"', 'Assumptivo: "Quando começamos?"', 'Sutil: conduzo até o lead decidir', 'Depende da situação']) },
  { id: 114, ...b(8), text: 'O que você faz imediatamente após uma call boa?', ...ot },
  { id: 115, ...b(8), text: 'O que você faz imediatamente após uma call ruim?', ...ot },

  // ===== BLOCO 9 – ESTILO NATURAL (10) =====
  { id: 116, ...b(9), text: 'Em uma palavra, como você se descreveria como vendedor?', type: 'open-text', placeholder: 'Uma palavra...' },
  { id: 117, ...b(9), text: 'Qual tipo de lead você vende melhor?', ...mc(['Decisor direto e objetivo', 'Pessoa relacional e empática', 'Analítico que quer dados', 'Cauteloso que precisa de confiança']) },
  { id: 118, ...b(9), text: 'E qual tipo de lead é mais difícil pra você?', ...mc(['O muito direto/agressivo', 'O frio/distante', 'O confuso/indeciso', 'O técnico demais']) },
  { id: 119, ...b(9), text: 'Você se considera mais:', ...mc(['Hunter (caçador de novas oportunidades)', 'Farmer (cultiva relacionamentos longos)', 'Um pouco dos dois']) },
  { id: 120, ...b(9), text: 'Como você lida com metas individuais vs metas de equipe?', ...mc(['Prefiro individual - compito comigo mesmo', 'Prefiro equipe - gosto de colaborar', 'Gosto dos dois', 'Não me importo com formato']) },
  { id: 121, ...b(9), text: 'O que te diferencia dos outros vendedores do time?', ...ot },
  { id: 122, ...b(9), text: 'Qual feedback você mais recebe dos leads?', ...ot },
  { id: 123, ...b(9), text: 'Se pudesse escolher, você venderia:', ...mc(['Produtos de ticket alto (poucos, mas grandes)', 'Produtos de ticket baixo (volume alto)', 'Serviços complexos (consultivos)', 'Qualquer coisa que me desafie']) },
  { id: 124, ...b(9), text: 'Você vende melhor quando está:', ...mc(['Sob pressão', 'Relaxado e sem cobrança', 'Em competição com alguém', 'Depende do dia']) },
  { id: 125, ...b(9), text: 'Se você fosse um animal de vendas, qual seria?', hint: 'Pense no animal que mais representa seu estilo natural de vender.', ...ot },

  // ===== BLOCO 10 – PERGUNTAS SITUACIONAIS (10) =====
  { id: 126, ...b(10), text: 'Um lead te diz: "Gostei muito, mas preciso falar com meu sócio". O que você faz?', ...ot },
  { id: 127, ...b(10), text: 'Você está a 3 dias do fim do mês e faltam 2 vendas para bater a meta. O que muda na sua abordagem?', ...ot },
  { id: 128, ...b(10), text: 'Um lead te liga furioso com um problema no produto. Como você age?', ...ot },
  { id: 129, ...b(10), text: 'Seu gestor te diz que seu fechamento está fraco. Qual sua reação?', ...ot },
  { id: 130, ...b(10), text: 'Você descobre que um colega está usando técnicas antiéticas para vender mais. O que faz?', ...ot },
  { id: 131, ...b(10), text: 'O lead diz que o concorrente é 40% mais barato. Como você responde?', ...ot },
  { id: 132, ...b(10), text: 'Você tem 2 calls marcadas no mesmo horário. Uma é com um lead quente e a outra é com seu maior cliente ativo. Qual prioriza e por quê?', ...ot },
  { id: 133, ...b(10), text: 'Depois de 3 meses consecutivos batendo meta, você tem o pior mês da carreira. O que aconteceu internamente?', ...ot },
  { id: 134, ...b(10), text: 'Se você pudesse voltar no tempo e dar um conselho ao "você vendedor do primeiro dia", o que diria?', ...ot },
  { id: 135, ...b(10), text: 'Qual foi a venda mais difícil da sua carreira e o que ela te ensinou?', ...ot },
];

export const MIN_CHARS = 50;
