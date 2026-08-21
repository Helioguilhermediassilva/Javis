function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isCreationRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:gere|gera|gerar|crie|cria|criar|faca|faz|fazer|prepare|prepara|preparar|monte|monta|montar|elabore|elabora|elaborar|produza|produz|produzir|quero|preciso(?:\s+de)?|peca|peco|enviar|envie|manda|mandar|transforme|transformar|converta|converter|desenvolva|desenvolver|construa|construir|edite|editar|altere|alterar)\b/i.test(text);
}

function hasArtifactVerb(message: string): boolean {
  return isCreationRequest(message) || /\b(?:arquivo|ficha|modelo|template|relatorio|relatorio|documento|material)\b/i.test(normalize(message));
}

export function isPdfTaskRequest(message: string): boolean {
  const text = normalize(message);
  return /\bpdf\b/i.test(text) && (isCreationRequest(text) || /\b(?:documento|arquivo)\s+(?:em\s+)?pdf\b/i.test(text));
}

export function isPresentationTaskRequest(message: string): boolean {
  const text = normalize(message);
  const presentationTerm = /\b(?:apresentacao|apresentacoes|slides?|slide\s*deck|deck|powerpoint|power\s*point|pptx?)\b/i.test(text);
  return presentationTerm && hasArtifactVerb(text);
}

export function isSpreadsheetTaskRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:planilha|planilhas|excel|xlsx|xls|csv|tabela|orcamento|dashboard\s+em\s+dados)\b/i.test(text) && hasArtifactVerb(text);
}

export function isDocumentTaskRequest(message: string): boolean {
  const text = normalize(message);
  if (isPdfTaskRequest(text) || isPresentationTaskRequest(text) || isSpreadsheetTaskRequest(text)) return false;
  return /\b(?:documento|docx|doc|memorando|contrato|carta|proposta|relatorio|relatorio|briefing|texto formatado|arquivo de texto)\b/i.test(text) && hasArtifactVerb(text);
}

export function isImageTaskRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:imagem|imagens|ilustracao|ilustracao|arte|logo|icone|infografico|infografico|banner|png|jpg|jpeg|svg)\b/i.test(text) && hasArtifactVerb(text);
}

export function isVideoTaskRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:video|videos|filme|animacao|reel|mp4|clipe)\b/i.test(text) && hasArtifactVerb(text);
}

export function shouldUseWebSearchForRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:pesquis|internet|atual|recent|tendenc|noticia|mercado|benchmark|compar|youtube|google|instagram|tiktok|comentario|video|fonte|dados)\b/i.test(text);
}

/**
 * A pesquisa nativa do Claude pode fazer múltiplas consultas antes de retornar.
 * O áudio já consome parte do orçamento com download e transcrição.
 */
export function getTelegramClaudeTimeoutMs(input: { hasAudio: boolean; useWebSearch: boolean }): number {
  if (input.hasAudio && input.useWebSearch) return 100_000;
  if (input.useWebSearch) return 90_000;
  if (input.hasAudio) return 80_000;
  return 75_000;
}
