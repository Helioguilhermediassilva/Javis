/**
 * Mapeamento das fontes de dados públicas do Distrito Federal usadas pelo JARVIS.
 *
 * Hub central: dados.df.gov.br (CKAN, ~175 datasets, 11 grupos temáticos).
 * Cada grupo abaixo aponta para o slug oficial no CKAN para facilitar buscas.
 */

export type DfGroupSlug =
  | "saude"
  | "seguranca"
  | "mobilidade"
  | "educacao"
  | "orcamento"
  | "meio-ambiente"
  | "assistencia-social"
  | "governo"
  | "participacao-social"
  | "portal-da-transparencia-do-distrito-federal"
  | "plano-de-dados-abertos";

export interface DfTopic {
  slug: DfGroupSlug;
  label: string;
  description: string;
  /** Palavras-chave usadas para casar uma pergunta do usuário com este tópico. */
  keywords: string[];
}

export const DF_TOPICS: DfTopic[] = [
  {
    slug: "saude",
    label: "Saúde",
    description: "SES-DF, leitos, hospitais, vacinação, mortalidade, atenção primária.",
    keywords: ["saúde", "saude", "ses", "hospital", "leito", "vacina", "ubs", "covid", "fila sus"],
  },
  {
    slug: "seguranca",
    label: "Segurança Pública",
    description: "PMDF, PCDF, CBMDF, ocorrências, crimes, atendimentos.",
    keywords: ["segurança", "seguranca", "polícia", "policia", "pmdf", "pcdf", "ssp", "crime", "violência", "violencia", "bombeiros", "cbmdf", "ocorrência", "ocorrencia"],
  },
  {
    slug: "mobilidade",
    label: "Mobilidade e Trânsito",
    description: "DETRAN-DF, SEMOB, DFTRANS, DER, frota, acidentes, transporte público, BRT, metrô.",
    keywords: ["trânsito", "transito", "detran", "semob", "ônibus", "onibus", "dftrans", "metrô", "metro", "brt", "der", "rodovia", "frota", "acidente", "mobilidade", "transporte"],
  },
  {
    slug: "educacao",
    label: "Educação",
    description: "SEE-DF, escolas, matrículas, IDEB, infraestrutura escolar.",
    keywords: ["educação", "educacao", "see", "escola", "matrícula", "matricula", "ideb", "professor", "aluno"],
  },
  {
    slug: "orcamento",
    label: "Orçamento e Finanças",
    description: "Receitas, despesas, execução orçamentária, dívida, restos a pagar.",
    keywords: ["orçamento", "orcamento", "receita", "despesa", "execução orçamentária", "execucao orcamentaria", "dívida", "divida", "fazenda"],
  },
  {
    slug: "meio-ambiente",
    label: "Meio Ambiente",
    description: "IBRAM, SEMA, qualidade do ar, áreas protegidas, licenciamento ambiental.",
    keywords: ["meio ambiente", "ambiental", "ibram", "sema", "ar", "queimada", "licenciamento", "verde"],
  },
  {
    slug: "assistencia-social",
    label: "Assistência Social",
    description: "SEDES, programas sociais, CRAS, CREAS, segurança alimentar.",
    keywords: ["assistência", "assistencia", "social", "sedes", "cras", "creas", "bolsa", "renda", "alimentar"],
  },
  {
    slug: "governo",
    label: "Governo e Servidores",
    description: "Casa Civil, gestão de pessoas, decretos, estrutura administrativa.",
    keywords: ["governo", "servidor", "casa civil", "decreto", "gestão", "gestao"],
  },
  {
    slug: "participacao-social",
    label: "Participação Social",
    description: "Ouvidoria, conselhos, consultas públicas, e-Cidadania.",
    keywords: ["participação", "participacao", "ouvidoria", "conselho", "consulta pública", "consulta publica"],
  },
  {
    slug: "portal-da-transparencia-do-distrito-federal",
    label: "Transparência",
    description: "Portal da Transparência do DF: contratos, licitações, convênios, folha de pagamento.",
    keywords: ["transparência", "transparencia", "contrato", "licitação", "licitacao", "convênio", "convenio", "folha", "salário", "salario"],
  },
];

/** Endpoint base do catálogo CKAN do governo do DF. */
export const DF_CKAN_BASE = "https://dados.df.gov.br/api/3/action";

/**
 * Dada uma pergunta livre do usuário, devolve a lista de tópicos prováveis
 * (ordenada por número de keywords casadas).
 */
export function inferDfTopics(question: string): DfTopic[] {
  const q = question.toLowerCase();
  const scored = DF_TOPICS.map((t) => {
    const score = t.keywords.reduce((acc, kw) => (q.includes(kw) ? acc + 1 : acc), 0);
    return { topic: t, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.topic);
}
