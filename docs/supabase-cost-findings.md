# Supabase — referências de custo e armazenamento

Data da consulta: 2026-08-19.

## Fontes oficiais

1. https://supabase.com/pricing — página de preços. O plano Free informa 500 MB de tamanho de banco por projeto, 5 GB de egress, 1 GB de file storage e até dois projetos ativos; o plano Pro informa 8 GB de disco por projeto incluídos, 100 GB de file storage incluídos e cobrança adicional por uso excedente. Os preços e limites devem ser revalidados no momento de publicação.
2. https://supabase.com/docs/guides/platform/database-size — diferencia database size de disk size; o tamanho do banco inclui dados, índices e views. No plano Free, o projeto entra em modo somente leitura quando o database size ultrapassa 500 MB. Exclusões podem não reduzir imediatamente o espaço físico até vacuum/autovacuum.
3. https://supabase.com/docs/guides/platform/billing-on-supabase — a cobrança é por organização; cada projeto possui compute próprio. O custo de compute é independente do volume de dados e projetos adicionais podem aumentar o custo mensal. As cotas de database size, egress, storage e invocações devem ser monitoradas.

## Implicações para o Xavier

- Usar o projeto existente Cockpit_NowGo, evitando criar um segundo projeto e um segundo compute.
- Não armazenar áudio ou vídeo bruto por padrão; persistir texto e metadados mínimos.
- Aplicar retenção ao histórico bruto e manter apenas resumos compactos após o prazo.
- Adotar limites por usuário, por conversa e por mês, com bloqueio seguro antes de exceder a cota.
- Começar sem embeddings/banco vetorial; adicionar apenas se houver necessidade comprovada.
- Criar métricas de tamanho por tabela e volume por usuário para alertas e manutenção.
- Implementar exclusão de dados do usuário e rotina de manutenção para reduzir bloat quando aplicável.
