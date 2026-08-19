import {
  createXavierCrmContact,
  createXavierCrmDemand,
  createXavierCrmNote,
  deleteXavierCrmContact,
  deleteXavierCrmDemand,
  deleteXavierCrmNote,
  listXavierCrmContacts,
  listXavierCrmDemands,
  listXavierCrmNotes,
  updateXavierCrmContact,
  updateXavierCrmDemand,
  updateXavierCrmNote,
  XavierCrmValidationError,
  type XavierCrmContact,
  type XavierCrmDemand,
  type XavierCrmNote,
} from "./xavierCrm.js";

export type XavierCrmEntity = "contact" | "demand" | "note";
export type XavierCrmAction = "create" | "update" | "delete" | "list" | "none";

export interface XavierCrmIntent {
  action: XavierCrmAction;
  entity: XavierCrmEntity | null;
  fields: Record<string, unknown>;
  lookup: string | null;
}

export interface XavierCrmExecutionResult {
  handled: boolean;
  reply?: string;
  intent: XavierCrmIntent;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function clean(text: string): string {
  return text.replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function entityFromText(normalized: string): XavierCrmEntity | null {
  const candidates: Array<{ entity: XavierCrmEntity; pattern: RegExp }> = [
    { entity: "contact", pattern: /\b(contato|contatos|cliente|clientes|lead|leads|pessoa|pessoas)\b/ },
    { entity: "demand", pattern: /\b(demanda|demandas|tarefa|tarefas|pendencia|pendencias|solicitacao|solicitacoes|atividade|atividades|follow[- ]?up)\b/ },
    { entity: "note", pattern: /\b(nota|notas|anotacao|anotacoes|observacao|observacoes|lembrete|lembretes|registro|registros)\b/ },
  ];
  const matches = candidates
    .map((candidate) => ({ entity: candidate.entity, index: normalized.search(candidate.pattern) }))
    .filter((candidate) => candidate.index >= 0)
    .sort((left, right) => left.index - right.index);
  return matches[0]?.entity || null;
}

function actionFromText(normalized: string, entity: XavierCrmEntity | null): XavierCrmAction {
  if (hasAny(normalized, [/\b(exclu[ia]|excluir|remov[ae]|remover|apague|apagar|delete|deletar|cancele|cancelar)\b/])) return "delete";
  if (hasAny(normalized, [/\b(atualiz[ae]|atualizar|edite|editar|altere|alterar|mude|mudar|corrija|corrigir|marque como|conclu[ia]|finaliz[ae]|remarque|remarcar)\b/])) return "update";
  if (hasAny(normalized, [/\b(lista|liste|listar|mostre|mostrar|exiba|exibir|quais|qual|ver|veja|consult[ae]|consultar|buscar|busque|busca)\b/])) return "list";
  if (hasAny(normalized, [/\b(adicion[ae]|adicionar|inclua|incluir|cadastre|cadastrar|crie|criar|registre|registrar|salve|salvar|guarde|guardar|anote|anotar|lembre|lembrar|marque)\b/])) return "create";
  if (entity === "note" && hasAny(normalized, [/\banote\b|\bregist[reao]\b|\bguarde\b|\blembre\b/])) return "create";
  return "none";
}

function textAfterEntity(text: string, entity: XavierCrmEntity): string {
  const patterns: Record<XavierCrmEntity, RegExp> = {
    contact: /\b(contato|cliente|lead|pessoa)s?\b/i,
    demand: /\b(demanda|tarefa|pendencia|solicitacao|atividade|follow[- ]?up)s?\b/i,
    note: /\b(nota|anotacao|observacao|lembrete|registro)s?\b/i,
  };
  const match = text.match(patterns[entity]);
  return match?.index == null ? text : text.slice(match.index + match[0].length).replace(/^\s*(?:de|do|da|para|sobre|:|-)?\s*/i, "").trim();
}

function extractLabeled(text: string, labels: string[]): string | null {
  const expression = new RegExp(`(?:${labels.join("|")})\\s*[:=-]\\s*([^,;\\n]+)`, "i");
  const match = text.match(expression);
  return match?.[1] ? clean(match[1]) : null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase() || null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match?.[0] ? clean(match[0]) : null;
}

function extractTags(text: string): string[] | undefined {
  const raw = extractLabeled(text, ["tags?", "etiquetas?"]);
  return raw ? raw.split(/[,|]/).map((tag) => clean(tag)).filter(Boolean) : undefined;
}

function parseContactIntent(text: string, action: XavierCrmAction): { fields: Record<string, unknown>; lookup: string | null } {
  const body = textAfterEntity(text, "contact");
  const explicitName = extractLabeled(body, ["nome"]);
  const email = extractEmail(body) || extractLabeled(body, ["e[- ]?mail", "email"]);
  const phone = extractPhone(body) || extractLabeled(body, ["telefone", "celular", "fone", "whatsapp"]);
  const company = extractLabeled(body, ["empresa", "companhia"]);
  const notes = extractLabeled(body, ["observacao", "obs", "notas?"]);
  const tags = extractTags(body);
  const firstPart = clean(body.split(/[;,|]/)[0] || "").replace(/\b(?:com|e-mail|email|telefone|celular|empresa|tags?|etiquetas?)\b.*$/i, "").trim();
  const candidate = explicitName || firstPart;
  const generic = /^(novo|nova|um|uma|o|a|para|sobre|com|e)$/i.test(candidate);
  const fields: Record<string, unknown> = {};
  if (action === "create" && candidate && !generic) fields.name = candidate.slice(0, 200);
  if (explicitName) fields.name = explicitName.slice(0, 200);
  if (email) fields.email = email;
  if (phone) fields.phone = phone;
  if (company) fields.company = company;
  if (notes) fields.notes = notes;
  if (tags) fields.tags = tags;
  const lookup = action === "create" ? null : (UUID_PATTERN.test(candidate) ? candidate : candidate || null);
  return { fields, lookup };
}

function statusFromText(normalized: string): string | undefined {
  if (/\b(em andamento|andamento|fazendo|iniciada|iniciado)\b/.test(normalized)) return "in_progress";
  if (/\b(bloqueada|bloqueado|travada|travado)\b/.test(normalized)) return "blocked";
  if (/\b(concluida|concluido|finalizada|finalizado|resolvida|resolvido)\b/.test(normalized)) return "done";
  if (/\b(cancelada|cancelado)\b/.test(normalized)) return "cancelled";
  if (/\b(backlog|a fazer|pendente|aberta|aberto)\b/.test(normalized)) return "backlog";
  return undefined;
}

function priorityFromText(normalized: string): string | undefined {
  if (/\b(urgente|urgentissima|urgentissimo)\b/.test(normalized)) return "urgent";
  if (/\b(alta|alto|prioridade alta)\b/.test(normalized)) return "high";
  if (/\b(baixa|baixo|prioridade baixa)\b/.test(normalized)) return "low";
  if (/\b(media|medio|prioridade media)\b/.test(normalized)) return "medium";
  return undefined;
}

function extractDate(text: string): string | null {
  const numeric = text.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (numeric) {
    const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3];
    return `${year}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  }
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  return iso?.[0] || null;
}

function parseDemandIntent(text: string, action: XavierCrmAction): { fields: Record<string, unknown>; lookup: string | null } {
  const body = textAfterEntity(text, "demand");
  const normalizedBody = normalize(body);
  const explicitTitle = extractLabeled(body, ["titulo", "tarefa", "demanda"]);
  const description = extractLabeled(body, ["descricao", "detalhes", "detalhe"]);
  const contactName = extractLabeled(body, ["contato", "cliente", "lead", "responsavel"]);
  const date = extractDate(body);
  const status = statusFromText(normalizedBody);
  const priority = priorityFromText(normalizedBody);
  const firstPart = clean(body.split(/[;,|]/)[0] || "")
    .replace(/\b(?:titulo|descricao|detalhes|prazo|vencimento|ate|status|prioridade|contato|cliente|lead|responsavel)\b\s*[:=-]?.*$/i, "")
    .trim();
  const candidate = explicitTitle || firstPart;
  const generic = /^(novo|nova|um|uma|o|a|para|sobre|com|e)$/i.test(candidate);
  const fields: Record<string, unknown> = {};
  if (action === "create" && candidate && !generic) fields.title = candidate.slice(0, 240);
  if (explicitTitle) fields.title = explicitTitle.slice(0, 240);
  if (description) fields.description = description;
  if (date) fields.due_date = date;
  if (status) fields.status = status;
  if (priority) fields.priority = priority;
  if (contactName) fields.contact_name = contactName;
  const lookup = action === "create" ? null : (UUID_PATTERN.test(candidate) ? candidate : candidate || null);
  return { fields, lookup };
}

function parseNoteIntent(text: string): { fields: Record<string, unknown>; lookup: string | null } {
  const body = textAfterEntity(text, "note");
  const contactName = extractLabeled(body, ["contato", "cliente", "lead", "para"]);
  const demandTitle = extractLabeled(body, ["demanda", "tarefa", "atividade"]);
  let content = extractLabeled(body, ["conteudo", "texto", "nota", "observacao", "anotacao"]);
  if (!content) {
    content = body.replace(/\b(?:para|sobre)\s+(?:o|a)?\s*(?:contato|cliente|lead|demanda|tarefa)\b[^,:-]*\s*[:,-]?/i, "").trim();
  }
  return {
    fields: {
      ...(content ? { content: content.slice(0, 12000) } : {}),
      ...(contactName ? { contact_name: contactName } : {}),
      ...(demandTitle ? { demand_title: demandTitle } : {}),
    },
    lookup: null,
  };
}

function inferImplicitNote(normalized: string): boolean {
  return /\b(anote|anotar|registre|registrar|salve|salvar|guarde|guardar|lembre|lembrar)\b/.test(normalized)
    && /\b(que|sobre|para|isso|isto|detalhe|informacao|informacoes)\b/.test(normalized);
}

export function detectXavierCrmRequest(text: string): boolean {
  const normalized = normalize(text);
  const entity = entityFromText(normalized);
  if (!entity) return inferImplicitNote(normalized);
  const action = actionFromText(normalized, entity);
  return action !== "none" || entity === "note";
}

export function parseXavierCrmIntent(text: string): XavierCrmIntent {
  const normalized = normalize(text);
  const entity = inferImplicitNote(normalized) ? "note" : entityFromText(normalized);
  if (!entity) return { action: "none", entity: null, fields: {}, lookup: null };
  const action = actionFromText(normalized, entity);
  if (entity === "contact") {
    const parsed = parseContactIntent(text, action);
    return { action, entity, ...parsed };
  }
  if (entity === "demand") {
    const parsed = parseDemandIntent(text, action);
    return { action, entity, ...parsed };
  }
  return { action, entity, ...parseNoteIntent(text) };
}

function contactLabel(contact: XavierCrmContact): string {
  return `${contact.name}${contact.company ? ` (${contact.company})` : ""}`;
}

function demandLabel(demand: XavierCrmDemand): string {
  return `${demand.title} [${demand.status}/${demand.priority}]`;
}

function statusLabel(value: string): string {
  return ({ backlog: "a fazer", in_progress: "em andamento", blocked: "bloqueada", done: "concluída", cancelled: "cancelada" } as Record<string, string>)[value] || value;
}

function priorityLabel(value: string): string {
  return ({ low: "baixa", medium: "média", high: "alta", urgent: "urgente" } as Record<string, string>)[value] || value;
}

async function resolveContact(userId: string, lookup: unknown): Promise<{ contact?: XavierCrmContact; reply?: string }> {
  if (typeof lookup !== "string" || !lookup.trim()) return {};
  const contacts = await listXavierCrmContacts(userId, lookup);
  const normalizedLookup = normalize(lookup);
  const matches = contacts.filter((item) => item.id === lookup || normalize(item.name) === normalizedLookup || normalize(item.name).includes(normalizedLookup));
  if (matches.length > 1) return { reply: `Encontrei mais de um contato parecido com “${lookup}”. Informe também a empresa ou o e-mail para eu identificar o registro certo.` };
  if (!matches[0]) return { reply: `Não encontrei o contato “${lookup}”. Quer que eu cadastre um novo contato com esse nome?` };
  return { contact: matches[0] };
}

async function resolveDemand(userId: string, lookup: unknown): Promise<{ demand?: XavierCrmDemand; reply?: string }> {
  if (typeof lookup !== "string" || !lookup.trim()) return {};
  const demands = await listXavierCrmDemands(userId);
  const normalizedLookup = normalize(lookup);
  const matches = demands.filter((item) => item.id === lookup || normalize(item.title) === normalizedLookup || normalize(item.title).includes(normalizedLookup));
  if (matches.length > 1) return { reply: `Encontrei mais de uma demanda parecida com “${lookup}”. Informe uma palavra adicional do título ou o prazo para eu identificar a certa.` };
  if (!matches[0]) return { reply: `Não encontrei a demanda “${lookup}”. Quer que eu crie uma nova demanda com esse título?` };
  return { demand: matches[0] };
}

export async function executeXavierCrmIntent(userId: string, intent: XavierCrmIntent): Promise<XavierCrmExecutionResult> {
  if (intent.action === "none" || !intent.entity) return { handled: false, intent };
  try {
    if (intent.entity === "contact") {
      if (intent.action === "list") {
        const contacts = await listXavierCrmContacts(userId);
        return { handled: true, intent, reply: contacts.length ? `Encontrei ${contacts.length} contato(s):\n${contacts.slice(0, 25).map((item) => `• ${contactLabel(item)}${item.email ? ` — ${item.email}` : ""}`).join("\n")}` : "Ainda não há contatos registrados para esta conta." };
      }
      if (intent.action === "create") {
        const contact = await createXavierCrmContact(userId, intent.fields);
        return { handled: true, intent, reply: `Contato registrado com sucesso: ${contactLabel(contact)}${contact.email ? ` — ${contact.email}` : ""}.` };
      }
      const resolved = await resolveContact(userId, intent.lookup);
      if (resolved.reply) return { handled: true, intent, reply: resolved.reply };
      if (!resolved.contact) return { handled: true, intent, reply: "Informe o nome do contato que devo atualizar ou remover." };
      if (intent.action === "delete") {
        await deleteXavierCrmContact(userId, resolved.contact.id);
        return { handled: true, intent, reply: `Contato removido: ${contactLabel(resolved.contact)}.` };
      }
      const updated = await updateXavierCrmContact(userId, resolved.contact.id, intent.fields);
      return { handled: true, intent, reply: `Contato atualizado: ${contactLabel(updated)}.` };
    }

    if (intent.entity === "demand") {
      if (intent.action === "list") {
        const demands = await listXavierCrmDemands(userId, typeof intent.fields.status === "string" ? intent.fields.status : undefined);
        return { handled: true, intent, reply: demands.length ? `Encontrei ${demands.length} demanda(s):\n${demands.slice(0, 25).map((item) => `• ${item.title} — ${statusLabel(item.status)}, prioridade ${priorityLabel(item.priority)}${item.due_date ? `, prazo ${item.due_date}` : ""}`).join("\n")}` : "Ainda não há demandas registradas para esta conta." };
      }
      if (intent.action === "create") {
        const fields = { ...intent.fields };
        if (typeof fields.contact_name === "string") {
          const resolved = await resolveContact(userId, fields.contact_name);
          if (resolved.reply) return { handled: true, intent, reply: resolved.reply };
          if (resolved.contact) fields.contact_id = resolved.contact.id;
          delete fields.contact_name;
        }
        const demand = await createXavierCrmDemand(userId, fields);
        return { handled: true, intent, reply: `Demanda registrada: “${demand.title}”, status ${statusLabel(demand.status)} e prioridade ${priorityLabel(demand.priority)}${demand.due_date ? `, prazo ${demand.due_date}` : ""}.` };
      }
      const resolved = await resolveDemand(userId, intent.lookup);
      if (resolved.reply) return { handled: true, intent, reply: resolved.reply };
      if (!resolved.demand) return { handled: true, intent, reply: "Informe o título da demanda que devo atualizar ou remover." };
      if (intent.action === "delete") {
        await deleteXavierCrmDemand(userId, resolved.demand.id);
        return { handled: true, intent, reply: `Demanda removida: “${resolved.demand.title}”.` };
      }
      const fields = { ...intent.fields };
      delete fields.contact_name;
      const updated = await updateXavierCrmDemand(userId, resolved.demand.id, fields);
      return { handled: true, intent, reply: `Demanda atualizada: “${updated.title}”, status ${statusLabel(updated.status)} e prioridade ${priorityLabel(updated.priority)}.` };
    }

    if (intent.action === "list") {
      const notes = await listXavierCrmNotes(userId);
      return { handled: true, intent, reply: notes.length ? `Encontrei ${notes.length} anotação(ões):\n${notes.slice(0, 25).map((item) => `• ${item.content}`).join("\n")}` : "Ainda não há anotações registradas para esta conta." };
    }
    if (intent.action === "create") {
      const fields = { ...intent.fields };
      if (typeof fields.contact_name === "string") {
        const resolved = await resolveContact(userId, fields.contact_name);
        if (resolved.reply) return { handled: true, intent, reply: resolved.reply };
        if (resolved.contact) fields.contact_id = resolved.contact.id;
        delete fields.contact_name;
      }
      if (typeof fields.demand_title === "string") {
        const resolved = await resolveDemand(userId, fields.demand_title);
        if (resolved.reply) return { handled: true, intent, reply: resolved.reply };
        if (resolved.demand) fields.demand_id = resolved.demand.id;
        delete fields.demand_title;
      }
      const note = await createXavierCrmNote(userId, fields);
      return { handled: true, intent, reply: `Anotação salva: “${note.content}”.` };
    }
    const notes = await listXavierCrmNotes(userId);
    const lookup = typeof intent.fields.content === "string" ? normalize(intent.fields.content) : "";
    const match = notes.find((item) => normalize(item.content).includes(lookup));
    if (!match) return { handled: true, intent, reply: "Não encontrei a anotação que você indicou. Informe uma parte maior do texto para eu localizar." };
    if (intent.action === "delete") {
      await deleteXavierCrmNote(userId, match.id);
      return { handled: true, intent, reply: "Anotação removida." };
    }
    const updated = await updateXavierCrmNote(userId, match.id, intent.fields);
    return { handled: true, intent, reply: `Anotação atualizada: “${updated.content}”.` };
  } catch (error) {
    if (error instanceof XavierCrmValidationError) return { handled: true, intent, reply: error.message };
    throw error;
  }
}

export async function handleXavierCrmRequest(userId: string, text: string): Promise<XavierCrmExecutionResult> {
  const intent = parseXavierCrmIntent(text);
  return executeXavierCrmIntent(userId, intent);
}
