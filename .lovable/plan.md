

## Problema
No modo compacto, a meta aparece como um pequeno `/{valor}` em texto de 8px abaixo do número — quase invisível e difícil de interpretar rapidamente.

## Solução: Layout "valor / meta" inline com progresso circular

Reformular o card compacto para tornar a meta visualmente clara:

1. **Valor e meta na mesma linha**: Mostrar `120 / 200` lado a lado em vez de empilhado, com a meta em cor mais suave mas tamanho legível (não 8px).

2. **Progresso circular (ring)** em vez de barra linear: Usar um pequeno SVG circular (tipo gauge/donut) ao redor do ícone ou como elemento central do card. O preenchimento do ring indica o % da meta com as cores já existentes (verde/amarelo/vermelho). Isso dá leitura instantânea visual de "quanto falta".

3. **Percentual dentro do ring**: O `%` fica centralizado dentro do círculo, eliminando a necessidade de texto separado.

### Layout do card compacto redesenhado:
```text
┌─────────────┐
│   [ícone]   │
│  Conexões   │
│  ┌─────┐    │
│  │ 72% │    │  ← SVG ring colorido
│  └─────┘    │
│  120 / 200  │  ← valor e meta inline, legível
│  +12% ↑     │
└─────────────┘
```

### Mudanças técnicas:
- **`KpiGrid.tsx`**: No modo `compact`, substituir a barra de progresso por um SVG ring de ~36px. Juntar valor/meta em uma linha `{val} / {goal}` com tamanhos 11px/9px. Mover `%` para dentro do ring.
- Sem dependências novas — SVG puro com `stroke-dasharray` / `stroke-dashoffset`.

