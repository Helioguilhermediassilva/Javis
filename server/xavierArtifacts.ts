function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isCreationRequest(message: string): boolean {
  return /\b(?:gere|gerar|crie|criar|faca|fazer|prepare|preparar|monte|montar|elabore|elaborar|produza|produzir|quero|preciso(?:\s+de)?|pedi|pe[çc]a|peca|envie|enviar|manda|mandar|transforme|converter)\b/i.test(normalize(message));
}

export function isPdfTaskRequest(message: string): boolean {
  const text = normalize(message);
  return /\bpdf\b/i.test(text) && isCreationRequest(text);
}

export function isPresentationTaskRequest(message: string): boolean {
  const text = normalize(message);
  const presentationTerm = /\b(?:apresentacao|slides?|slide\s*deck|deck|powerpoint|pptx?)\b/i.test(text);
  return presentationTerm && isCreationRequest(text);
}

export function shouldUseWebSearchForRequest(message: string): boolean {
  const text = normalize(message);
  return /\b(?:pesquis|internet|atual|recent|tendenc|noticia|mercado|benchmark|compar|youtube|google|instagram|tiktok|comentario|video|fonte|dados)\b/i.test(text);
}
