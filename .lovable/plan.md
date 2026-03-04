

## Plano: Melhorar tabelas SDR/Closer e layout

### Problemas identificados

1. **"Conexões" repetida** — O código usa `METRIC_LABELS[k]?.substring(0, 8)` que corta "Conexões Aceitas" para "Conexões", ficando igual à primeira coluna. Precisa usar labels curtas específicas.

2. **Falta métrica/meta por usuário** — As tabelas só mostram o valor bruto. Precisa mostrar `valor/meta` com cálculo proporcional (dia, semana ou mês) para cada membro.

3. **Layout: tabelas devem seguir o tamanho dos painéis** — SDR table alinhada ao painel SDR (lado a lado com Closer), não ocupando 100% da largura. Rankings abaixo do painel Closer.

### Mudanças

**1. Corrigir labels truncadas (`AdminDashboard.tsx` e `CloserRanking.tsx`)**
- Substituir `METRIC_LABELS[k]?.substring(0, 8)` por um mapa de labels curtas (SHORT_TABLE_LABELS) com valores como "Conexões", "Aceitas", "Abordage", "Follow U", "Lig. Rea", "Reun. Ag", "Reun. Re"
- Adicionar este mapa em `db.ts` para reutilizar

**2. Adicionar coluna valor/meta nas tabelas de equipe (`AdminDashboard.tsx`)**
- Calcular metas individuais: meta da equipe ÷ número de membros daquela role
- Em cada célula, mostrar `valor/meta` em vez de só `valor`
- Colorir baseado no % atingido (verde ≥80%, amarelo ≥40%, vermelho <40%)

**3. Reorganizar layout no painel "Visão Geral" (`AdminDashboard.tsx`)**
- Usar layout `flex` lado a lado: coluna esquerda (70%) = painel KPI SDR + tabela SDR, coluna direita (30%) = painel KPI Closer + tabela Closer + Rankings
- Isso faz cada tabela seguir a largura do seu painel KPI correspondente
- Rankings ficam abaixo da tabela Closer

### Arquivos a editar
- `src/lib/db.ts` — adicionar `SHORT_TABLE_LABELS`
- `src/pages/AdminDashboard.tsx` — reorganizar layout das tabelas + adicionar valor/meta + corrigir labels
- `src/components/dashboard/CloserRanking.tsx` — corrigir labels truncadas

