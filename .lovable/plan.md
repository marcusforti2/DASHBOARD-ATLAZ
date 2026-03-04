

## Plano: Melhorar UX/UI da separação SDR vs Closer

### Problema atual
Os dois painéis (SDR e Closer) no modo compacto estão lado a lado mas com pouca diferenciação visual. Os cards Closer ficam apertados e a separação não é clara o suficiente. A tabela abaixo também mistura todas as métricas sem distinção.

### Mudanças propostas

**1. KpiGrid compacto — visual mais forte**
- Aumentar contraste das cores de fundo dos painéis: SDR com azul mais vivo (`217 40% 13%`), Closer com roxo mais vivo (`280 30% 13%`)
- Adicionar borda lateral colorida (left border 3px) em cada painel: azul para SDR, roxo para Closer
- Badge/chip colorido no header de cada seção (fundo semitransparente com texto): `SDR` em azul, `CLOSER` em roxo
- Adicionar um divisor vertical sutil entre os dois painéis (ou gap maior)

**2. KpiGrid compacto — cards Closer com anel roxo**
- Cards do Closer usam cor roxa no anel de progresso (ao invés de verde/amarelo/vermelho), para reforçar visualmente que são de outro grupo
- Passar uma prop `variant="closer"` para o CompactCard quando renderizado no painel Closer, alterando a cor do stroke do ring

**3. Tabela diária — separação visual de colunas**
- Adicionar um divisor vertical (border-left mais forte) entre a coluna "Lig. Agend." (última SDR) e "Lig. Realiz." (primeira Closer)
- Colorir os headers das colunas Closer com tom roxo sutil
- Colorir os headers das colunas SDR com tom azul sutil

**4. CSS (index.css)**
- Ajustar `--panel-sdr` e `--panel-closer` para mais contraste

### Arquivos a editar
- `src/index.css` — ajustar variáveis de painel
- `src/components/dashboard/KpiGrid.tsx` — chips coloridos no header, border-left, variante de cor para Closer cards
- `src/components/dashboard/DailyTable.tsx` — divisor visual entre colunas SDR e Closer, headers coloridos

