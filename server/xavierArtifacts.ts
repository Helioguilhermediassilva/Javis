function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isCreationRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:gere|gera|gerar|crie|cria|criar|faca|faz|fazer|prepare|prepara|preparar|monte|monta|montar|elabore|elabora|elaborar|produza|produz|produzir|quero|preciso(?:\s+de)?|pedi|peca|envie|manda|mandar|enviar|transforme|transformar|converta|converter|desenvolva|desenvolver|construa|construir)\b/i.test(text);
}

export function isPdfTaskRequest(message: string): boolean {
  const text = normalize(message);
  if (!/\bpdf\b/i.test(text)) return false;
  return isCreationRequest(text) || /\b(?:documento|arquivo)\s+(?:em\s+)?pdf\b/i.test(text);
}

export function isPresentationTaskRequest(message: string): boolean {
  const text = normalize(message);
  const presentationTerm = /\b(?:apresentacao|apresentacoes|slides?|slide\s*deck|deck|powerpoint|power\s*point|pptx?)\b/i.test(text);
  return presentationTerm && (isCreationRequest(text) || /\b(?:arquivo|documento)\s+(?:de\s+)?(?:apresentacao|slides?|powerpoint|pptx?)\b/i.test(text));
}

export function shouldUseWebSearchForRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:pesquis|internet|atual|recent|tendenc|noticia|mercado|benchmark|compar|youtube|google|instagram|tiktok|comentario|video|fonte|dados)\b/i.test(text);
}
