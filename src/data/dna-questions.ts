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
}

export interface TestAnswer {
  questionId: number;
  value: string;
}

const BLOCK_TITLES = [
  { title: 'Perfil Comportamental', subtitle: 'Como você age sob pressão e em rotina' },
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

function scale(min: number, max: number, minL: string, maxL: string) {
  return { type: 'scale' as QuestionType, scaleMin: min, scaleMax: max, scaleMinLabel: minL, scaleMaxLabel: maxL };
}

export const questions: Question[] = [
  // ===== BLOCO 1 – DISC (25) =====
  { id: 1, ...b(1), text: 'Quando você recebe um script detalhado para seguir:', hint: 'Pense em como você realmente age, não no que seria "correto" fazer.', ...mc(['Sigo à risca, mesmo que pareça engessado', 'Sigo no começo, depois adapto para meu estilo', 'Uso só como referência e faço do meu jeito', 'Só sigo se fizer sentido lógico pra mim']) },
  { id: 2, ...b(1), text: 'Em uma call que está "morna", você tende a:', hint: 'Call morna = lead não engajado, sem energia, respostas curtas.', ...mc(['Acelerar e puxar para decisão', 'Buscar mais conexão emocional', 'Explicar melhor a lógica do produto', 'Manter estrutura e ritmo sem forçar']) },
  { id: 3, ...b(1), text: 'Quando alguém questiona sua autoridade:', hint: 'Ex: lead questiona se você tem experiência, ou colega desautoriza na frente de outros.', ...mc(['Confronto diretamente', 'Tensiono silenciosamente por dentro', 'Explico racionalmente meu ponto', 'Recuo e reorganizo minha abordagem']) },
  { id: 4, ...b(1), text: 'Diante de uma meta que parece impossível:', ...mc(['Aceito o desafio e vou com tudo', 'Procuro aliados e suporte do time', 'Analiso os números e monto estratégia', 'Questiono se a meta é realista antes de agir']) },
  { id: 5, ...b(1), text: 'Quando há mudança de processo sem aviso:', hint: 'Ex: mudam o CRM, alteram o script ou trocam a régua de comissão do nada.', ...mc(['Adapto rápido e sigo', 'Fico incomodado mas não reclamo', 'Questiono a lógica da mudança', 'Resisto até entender o porquê']) },
  { id: 6, ...b(1), text: 'Em reunião de equipe, você normalmente:', ...mc(['Lidera a discussão', 'Motiva e engaja o grupo', 'Ouve mais do que fala', 'Faz perguntas técnicas e detalhadas']) },
  { id: 7, ...b(1), text: 'Quando recebe feedback negativo de um gestor:', hint: 'Pense na sua reação imediata, não na que vem depois de processar.', ...mc(['Defendo meu ponto imediatamente', 'Aceito e internamente me cobro muito', 'Peço exemplos concretos para entender', 'Processo em silêncio e ajusto depois']) },
  { id: 8, ...b(1), text: 'O que mais te motiva no trabalho?', hint: 'Escolha o que realmente te move no dia a dia, não o que soa melhor.', ...mc(['Resultados e reconhecimento', 'Relacionamentos e ambiente', 'Domínio técnico e aprendizado', 'Estabilidade e previsibilidade']) },
  { id: 9, ...b(1), text: 'Em situação de conflito com colega:', ...mc(['Resolvo na hora, direto', 'Evito confronto e busco harmonia', 'Analiso quem tem razão antes de agir', 'Espero esfriar para conversar']) },
  { id: 10, ...b(1), text: 'Como você organiza seu dia de trabalho?', hint: 'Pense no que você realmente faz, não no que gostaria de fazer.', ...mc(['Priorizo por urgência e impacto', 'Vou conforme o fluxo e energia do dia', 'Sigo checklist detalhado', 'Planejo com antecedência e sigo rigorosamente']) },
  { id: 11, ...b(1), text: 'Quando um lead cancela em cima da hora:', ...mc(['Fico irritado e já busco o próximo', 'Me frustro mas mantenho bom humor', 'Analiso o que deu errado', 'Sigo o processo normal de follow-up']) },
  { id: 12, ...b(1), text: 'Você prefere trabalhar:', ...mc(['Sozinho, com autonomia total', 'Em equipe, com troca constante', 'Com dados e métricas claras', 'Com rotina definida e papéis claros']) },
  { id: 13, ...b(1), text: 'Quando precisa apresentar resultados:', ...mc(['Vou direto aos números e conquistas', 'Conto a história por trás dos resultados', 'Mostro análise detalhada com contexto', 'Apresento de forma organizada e cautelosa']) },
  { id: 14, ...b(1), text: 'Se você erra em uma call importante:', hint: 'Ex: esqueceu uma informação, falou o preço errado, perdeu o timing.', ...mc(['Corrijo na hora e sigo em frente', 'Fico pensando nisso o dia todo', 'Analiso o erro tecnicamente depois', 'Me cobro internamente mas não demonstro']) },
  { id: 15, ...b(1), text: 'O que mais te frustra em um processo de vendas?', ...mc(['Burocracia e lentidão', 'Falta de conexão com o lead', 'Informações incompletas ou confusas', 'Mudanças constantes sem motivo claro']) },
  { id: 16, ...b(1), text: 'Quando o gestor te pede para mudar sua abordagem:', hint: 'Ex: te pedem para ser mais agressivo, ou mais consultivo, ou mudar o pitch.', ...mc(['Testo rápido e vejo se funciona', 'Aceito para manter a relação', 'Quero entender a lógica antes', 'Sigo, mas volta para meu jeito se não funcionar']) },
  { id: 17, ...b(1), text: 'Em uma negociação difícil, você:', hint: 'Negociação difícil = lead resistente, objeções fortes, pressão por desconto.', ...mc(['Pressiona pela decisão', 'Tenta criar empatia e conexão', 'Argumenta com lógica e dados', 'Mantém postura firme mas paciente']) },
  { id: 18, ...b(1), text: 'Se te pedem para fazer algo fora da sua função:', ...mc(['Faço se for para ganhar', 'Faço se alguém precisar de ajuda', 'Questiono se faz sentido', 'Faço mas registro que não era minha função']) },
  { id: 19, ...b(1), text: 'Você se descreve mais como:', hint: 'Pense em como você realmente é, não em como gostaria de ser visto.', ...mc(['Competitivo e direto', 'Carismático e comunicativo', 'Analítico e observador', 'Consistente e confiável']) },
  { id: 20, ...b(1), text: 'Quando está sob muita pressão:', hint: 'Pense em semanas de meta apertada ou cobrança intensa da liderança.', ...mc(['Fico mais focado e agressivo', 'Procuro apoio emocional', 'Me isolo para pensar', 'Sigo a rotina com mais rigidez']) },
  { id: 21, ...b(1), text: 'O que te faz perder a paciência?', ...mc(['Lentidão e indecisão', 'Frieza e falta de humanidade', 'Desorganização e erros bobos', 'Falta de previsibilidade']) },
  { id: 22, ...b(1), text: 'Se uma venda está demorando muito:', hint: 'Ex: lead que já teve 3+ calls e ainda não decidiu.', ...mc(['Dou ultimato ou avanço', 'Mantenho relacionamento e espero', 'Reavario a estratégia com dados', 'Sigo o processo sem apressar']) },
  { id: 23, ...b(1), text: 'Você lida melhor com:', ...mc(['Desafios grandes e competitivos', 'Pessoas e conexões', 'Problemas complexos e técnicos', 'Tarefas claras e bem definidas']) },
  { id: 24, ...b(1), text: 'Quando alguém do time pede ajuda:', ...mc(['Ajudo se for rápido', 'Paro tudo para ajudar', 'Ajudo se for algo técnico que domino', 'Ajudo seguindo meu próprio ritmo']) },
  { id: 25, ...b(1), text: 'O que seus colegas diriam sobre você?', hint: 'Pense no que realmente diriam, não no que você gostaria que dissessem.', ...mc(['Determinado e forte', 'Animado e inspirador', 'Inteligente e detalhista', 'Calmo e confiável']) },

  // ===== BLOCO 2 – ENEAGRAMA (20) =====
  { id: 26, ...b(2), text: 'O que mais te incomoda em uma call difícil?', hint: 'Escolha o que te gera mais desconforto emocional, não racional.', ...mc(['Perder o controle da situação', 'Não ser reconhecido pelo esforço', 'Não entender exatamente o que está acontecendo', 'Sentir que o lead não confia em você', 'Ficar exposto ou vulnerável']) },
  { id: 27, ...b(2), text: 'Quando você perde uma venda importante, o que sente primeiro?', ...ot },
  { id: 28, ...b(2), text: 'Você prefere:', hint: 'Não pense no que é "melhor" — pense no que você realmente busca no fundo.', ...mc(['Ser admirado pelo time', 'Ser respeitado pela competência', 'Ter segurança e estabilidade', 'Ser necessário e indispensável', 'Ser independente e autossuficiente']) },
  { id: 29, ...b(2), text: 'O que você faz quando sente que não está performando bem?', hint: 'Pense na sua reação automática, aquela que vem antes de você pensar racionalmente.', ...mc(['Dobro o esforço e busco resultado', 'Procuro validação de alguém', 'Me recolho e analiso sozinho', 'Fico ansioso e busco controle', 'Mudo de estratégia imediatamente']) },
  { id: 30, ...b(2), text: 'Qual é seu maior medo no trabalho?', ...ot },
  { id: 31, ...b(2), text: 'O que te faz sentir mais realizado?', ...mc(['Bater meta e ser o melhor', 'Ajudar alguém a ter resultado', 'Dominar um assunto profundamente', 'Ter previsibilidade e estabilidade', 'Ter liberdade de ação']) },
  { id: 32, ...b(2), text: 'Quando você está num dia ruim, como as pessoas percebem?', hint: 'Pense no que os outros notam, não no que você acha que demonstra.', ...mc(['Fico impaciente e direto demais', 'Fico carente de validação', 'Me isolo completamente', 'Fico controlador e rígido', 'Fico disperso e distraído']) },
  { id: 33, ...b(2), text: 'O que você busca de verdade na sua carreira?', ...ot },
  { id: 34, ...b(2), text: 'Quando você vê alguém do time vendendo mais que você:', hint: 'Seja honesto com sua reação interna, mesmo que não demonstre externamente.', ...mc(['Fico competitivo e quero ultrapassar', 'Fico feliz mas me comparo internamente', 'Analiso o que a pessoa faz de diferente', 'Não me afeta muito, sigo meu ritmo', 'Questiono se estou no caminho certo']) },
  { id: 35, ...b(2), text: 'Sua reação quando te elogiam em público:', ...mc(['Gosto e quero mais', 'Fico constrangido mas gosto', 'Prefiro elogio técnico e específico', 'Acho desnecessário mas aceito', 'Me questiono se é verdade']) },
  { id: 36, ...b(2), text: 'O que te faz levantar da cama todos os dias para vender?', ...ot },
  { id: 37, ...b(2), text: 'Você se identifica mais com qual frase?', hint: 'Escolha a frase que mais ressoa com seu impulso interno, não com sua função.', ...mc(['Eu preciso vencer', 'Eu preciso ser visto', 'Eu preciso entender', 'Eu preciso ter controle', 'Eu preciso ser livre']) },
  { id: 38, ...b(2), text: 'Em momentos de crise na empresa, você:', ...mc(['Assume a liderança', 'Cuida das pessoas ao redor', 'Busca informação e dados', 'Fica alerta e desconfiado', 'Se distancia emocionalmente']) },
  { id: 39, ...b(2), text: 'O que você faz quando não concorda com uma decisão da liderança?', hint: 'Pense na última vez que isso aconteceu. O que você fez de verdade?', ...mc(['Confronto e expresso', 'Aceito mas fico frustrado', 'Analiso e questiono com dados', 'Obedeço mas guardo opinião', 'Ignoro e sigo fazendo do meu jeito']) },
  { id: 40, ...b(2), text: 'Qual é a emoção que você mais evita sentir?', ...ot },
  { id: 41, ...b(2), text: 'Quando precisa pedir ajuda:', hint: 'Pense em situações reais de trabalho, não em teoria.', ...mc(['Evito ao máximo, resolvo sozinho', 'Peço naturalmente', 'Peço apenas se for técnico', 'Peço apenas se confiar muito na pessoa', 'Tento resolver de outro jeito antes']) },
  { id: 42, ...b(2), text: 'O que te faz mais ansioso no processo de venda?', hint: 'Identifique o que gera ansiedade real no seu corpo, não só desconforto intelectual.', ...mc(['Não ter controle sobre o resultado', 'A possibilidade de rejeição', 'Falta de informação do lead', 'Imprevisibilidade do processo', 'Ter que depender de outros']) },
  { id: 43, ...b(2), text: 'Se pudesse mudar uma coisa em você como vendedor, o que seria?', ...ot },
  { id: 44, ...b(2), text: 'O que mais te magoa no ambiente de trabalho?', hint: 'Magoa = algo que te afeta emocionalmente de verdade, não só incomoda.', ...mc(['Injustiça', 'Indiferença', 'Incompetência', 'Traição de confiança', 'Invasão do meu espaço']) },
  { id: 45, ...b(2), text: 'Como você recarrega sua energia depois de um dia difícil?', ...ot },

  // ===== BLOCO 3 – VÍCIOS EMOCIONAIS (20) =====
  { id: 46, ...b(3), text: 'Quando o lead diz "vou pensar", você:', hint: 'Pense na sua reação real, não na técnica que te ensinaram.', ...mc(['Explica melhor o valor', 'Pergunta o que falta para decidir', 'Oferece um incentivo ou desconto', 'Aceita e agenda follow-up', 'Sente irritação ou frustração interna']) },
  { id: 47, ...b(3), text: 'Você já deu desconto antes de o lead pedir?', ...yn },
  { id: 48, ...b(3), text: 'Se sim, por que você deu desconto antecipadamente?', ...ot },
  { id: 49, ...b(3), text: 'Você sente desconforto com silêncio após falar o preço?', hint: 'Pense no momento exato em que você fala o valor e espera a reação do lead.', ...scale(0, 10, 'Nenhum desconforto', 'Desconforto extremo') },
  { id: 50, ...b(3), text: 'Quando sente que o lead vai dizer não, você:', hint: 'Pense naquele momento em que você "sabe" que vai perder — o que seu corpo faz?', ...mc(['Antecipa e tenta reverter', 'Fica ansioso e fala mais do que deveria', 'Aceita antes mesmo do lead falar', 'Mantenho postura e espero a resposta']) },
  { id: 51, ...b(3), text: 'Você costuma se justificar quando o lead questiona o preço?', hint: 'Justificar = explicar demais, dar razões, se defender. Diferente de argumentar valor.', ...mc(['Sempre', 'Na maioria das vezes', 'Às vezes', 'Raramente', 'Nunca']) },
  { id: 52, ...b(3), text: 'O que você sente quando um lead te ignora no follow-up?', ...ot },
  { id: 53, ...b(3), text: 'Você já prolongou uma call por medo de perder o lead?', ...yn },
  { id: 54, ...b(3), text: 'Quando sente que não vai bater a meta do mês:', hint: 'Pense nas últimas vezes que esteve abaixo da meta na terceira semana do mês.', ...mc(['Fico mais agressivo nas calls', 'Fico desmotivado e desacelero', 'Mudo a estratégia', 'Aceito e foco no próximo mês', 'Fico ansioso e perco qualidade']) },
  { id: 55, ...b(3), text: 'Você evita fazer calls em determinados horários por ansiedade?', ...yn },
  { id: 56, ...b(3), text: 'Quando percebe que está perdendo a call, o que sente no corpo?', ...ot },
  { id: 57, ...b(3), text: 'Você se pega concordando com objeções do lead para evitar conflito?', hint: 'Ex: o lead diz "tá caro" e você concorda antes de argumentar.', ...scale(0, 10, 'Nunca faço isso', 'Faço isso sempre') },
  { id: 58, ...b(3), text: 'Depois de uma call ruim, quanto tempo leva para se recuperar?', hint: 'Recuperar = voltar ao estado emocional normal para fazer a próxima call com qualidade.', ...mc(['Minutos - já parto pra próxima', 'Uma hora ou mais', 'Fico o dia todo afetado', 'Vários dias pensando nisso']) },
  { id: 59, ...b(3), text: 'Você sente necessidade de o lead gostar de você?', hint: 'Reflita: essa necessidade influencia suas decisões durante a negociação?', ...scale(0, 10, 'Não preciso', 'Preciso muito') },
  { id: 60, ...b(3), text: 'Qual é o padrão que você mais repete em calls que dão errado?', ...ot },
  { id: 61, ...b(3), text: 'Você já evitou falar preço por medo da reação do lead?', ...yn },
  { id: 62, ...b(3), text: 'Quando um lead elogia seu atendimento mas não compra, como se sente?', ...ot },
  { id: 63, ...b(3), text: 'Você costuma levar rejeição profissional para o lado pessoal?', hint: 'Pense nas últimas vezes que perdeu uma venda. Quanto isso te afetou fora do trabalho?', ...scale(0, 10, 'Nunca', 'Sempre') },
  { id: 64, ...b(3), text: 'Qual vício emocional você acha que mais atrapalha sua venda?', hint: 'Vício emocional = padrão automático que você repete sem perceber e que sabota seu resultado.', ...mc(['Necessidade de aprovação', 'Medo de confronto', 'Ansiedade por resultado', 'Perfeccionismo', 'Procrastinação emocional']) },
  { id: 65, ...b(3), text: 'O que te faz travar emocionalmente durante uma venda?', ...ot },

  // ===== BLOCO 4 – ROTINA E DISCIPLINA (15) =====
  { id: 66, ...b(4), text: 'Você estuda o script antes de cada call?', hint: 'Estudar = revisar ativamente, não apenas ter lido uma vez.', ...mc(['Sempre', 'Às vezes', 'Só quando lembro', 'Nunca']) },
  { id: 67, ...b(4), text: 'Quantas vezes você revisou suas últimas 5 calls?', type: 'open-text', placeholder: 'Digite um número...' },
  { id: 68, ...b(4), text: 'Se ninguém te cobrasse meta, você manteria o ritmo?', hint: 'Imagine que sua meta sumiu e ninguém vai te cobrar. O que muda?', ...mc(['Sim, com certeza', 'Não, preciso de pressão', 'Depende do momento']) },
  { id: 69, ...b(4), text: 'O que te faz quebrar sua rotina de trabalho?', ...ot },
  { id: 70, ...b(4), text: 'Você tem um ritual de preparação antes de calls importantes?', ...yn },
  { id: 71, ...b(4), text: 'Se sim, qual é esse ritual?', ...ot },
  { id: 72, ...b(4), text: 'Você acompanha suas próprias métricas diariamente?', hint: 'Métricas = taxa de conversão, nº de calls, ticket médio, etc.', ...mc(['Sim, obsessivamente', 'Sim, de vez em quando', 'Só quando cobram', 'Não acompanho']) },
  { id: 73, ...b(4), text: 'Qual a primeira coisa que você faz ao iniciar o dia de trabalho?', ...ot },
  { id: 74, ...b(4), text: 'Você consegue manter consistência por mais de 30 dias seguidos?', hint: 'Consistência = mesmo nível de energia, disciplina e resultado todos os dias.', ...mc(['Sim, naturalmente', 'Sim, mas com esforço', 'Começo bem mas perco ritmo', 'Não consigo manter']) },
  { id: 75, ...b(4), text: 'O que mais sabota sua disciplina?', hint: 'Pense no que te tira do trilho com mais frequência.', ...mc(['Distrações externas', 'Falta de motivação', 'Cansaço emocional', 'Falta de cobrança', 'Problemas pessoais']) },
  { id: 76, ...b(4), text: 'Você faz warm-up antes de começar as calls do dia?', hint: 'Warm-up = qualquer atividade para entrar no estado mental ideal antes de ligar.', ...mc(['Sim, sempre', 'Às vezes', 'Não, vou direto']) },
  { id: 77, ...b(4), text: 'Qual o horário do dia em que você performa melhor?', ...mc(['Manhã (8h-12h)', 'Início da tarde (13h-15h)', 'Final da tarde (15h-18h)', 'Noite (após 18h)']) },
  { id: 78, ...b(4), text: 'O que acontece com sua performance depois do almoço?', ...mc(['Mantém o mesmo nível', 'Cai bastante', 'Varia muito', 'Melhora']) },
  { id: 79, ...b(4), text: 'Você tem um sistema para gerenciar seus leads/pipeline?', ...mc(['Sim, bem organizado', 'Sim, mas bagunçado', 'Uso o CRM por obrigação', 'Não tenho sistema']) },
  { id: 80, ...b(4), text: 'O que você faz nos últimos 30 minutos do dia de trabalho?', ...ot },

  // ===== BLOCO 5 – COMPORTAMENTO EM CALL (20) =====
  { id: 81, ...b(5), text: 'Nos primeiros 30 segundos da call, o que você prioriza?', ...mc(['Gerar autoridade e posicionamento', 'Criar conexão e rapport', 'Fazer perguntas para entender o cenário', 'Seguir o script de abertura']) },
  { id: 82, ...b(5), text: 'Quando o lead fala mais que você na call:', ...mc(['Fico impaciente e retomo o controle', 'Gosto e deixo fluir', 'Escuto mas mentalmente organizo contrapontos', 'Espero pacientemente']) },
  { id: 83, ...b(5), text: 'Sua call ideal dura:', ...mc(['15-20 minutos (direto ao ponto)', '30-40 minutos (com rapport)', '40-60 minutos (consultiva detalhada)', 'Sem tempo fixo (depende do lead)']) },
  { id: 84, ...b(5), text: 'Quando o lead traz uma objeção inesperada:', hint: 'Objeção que você nunca ouviu ou que te pega desprevenido.', ...mc(['Respondo na hora com confiança', 'Ganho tempo e busco empatia', 'Peço um momento para pensar', 'Sigo o framework de contorno']) },
  { id: 85, ...b(5), text: 'Você grava e escuta suas próprias calls?', ...mc(['Sim, regularmente', 'Às vezes', 'Só quando pedem', 'Nunca']) },
  { id: 86, ...b(5), text: 'Como você lida com o silêncio durante a call?', hint: 'Silêncio = aquela pausa de 3-5 segundos depois de uma pergunta ou proposta.', ...mc(['Uso a meu favor (deixo o lead pensar)', 'Fico desconfortável e preencho', 'Depende da situação', 'Evito que aconteça']) },
  { id: 87, ...b(5), text: 'Quando o lead pergunta "quanto custa?", você:', ...mc(['Falo o preço direto', 'Contexto antes com valor', 'Faço mais perguntas antes', 'Depende do momento da call']) },
  { id: 88, ...b(5), text: 'O que mais te atrapalha durante uma call?', ...ot },
  { id: 89, ...b(5), text: 'Você adapta seu tom de voz conforme o perfil do lead?', hint: 'Ex: mais energia com leads animados, mais calma com leads analíticos.', ...mc(['Sim, naturalmente', 'Tento mas nem sempre consigo', 'Não penso nisso', 'Mantenho meu tom padrão']) },
  { id: 90, ...b(5), text: 'Quando percebe que está perdendo o lead:', ...mc(['Aumento a urgência', 'Mudo de abordagem', 'Faço uma pergunta provocativa', 'Aceito e finalizo profissionalmente']) },
  { id: 91, ...b(5), text: 'Quantas perguntas de diagnóstico você faz em média por call?', ...mc(['1-3 (vou direto)', '4-6 (equilíbrio)', '7-10 (detalhista)', '10+ (muito investigativo)']) },
  { id: 92, ...b(5), text: 'Você usa histórias/cases durante a call?', ...mc(['Sim, sempre', 'Às vezes', 'Raramente', 'Nunca']) },
  { id: 93, ...b(5), text: 'Como você encerra uma call que não vai fechar?', ...ot },
  { id: 94, ...b(5), text: 'Você sente diferença de performance entre calls por telefone vs vídeo?', ...mc(['Sim, sou melhor por telefone', 'Sim, sou melhor por vídeo', 'Não noto diferença', 'Depende do lead']) },
  { id: 95, ...b(5), text: 'O que te dá mais segurança antes de uma call?', ...mc(['Conhecer bem o lead/empresa', 'Ter o script pronto', 'Estar motivado', 'Ter batido meta']) },
  { id: 96, ...b(5), text: 'Quando o lead menciona o concorrente:', ...mc(['Ataco os pontos fracos do concorrente', 'Reposiciono nosso valor sem comparar', 'Peço mais detalhes sobre a experiência', 'Ignoro e sigo meu pitch']) },
  { id: 97, ...b(5), text: 'Você faz anotações durante a call?', ...mc(['Sim, detalhadas', 'Sim, pontos-chave', 'Às vezes', 'Não, confio na memória']) },
  { id: 98, ...b(5), text: 'Como você pede o fechamento?', hint: 'Pense na sua forma natural de pedir o "sim".', ...mc(['Direto: "Vamos fechar?"', 'Assumptivo: "Quando começamos?"', 'Sutil: conduzo até o lead decidir', 'Depende da situação']) },
  { id: 99, ...b(5), text: 'O que você faz imediatamente após uma call boa?', ...ot },
  { id: 100, ...b(5), text: 'O que você faz imediatamente após uma call ruim?', ...ot },

  // ===== BLOCO 6 – ESTILO NATURAL (10) =====
  { id: 101, ...b(6), text: 'Em uma palavra, como você se descreveria como vendedor?', type: 'open-text', placeholder: 'Uma palavra...' },
  { id: 102, ...b(6), text: 'Qual tipo de lead você vende melhor?', ...mc(['Decisor direto e objetivo', 'Pessoa relacional e empática', 'Analítico que quer dados', 'Cauteloso que precisa de confiança']) },
  { id: 103, ...b(6), text: 'E qual tipo de lead é mais difícil pra você?', ...mc(['O muito direto/agressivo', 'O frio/distante', 'O confuso/indeciso', 'O técnico demais']) },
  { id: 104, ...b(6), text: 'Você se considera mais:', ...mc(['Hunter (caçador de novas oportunidades)', 'Farmer (cultiva relacionamentos longos)', 'Um pouco dos dois']) },
  { id: 105, ...b(6), text: 'Como você lida com metas individuais vs metas de equipe?', ...mc(['Prefiro individual - compito comigo mesmo', 'Prefiro equipe - gosto de colaborar', 'Gosto dos dois', 'Não me importo com formato']) },
  { id: 106, ...b(6), text: 'O que te diferencia dos outros vendedores do time?', ...ot },
  { id: 107, ...b(6), text: 'Qual feedback você mais recebe dos leads?', ...ot },
  { id: 108, ...b(6), text: 'Se pudesse escolher, você venderia:', ...mc(['Produtos de ticket alto (poucos, mas grandes)', 'Produtos de ticket baixo (volume alto)', 'Serviços complexos (consultivos)', 'Qualquer coisa que me desafie']) },
  { id: 109, ...b(6), text: 'Você vende melhor quando está:', ...mc(['Sob pressão', 'Relaxado e sem cobrança', 'Em competição com alguém', 'Depende do dia']) },
  { id: 110, ...b(6), text: 'Se você fosse um animal de vendas, qual seria?', hint: 'Pense no animal que mais representa seu estilo natural de vender.', ...ot },

  // ===== BLOCO 7 – PERGUNTAS SITUACIONAIS (10) =====
  { id: 111, ...b(7), text: 'Um lead te diz: "Gostei muito, mas preciso falar com meu sócio". O que você faz?', ...ot },
  { id: 112, ...b(7), text: 'Você está a 3 dias do fim do mês e faltam 2 vendas para bater a meta. O que muda na sua abordagem?', ...ot },
  { id: 113, ...b(7), text: 'Um lead te liga furioso com um problema no produto. Como você age?', ...ot },
  { id: 114, ...b(7), text: 'Seu gestor te diz que seu fechamento está fraco. Qual sua reação?', ...ot },
  { id: 115, ...b(7), text: 'Você descobre que um colega está usando técnicas antiéticas para vender mais. O que faz?', ...ot },
  { id: 116, ...b(7), text: 'O lead diz que o concorrente é 40% mais barato. Como você responde?', ...ot },
  { id: 117, ...b(7), text: 'Você tem 2 calls marcadas no mesmo horário. Uma é com um lead quente e a outra é com seu maior cliente ativo. Qual prioriza e por quê?', ...ot },
  { id: 118, ...b(7), text: 'Depois de 3 meses consecutivos batendo meta, você tem o pior mês da carreira. O que aconteceu internamente?', ...ot },
  { id: 119, ...b(7), text: 'Se você pudesse voltar no tempo e dar um conselho ao "você vendedor do primeiro dia", o que diria?', ...ot },
  { id: 120, ...b(7), text: 'Qual foi a venda mais difícil da sua carreira e o que ela te ensinou?', ...ot },
];

export const MIN_CHARS = 50;
