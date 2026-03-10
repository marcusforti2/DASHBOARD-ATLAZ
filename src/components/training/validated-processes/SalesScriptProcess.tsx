import { StepSection } from "./StepSection";
import { ScriptCard, DialogueCard } from "./ScriptCard";
import { FadeIn } from "./FadeIn";
import { Target, Users, Brain, Shield, Gift, Flame, Rocket, Star, TrendingUp, MessageCircle, CreditCard, AlertTriangle, CheckCircle, Zap, ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

/* ── Sticky Nav ── */
const navItems = [
  { label: "Preparação", href: "#preparacao" },
  { label: "Rapport", href: "#rapport" },
  { label: "Diagnóstico", href: "#diagnostico" },
  { label: "Consultoria", href: "#consultoria" },
  { label: "Pactos", href: "#pactos" },
  { label: "Oferta", href: "#oferta" },
  { label: "Objeções", href: "#objecoes" },
];

function ScriptNav({ onBack }: { onBack: () => void }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.getElementById("script-scroll-container");
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 60);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? "bg-card/95 backdrop-blur-md border-b border-border" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
        <button onClick={onBack} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ChevronLeft size={16} /> Voltar
        </button>
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hero ── */
function HeroSection() {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px] pointer-events-none" />
      <div className="relative z-10 container max-w-4xl mx-auto px-6 text-center">
        <FadeIn>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground font-medium">Processo Validado — Script Completo</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
            <span className="text-foreground">Script de</span><br />
            <span className="text-primary">Vendas</span>
          </h1>
        </FadeIn>
        <FadeIn delay={0.3}>
          <p className="text-muted-foreground text-lg md:text-xl max-w-lg mx-auto mb-10 leading-relaxed">
            O playbook completo para fechar vendas de alto ticket com consistência e maestria.
          </p>
        </FadeIn>
        <FadeIn delay={0.45}>
          <motion.a
            href="#preparacao"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary text-primary-foreground font-semibold text-base shadow-lg transition-all"
          >
            Começar o Script
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </motion.a>
        </FadeIn>
        <FadeIn delay={0.6}>
          <div className="mt-20 grid grid-cols-2 md:grid-cols-5 gap-3 max-w-2xl mx-auto">
            {["Preparação", "Rapport", "Diagnóstico", "Oferta", "Fechamento"].map((step, i) => (
              <div key={step} className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-muted-foreground font-medium">
                <span className="text-primary font-bold mr-1">{i + 1}.</span>{step}
              </div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

/* ── Section Divider ── */
const SectionDivider = () => (
  <div className="w-full h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)" }} />
);

/* ── Main Sales Script Component ── */
export function SalesScriptProcess({ onBack }: { onBack: () => void }) {
  return (
    <div id="script-scroll-container" className="h-full overflow-y-auto bg-background" style={{ scrollBehavior: "smooth" }}>
      <ScriptNav onBack={onBack} />
      <HeroSection />
      <SectionDivider />

      {/* 1 - PREPARAÇÃO PRÉ VENDAS */}
      <StepSection id="preparacao" number="01" title="Preparação Pré Vendas" subtitle="(5min)">
        <ScriptCard items={[
          "Ouvir uma música inspiradora",
          "Café + água",
          "Olhar todas as redes do lead (linkedin/instagram) e conhecer melhor",
          "Fazer uma oração pedindo que atraia as pessoas que precisam do nosso produto",
          "Passar alfazema na mão e no pé",
          "Olhar seus maiores troféus escrito no post it na sua frente",
        ]} />
      </StepSection>

      <SectionDivider />

      {/* 2 - RAPPORT */}
      <StepSection id="rapport" number="02" title="Rapport" subtitle="(aprox: 10/15 minutos)">
        <FadeIn>
          <div className="space-y-6 text-secondary-foreground leading-relaxed">
            <p>Gastar tempo nessa fase, por isso antes de toda reunião precisa ter essas informações:</p>
            <p>Busque sempre de 3 a 5 informações que possa conectar e fazer o lead falar dele. Crie pontos de conexão, assuntos em comum, faça ele se ver em você, faça com que ele se sinta amigo, gostam das mesmas coisas, fizeram as mesmas experiências, Qual ponto mais relevante fará o lead sentir confiança em você?</p>
            <p>Busque pontos em comum e mostre que pesquisou sobre o lead, faça ele falar da vida dele sem foco no trabalho ou projeto em questão.</p>
            <p>Ser observador e curioso. Você precisa criar um espelhamento do lead, ele precisa se ver em você. Conectamos com o semelhante, aqui o lead vai confiar em você.</p>
            <p>Além do espelhamento faça as rotulagem, comente sobre as informações que o lead te deu, expanda mais o assunto antes de ir pra próxima pergunta, detalhe mais informações, mostre que tem escuta ativa e se importa com isso, assim o lead vai assimilar que você não está só querendo vender e pode confiar em você.</p>
          </div>
        </FadeIn>
        <ScriptCard warning="NÃO PASSAR DESSA ETAPA ATÉ CONECTAR COM ⅔ PONTOS, FAZER O CLIENTE RIR E CONECTAR COM VOCÊ." />
        <ScriptCard items={[
          "Onde o cliente mora?",
          "Quais informações relevantes tem no sobre do linkedin?",
          "Quais empresas ele passou?",
          "Qual data de aniversário? (pode usar para conectar se for o mesmo signo)",
          "Além de trabalhar bastante, o que você faz aí no seu bairro? Quais os seus hobbies?",
          "Analisa e comenta sobre o que aparece na câmera do lead, objetos, quadros etc",
        ]} />
        <FadeIn delay={0.1}>
          <h3 className="text-2xl font-semibold mt-8 mb-4">Exemplos de Abertura</h3>
        </FadeIn>
        <DialogueCard lines={[
          { text: "Oi, Lead. Tudo bem?" },
          { text: "De onde está falando? Mas você nasceu aí mesmo?" },
          { text: "Gostei desse fundo aí, o que é isso? Qual livro? é tal objeto ali?" },
          { text: "Eu vi que torce pro time X… Gosto muito de futebol também." },
          { text: "Eu vi que você gosta de X, Adoro isso, como foi sua experiencia?" },
        ]} />
        <FadeIn delay={0.1}>
          <div className="mt-6 rounded-2xl bg-card border border-primary/20 p-6">
            <h4 className="text-xl font-semibold text-primary mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" /> Apreciação Sincera
            </h4>
            <div className="space-y-3 text-secondary-foreground italic">
              <p>"Vi no seu linkedin que só tem +20 anos de experiência neste nicho kkkk. Como você começou a fazer isso?"</p>
              <p>"Vi que já passou na empresa X, Como foi essa experiência?"</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-4 rounded-2xl bg-card border border-border p-6">
            <h4 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" /> Transição
            </h4>
            <p className="text-secondary-foreground italic">"A vida é muito boa né?"</p>
            <p className="text-secondary-foreground italic mt-2">"Agora vou te mostrar aqui sobre o negócio para você conhecer melhor."</p>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 3 - RESULTADOS */}
      <StepSection id="resultados" number="03" title="Resultados" subtitle="(aprox: 5/10 minutos) — Aqui mais importante é o lead saber que somos muito grandes, estrutura, resultados, todos os troféus que temos.">
        <FadeIn>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
              <h3 className="text-2xl font-bold">ALEXIS</h3>
            </div>
            <ul className="space-y-3 text-secondary-foreground">
              {["Trabalho com vendas há 8 anos.", "Atuei diretamente no setor comercial do Caio Carneiro, vendendo tikcet de 20k até 400k anual.", "Mais de 10 milhões de faturamento gerado ao longo de toda a trajetória.", "Ajudei a fundar o canal de venda ativa no Vende-C: 100% indicação.", "Fez todas as formações comerciais do vende-c.", "Fez o G4 Skills - aceleração comercial.", "Pegou toda essa bagagem e trouxe para atlas, assumindo como head comercial."].map((item, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-primary mt-1 shrink-0">▸</span> {item}</li>
              ))}
            </ul>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-6 md:p-8">
            <h3 className="text-2xl font-bold text-primary mb-6">ATLAS</h3>
            <ul className="space-y-3 text-secondary-foreground">
              {["1 ano no mercado - 2M FATURADOS COM 4 PESSOAS NA EQUIPE", "Construímos diversos cases de sucesso", "Membro da MLS - GRUPO DO FLÁVIO AUGUSTO", "2 clientes na MLS - DEPOIS QUE VIROU NOSSO CLIENTE", "Temos evento todo mês no escritório do brooklin", "Encontramos nossos clientes todo mês com eventos sociais e de experiência gastronómica.", "Canal de podcast próprio"].map((item, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-primary mt-1 shrink-0">▸</span> {item}</li>
              ))}
            </ul>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Target className="w-5 h-5 text-primary" /></div>
              <h3 className="text-2xl font-bold">JACOB</h3>
            </div>
            <ul className="space-y-3 text-secondary-foreground">
              {["Quando tinha 16 anos, começou a vender viagens para Disney durante 4 anos, foi top 1 vendedor todos os anos.", "Fundou uma startup onde atendeu +500 clientes ativos", "Passou pelos bastidores de grandes players, inclusive projetos envolvendo Flavio Augusto, Caio Carneiro e Joel Jota.", "Após atuar nos bastidores de grandes players, criou sua metodologia própria e fundou a Atlas, fechando o primeiro ano com 2M faturados com 4 colaboradores."].map((item, i) => (
                <li key={i} className="flex items-start gap-2"><span className="text-primary mt-1 shrink-0">▸</span> {item}</li>
              ))}
            </ul>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="mt-4 rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" /> Pacto de Transição Para Questionário
            </h4>
            <p className="text-muted-foreground text-sm mb-4">(6 a 8 minutos)</p>
            <p className="text-secondary-foreground italic mb-6">"[lead] deixa eu te explicar como vai funcionar esse bate papo aqui hoje, que é dividido em 3 fases…"</p>
            <ol className="space-y-5 text-secondary-foreground">
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-primary text-primary-foreground shrink-0">1</span>
                <span>Primeira fase, nós vamos levantar um diagnóstico do seu negócio aqui hoje, entender os dados, os desafios que você vem enfrentando aí pra vender mais…</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-primary text-primary-foreground shrink-0">2</span>
                <span>Segundo, vou te trazer uma consultoria breve para trazer clareza dos gargalos que você vive aí hoje e entender se as suas necessidades têm FIT com a nossa metodologia…</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-primary text-primary-foreground shrink-0">3</span>
                <span>Terceiro, se eu entender que existe alguma solução da Atlas que encaixe com suas necessidades e possa acelerar seus resultados, vou te apresentar tudo aqui para você conhecer melhor nosso trabalho, nossos resultados e nossa empresa, caso não aconteça, finalizamos o call como amigos. fechou? Então temos essas 3 fases aqui, beleza?</span>
              </li>
            </ol>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 4 - DIAGNÓSTICO ESTRATÉGICO */}
      <StepSection id="diagnostico" number="04" title="Diagnóstico Estratégico">
        <div className="grid gap-4">
          {[
            { num: "1", q: "Onde você está hoje?", label: "(ponto a)" },
            { num: "2", q: "Onde quer chegar?", label: "(ponto b)" },
            { num: "3", q: "O que está fazendo para chegar lá?", label: "(comportamento)" },
            { num: "4", q: "Como está fazendo?", label: "(habilidade)" },
            { num: "5", q: "Por que quer chegar lá?", label: "(crença - motivação)" },
          ].map((item) => (
            <div key={item.num} className="flex items-center gap-5 rounded-2xl bg-card border border-border p-5">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-full text-base font-bold bg-primary text-primary-foreground shrink-0">{item.num}</span>
              <div>
                <p className="font-semibold text-lg text-foreground">{item.q}</p>
                <p className="text-muted-foreground text-sm">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
        <FadeIn delay={0.1}>
          <div className="mt-6 rounded-2xl bg-card border border-primary/20 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-secondary-foreground leading-relaxed">
                O "POR QUÊ" é munição para objeção depois. Ele quer chegar lá para ter mais tempo com a família, mais dinheiro, viajar mais, fazer seus próprios horários, ser uma referência no seu nicho. Isso aqui você vai usar pra bater no emocional dele durante a call.
              </p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <h4 className="text-xl font-semibold mt-8 mb-3">Exemplo estruturado:</h4>
        </FadeIn>
        <DialogueCard lines={[
          { text: "Onde você quer estar com esse projeto daqui a 2 anos?" },
          { text: "O que você está fazendo hoje para chegar lá?" },
          { text: "E como você está fazendo isso exatamente?" },
          { text: "Mas me fala uma coisa… por que é tão importante você chegar nesse nível?" },
        ]} />
      </StepSection>

      <SectionDivider />

      {/* 5 - CONSULTORIA + CASE ESPELHO */}
      <StepSection id="consultoria" number="05" title="Consultoria + Case Espelho">
        <FadeIn>
          <div className="space-y-4 text-secondary-foreground leading-relaxed">
            <p>Mostrar o GAP entre ponto A e ponto B.</p>
            <p>Vá com a cabeça que ele já é seu mentorado.</p>
            <p>Mostra o que faria no lugar dele.</p>
            <p>Nesse caso, o que eu faria se estivesse dentro da sua operação. Se eu fosse seu sócio. Baseado nas minhas experiências e dos nossos clientes.</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div className="space-y-4 text-secondary-foreground leading-relaxed">
                <h4 className="font-semibold text-lg text-foreground">1º — Geração de Demanda</h4>
                <p>Olharia pro setor mais importante da empresa, a máquina 1 que é a geração de demanda. O maior erro das empresas que querem crescer rápido, é focar em todas outras áreas e deixar pra bombear o sangue por último, eu costumo dizer que o parafuso mais importante da máquina e que deve ser apertado primeiro, é a construção da agenda, equilibrar volume, com leads qualificados mas é por isso que estamos aqui.</p>
                <p><strong className="text-foreground">Canal das frutas maduras</strong> — esse aqui é o responsável pelo ROI imediato, tem muita venda dentro do seu WhatsApp que já está feita, só precisa alinhar uma abordagem para sacar esse dinheiro.</p>
                <p><strong className="text-foreground">Canal de prospecção ativa no linkedin</strong> — onde trás o lead qualificado para mesa, a CAC 0.</p>
                <p><strong className="text-foreground">Canal de indicação</strong> — existem 4 momentos que deve pedir indicação e gerar leads também a custo 0 e com muito mais chance de fechamento. Aqui o principal é o gatilho de reciprocidade, é o emocional que mais vai fazer a pessoa te indicar mesmo sem ser seu cliente. Pegar indicação ao final da call, imagine a cada call que seu closer deixa de vender, se ele pegar 2 indicações, quantos leads a mais terá a custo zero? no primeiro ROI significativo, agradecimento por alguma entrega e no final do projeto, só com esse funil você consegue gerar uns 50 leads qualificados por mês a custo zero.</p>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="font-semibold text-lg text-foreground mb-3">2º — Rotina de Ações e Metas Diárias</h4>
            <p className="text-secondary-foreground leading-relaxed">
              Estruturaria uma rotina de ações e metas diárias, é o básico bem feito durante todos os dias que irá fazer com que consiga vender 1/2/3 contratos a mais.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="font-semibold text-lg text-foreground mb-3">3º — Script de Fechamento</h4>
            <p className="text-secondary-foreground leading-relaxed">
              Construiria um script de fechamento de vendas em reunião, outro erro que vejo 99% das empresas fazendo, é contratando vendedores, fazendo onboarding, treinando sobre produto, mas sem um script claro, alinhando o que ele tem que fazer durante toda reunião pra sair com e venda feita, ou seja, pagamento em call e também o perfil comportamental de cada vendedor, ideal é alinhar esses 2 pontos pra aumentar conversão para 40%, 50% ou até mais.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-6 md:p-8">
            <h4 className="text-xl font-semibold text-primary mb-4 flex items-center gap-2">
              <Star className="w-5 h-5" /> Cliente Espelho
            </h4>
            <p className="text-secondary-foreground italic text-lg mb-6">"Teve um cliente que estava exatamente no seu momento…"</p>
            <div className="rounded-xl bg-background/50 border border-primary/10 p-5">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <p className="text-foreground font-semibold">⚠ Usar as palavras do lead</p>
              </div>
              <p className="text-secondary-foreground mb-4">USAR AS MESMAS PALAVRAS QUE O LEAD USOU COM VOCÊ:</p>
              <div className="grid grid-cols-2 gap-3 text-sm text-secondary-foreground">
                {["Mesmo cenário:", "Mesma dor:", "Mesmo objetivo:", "Mesmo perfil:"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 6 - CHECAGEM DE CRENÇA */}
      <StepSection number="06" title="Checagem de Crença">
        <FadeIn>
          <div className="rounded-2xl bg-card border border-border p-6">
            <h4 className="font-semibold text-lg mb-4 text-primary">Pergunta obrigatória:</h4>
            <p className="text-secondary-foreground italic text-lg">"Com o que eu te mostrei até aqui, você acredita que a gente consegue resolver esse problema?"</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6">
            <h4 className="font-semibold text-lg mb-4">Caso tenha objeção:</h4>
            <p className="text-secondary-foreground italic text-lg">"O que exatamente está te gerando dúvida?"</p>
          </div>
        </FadeIn>
        <div className="grid md:grid-cols-2 gap-4">
          <FadeIn delay={0.15}>
            <div className="rounded-2xl bg-card border border-border p-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> Dúvida na empresa</h4>
              <p className="text-secondary-foreground">Dúvida como a entrega ajudará ele</p>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div className="rounded-2xl bg-card border border-border p-6">
              <h4 className="font-semibold mb-2 flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Dúvida nele mesmo</h4>
              <p className="text-secondary-foreground">Dúvida se ele consegue aplicar o método</p>
            </div>
          </FadeIn>
        </div>
      </StepSection>

      <SectionDivider />

      {/* 7 - PACTOS */}
      <StepSection id="pactos" number="07" title="Pactos (Obrigatório)">
        <FadeIn>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-xl font-semibold mb-4 text-primary">Pacto 1 – Prioridade</h4>
            <div className="space-y-3 text-secondary-foreground italic text-lg">
              <p>"Resolver isso hoje é prioridade real para você?"</p>
              <p>"De 0 a 10, qual o nível de prioridade?"</p>
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-muted-foreground text-sm font-medium mb-2">Caso tenha objeção:</p>
              <p className="text-secondary-foreground italic">O que seria sua prioridade hoje?</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-xl font-semibold mb-4 text-primary">Pacto 2 – Autonomia</h4>
            <p className="text-secondary-foreground italic text-lg leading-relaxed">"Se o que eu te mostrar aqui, for exatamente o que está buscando como solução e couber no seu bolso, você está no momento de iniciar hoje aqui nessa call comigo ou depende de alguém?"</p>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-muted-foreground text-sm font-medium mb-2">Se depender:</p>
              <p className="text-secondary-foreground">Encerrar call e remarcar.</p>
              <p className="text-primary font-semibold mt-1">Sem negociação.</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-xl font-semibold mb-4 text-primary">Pacto 3 – Última checagem</h4>
            <p className="text-secondary-foreground italic text-lg">"Então hoje o único fator que pode impedir é financeiro, certo?"</p>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 8 - APRESENTAÇÃO DO PRODUTO */}
      <StepSection number="08" title="Apresentação do Produto (Aceleração)">
        <ScriptCard warning="COMPARTILHAR A TELA COM TODOS ENTREGÁVEIS E EXPLICAR CADA UM." />
        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-xl font-semibold mb-4 text-primary">Micro Pacto:</h4>
            <div className="space-y-4 text-secondary-foreground italic text-lg leading-relaxed">
              <p>"Você tem alguma dúvida sobre essas entregas?"</p>
              <p>"O que mais te chamou a atenção?"</p>
              <p>"Você acredita que com tudo isso que te mostrei, conseguimos resolver seu problema de crescimento e escala?"</p>
            </div>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 9 - POR TRÁS DA CORTINA */}
      <StepSection number="09" title="Por Trás da Cortina">
        <ScriptCard items={[
          "Compartilhar Grupo WhatsApp com todos os clientes",
          "Mostrar clientes que veio do linkedin do Jacob e estão mandando depoimento no grupo",
        ]} />
      </StepSection>

      <SectionDivider />

      {/* 10 - ANCORAGEM DE VALOR */}
      <StepSection id="oferta" number="10" title="Ancoragem de Valor">
        <FadeIn>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <p className="text-secondary-foreground italic text-lg leading-relaxed">"Você acredita que com as implementações, acompanhamento individual com você e seu time, além das conexões e comunidade que irá participar. Conseguimos fazer 1 venda a mais por mês?"</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6">
            <p className="text-secondary-foreground leading-relaxed">Pegar valor médio do produto dele e fazer a conta na calculadora.</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.15}>
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-8 text-center">
            <p className="text-muted-foreground text-sm mb-2">exemplo:</p>
            <p className="text-secondary-foreground mb-4">Aqui o ideal, é pedir pro lead abrir a calculadora e fazer essa conta:</p>
            <div className="text-4xl md:text-5xl font-bold text-primary mb-2">60k × 4 meses = 240k</div>
            <p className="text-muted-foreground text-sm mb-6">nos próximos 4 meses em um cenário altamente conservador.</p>
            <p className="text-secondary-foreground italic text-lg">"Você acredita que juntos somos capazes de chegar nesse cenário?"</p>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 11 - OFERTA */}
      <StepSection number="11" title="🔟 Oferta">
        <FadeIn>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8 space-y-4 text-secondary-foreground leading-relaxed">
            <p>O investimento para iniciarmos essa parceria agora, é praticamente nada comparado ao nosso cenário conservador.</p>
            <p>Fizemos uma conta internamente e vimos que temos muito mais crescimento com clientes que estão no momento certo de começar a crescer com nossa metodologia. Por isso</p>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 12 - FECHAMENTO OPERACIONAL */}
      <StepSection number="12" title="Fechamento Operacional">
        <FadeIn>
          <div className="rounded-2xl bg-card border border-primary/30 p-8 shadow-lg shadow-primary/5">
            <h4 className="text-xl font-semibold mb-4 text-primary">Ancoragem:</h4>
            <p className="text-secondary-foreground mb-4">Colocar slide do preço na tela: 45k ou 12x de 3.818$</p>
            <div className="text-4xl font-bold text-foreground mb-1">R$ 45.000</div>
            <p className="text-muted-foreground text-sm">ou 12x de R$ 3.818</p>
            <p className="text-secondary-foreground text-sm mt-4 italic">Mudar a linguagem corporal virando pro lado e beber uma água.</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-lg font-semibold mb-2 text-muted-foreground">Normalmente terá Objeção:</h4>
            <p className="text-foreground font-semibold text-xl mb-4">Preciso pensar</p>
            <div className="space-y-4 text-secondary-foreground leading-relaxed">
              <p>Lead, quando você fala que precisa pensar. Soa que está com dúvida, aqui só pode ser sobre a entrega, isso você me falou que vai resolver seus problemas, mudou alguma coisa de lá pra cá?</p>
              <p>Ou pensar sobre a forma de pagamento. O que ficou pesado pra você. O valor a vista ou a parcela?</p>
              <p>Então, esse é o valor real do produto, mas como te disse. Temos uma condição para iniciarmos essa parceria aqui.</p>
            </div>
            <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <p className="text-foreground font-semibold">Fica por 35k a vista ou 12x de 2.925$</p>
              <p className="text-secondary-foreground mt-2 italic">Como fica melhor pra você? Normalmente os clientes preferem no cartão pois ja acumula milhas!</p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">2ª linha de negociação</span>
            </h4>
            <div className="space-y-4 text-secondary-foreground leading-relaxed">
              <p>O que ainda ficou fora, foi valor a vista ou a parcela no cartão?</p>
              <p>Se eu conseguir melhor pra encaixar no seu orçamento, ja iniciamos agora?</p>
              <p>Qual valor ficaria confortável de entrada pra gente ja iniciar?</p>
              <p className="text-foreground font-semibold">Se eu conseguir por: entrada de 12x de 1470$ no cartão + 4x de 4k no pix, funciona pra você?</p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">3ª linha de negociação</span>
            </h4>
            <div className="space-y-4 text-secondary-foreground leading-relaxed">
              <p>O que ainda ficou fora, foi valor a vista ou a parcela no cartão?</p>
              <p>Quero facilitar sua entrada pois como nosso produto é gerador de caixa, quanto mais rápido começamos, você pagará o restante das parcelas com dinheiro novo.</p>
              <p>Se eu chegar em uma entrada de 10k ou 12x de 1k.</p>
              <p>No segundo mês você passa mais 12x de 2.437$ no cartão que será pago com os contratos que vamos vender nesses primeiros 2 meses.</p>
              <p className="text-foreground font-semibold">Funcionaria?</p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.25}>
          <div className="rounded-2xl bg-card border border-primary/20 p-6 md:p-8">
            <h4 className="text-xl font-semibold mb-4 text-primary flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Concluir Pagamento em Call
            </h4>
            <p className="text-secondary-foreground mb-6">Quando ele disser SIM:</p>
            <div className="rounded-xl bg-background/50 border border-border p-5 mb-4">
              <h5 className="font-semibold mb-2 text-foreground">Link de Pagamento:</h5>
              <p className="text-secondary-foreground">pix / Banco inter CNPJ.</p>
              <p className="text-primary font-mono mt-1">pix: 59065036000104</p>
            </div>
            <div className="rounded-xl bg-background/50 border border-border p-5">
              <h5 className="font-semibold mb-4 text-foreground">Link de Cartão — Dom Pagamentos</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">#</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Parcelas</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="text-secondary-foreground">
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-semibold text-primary">1º</td>
                      <td className="py-3 px-4">12x de 3.818$</td>
                      <td className="py-3 px-4 text-muted-foreground italic">Link de Pagamento</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-semibold text-primary">2º</td>
                      <td className="py-3 px-4">12x de 2.911$</td>
                      <td className="py-3 px-4 text-muted-foreground italic">Link de Pagamento</td>
                    </tr>
                    <tr className="border-b border-border">
                      <td className="py-3 px-4 font-semibold text-primary">3º</td>
                      <td className="py-3 px-4">12x de 1470$</td>
                      <td className="py-3 px-4 text-muted-foreground italic">Link de Pagamento</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div className="rounded-2xl bg-card border border-border p-6 md:p-8">
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">4º</span>
            </h4>
            <p className="text-secondary-foreground mb-4">12x de 954$:</p>
            <p className="text-secondary-foreground mb-2">Enviar link</p>
            <div className="space-y-3 text-secondary-foreground leading-relaxed mt-4 pt-4 border-t border-border">
              <p>Manter conversa leve, puxar outros assuntos que falou no rapport.</p>
              <p>Falar que já está passando pro time criar o grupo, enquanto ele conclui o pagamento.</p>
              <p>Pedir o mesmo nome do cartão para colocar no cadastro da dom pagamentos.</p>
              <p>Acompanhar pagamento</p>
              <p>Se recusar, checar se ele colocou o mesmo nome do cartão e cadastro da dom.→ pedir sinal no Pix de 1k ou 500$, enquanto ele ver com banco a liberação.</p>
            </div>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 13 - QUEBRA DE OBJEÇÕES */}
      <StepSection id="objecoes" number="13" title="🔥 Quebra de Objeções">
        <FadeIn>
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Flame className="w-7 h-7 text-primary" />
              <h3 className="text-2xl font-bold">Garantia 100%</h3>
            </div>
            <p className="text-secondary-foreground text-lg leading-relaxed italic">
              "Se você entrar, aplicar nossa metodologia e não tiver resultado, nós temos uma política onde devolvemos 100% do seu investimento, justamente por sermos uma empresa focada em vendas, não queremos clientes sem resultado no nosso grupo. Tendo essa cláusula de garantia, funciona pra você?"
            </p>
          </div>
        </FadeIn>
      </StepSection>

      <SectionDivider />

      {/* 14 - PÓS PAGAMENTO */}
      <StepSection number="14" title="🚀 Pós Pagamento">
        <ScriptCard items={[
          "Parabenizar",
          "Reforçar decisão",
          "Pegar 3 indicações de pessoas que ele gostaria de ajudar com essa solução que acabou de comprar.",
        ]} />
      </StepSection>

      {/* PIX final */}
      <FadeIn>
        <div className="container max-w-4xl mx-auto px-6 pb-16">
          <div className="rounded-2xl bg-card border border-border p-6 text-center">
            <p className="text-muted-foreground text-sm mb-1">PIX</p>
            <p className="text-primary font-mono text-lg font-semibold">59065036000104</p>
          </div>
        </div>
      </FadeIn>

      {/* Footer */}
      <footer className="py-16 text-center border-t border-border">
        <FadeIn>
          <p className="text-2xl font-bold text-primary mb-2">Processo de Vendas</p>
          <p className="text-muted-foreground text-sm">Script de Vendas — Playbook Comercial</p>
        </FadeIn>
      </footer>
    </div>
  );
}
