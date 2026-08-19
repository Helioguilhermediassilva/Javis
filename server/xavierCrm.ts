import { applySupabaseAdminHeaders } from "./supabaseAdmin.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://jfeqkgdimjhbwaqmzxpu.supabase.co").replace(/\/+$/, "");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIST = 100;

export type XavierCrmDemandStatus = "backlog" | "in_progress" | "blocked" | "done" | "cancelled";
export type XavierCrmDemandPriority = "low" | "medium" | "high" | "urgent";

export interface XavierCrmContact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface XavierCrmDemand {
  id: string;
  user_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: XavierCrmDemandStatus;
  priority: XavierCrmDemandPriority;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface XavierCrmNote {
  id: string;
  user_id: string;
  contact_id: string | null;
  demand_id: string | null;
  content: string;
  created_at: string;
}

export interface XavierCrmContactInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  company?: unknown;
  tags?: unknown;
  notes?: unknown;
}

export interface XavierCrmDemandInput {
  contact_id?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  priority?: unknown;
  due_date?: unknown;
}

export interface XavierCrmNoteInput {
  contact_id?: unknown;
  demand_id?: unknown;
  content?: unknown;
}

export class XavierCrmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XavierCrmValidationError";
  }
}

async function supabaseRequest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: applySupabaseAdminHeaders(init),
    signal: AbortSignal.timeout(8_000),
  });
}

async function readRows<T>(response: Response, label: string): Promise<T[]> {
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    throw new Error(`Supabase ${label} ${response.status}: ${detail}`);
  }
  if (response.status === 204) return [];
  return (await response.json().catch(() => [])) as T[];
}

function requireUserId(userId: string): void {
  if (!UUID_PATTERN.test(userId)) throw new XavierCrmValidationError("Usuário inválido");
}

function optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new XavierCrmValidationError(`${field} deve ser texto`);
  const text = value.trim();
  if (text.length > maxLength) throw new XavierCrmValidationError(`${field} excede o limite de ${maxLength} caracteres`);
  return text || null;
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) throw new XavierCrmValidationError(`${field} é obrigatório`);
  const text = value.trim();
  if (text.length > maxLength) throw new XavierCrmValidationError(`${field} excede o limite de ${maxLength} caracteres`);
  return text;
}

function optionalUuid(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new XavierCrmValidationError(`${field} inválido`);
  return value;
}

function parseTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!raw || raw.some((item) => typeof item !== "string")) throw new XavierCrmValidationError("tags deve ser uma lista de textos");
  const tags = raw.map((item) => item.trim()).filter(Boolean).filter((tag, index, items) => items.indexOf(tag) === index);
  if (tags.length > 20 || tags.some((tag) => tag.length > 40)) throw new XavierCrmValidationError("tags deve conter até 20 itens de 40 caracteres");
  return tags;
}

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) throw new XavierCrmValidationError("due_date deve estar no formato AAAA-MM-DD");
  return value;
}

function parseStatus(value: unknown): XavierCrmDemandStatus | undefined {
  if (value === undefined) return undefined;
  const allowed: XavierCrmDemandStatus[] = ["backlog", "in_progress", "blocked", "done", "cancelled"];
  if (typeof value !== "string" || !allowed.includes(value as XavierCrmDemandStatus)) throw new XavierCrmValidationError("status de demanda inválido");
  return value as XavierCrmDemandStatus;
}

function parsePriority(value: unknown): XavierCrmDemandPriority | undefined {
  if (value === undefined) return undefined;
  const allowed: XavierCrmDemandPriority[] = ["low", "medium", "high", "urgent"];
  if (typeof value !== "string" || !allowed.includes(value as XavierCrmDemandPriority)) throw new XavierCrmValidationError("priority de demanda inválida");
  return value as XavierCrmDemandPriority;
}

function baseParams(userId: string, select: string): URLSearchParams {
  requireUserId(userId);
  const params = new URLSearchParams({ user_id: `eq.${userId}`, select, limit: String(MAX_LIST) });
  return params;
}

export function validateContactInput(input: XavierCrmContactInput, partial = false): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (!partial || input.name !== undefined) body.name = requiredText(input.name, "name", 200);
  const email = optionalText(input.email, "email", 320);
  const phone = optionalText(input.phone, "phone", 80);
  const company = optionalText(input.company, "company", 200);
  const notes = optionalText(input.notes, "notes", 12000);
  const tags = parseTags(input.tags);
  if (email !== undefined) body.email = email;
  if (phone !== undefined) body.phone = phone;
  if (company !== undefined) body.company = company;
  if (notes !== undefined) body.notes = notes;
  if (tags !== undefined) body.tags = tags;
  if (partial && Object.keys(body).length === 0) throw new XavierCrmValidationError("Nenhum campo de contato para atualizar");
  return body;
}

export function validateDemandInput(input: XavierCrmDemandInput, partial = false): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const contactId = optionalUuid(input.contact_id, "contact_id");
  const title = !partial || input.title !== undefined ? requiredText(input.title, "title", 240) : undefined;
  const description = optionalText(input.description, "description", 20000);
  const status = parseStatus(input.status);
  const priority = parsePriority(input.priority);
  const dueDate = parseDate(input.due_date);
  if (contactId !== undefined) body.contact_id = contactId;
  if (title !== undefined) body.title = title;
  if (description !== undefined) body.description = description;
  if (status !== undefined) body.status = status;
  if (priority !== undefined) body.priority = priority;
  if (dueDate !== undefined) body.due_date = dueDate;
  if (partial && Object.keys(body).length === 0) throw new XavierCrmValidationError("Nenhum campo de demanda para atualizar");
  return body;
}

export function validateNoteInput(input: XavierCrmNoteInput, partial = false): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const contactId = optionalUuid(input.contact_id, "contact_id");
  const demandId = optionalUuid(input.demand_id, "demand_id");
  const content = !partial || input.content !== undefined ? requiredText(input.content, "content", 12000) : undefined;
  if (contactId !== undefined) body.contact_id = contactId;
  if (demandId !== undefined) body.demand_id = demandId;
  if (content !== undefined) body.content = content;
  if (partial && Object.keys(body).length === 0) throw new XavierCrmValidationError("Nenhum campo de anotação para atualizar");
  return body;
}

export async function listXavierCrmContacts(userId: string, search?: string): Promise<XavierCrmContact[]> {
  const params = baseParams(userId, "id,user_id,name,email,phone,company,tags,notes,created_at,updated_at");
  params.set("order", "updated_at.desc");
  const term = (search || "").trim().replace(/[^a-zA-Z0-9À-ÿ@._ -]/g, "").slice(0, 80);
  if (term) params.set("or", `(name.ilike.*${term}*,email.ilike.*${term}*,company.ilike.*${term}*)`);
  return readRows<XavierCrmContact>(await supabaseRequest(`xavier_crm_contacts?${params}`), "CRM contacts list");
}

export async function createXavierCrmContact(userId: string, input: XavierCrmContactInput): Promise<XavierCrmContact> {
  const response = await supabaseRequest("xavier_crm_contacts", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, ...validateContactInput(input) }),
  });
  const rows = await readRows<XavierCrmContact>(response, "CRM contact insert");
  if (!rows[0]) throw new Error("Contato não foi criado");
  return rows[0];
}

export async function updateXavierCrmContact(userId: string, id: string, input: XavierCrmContactInput): Promise<XavierCrmContact> {
  const body = { ...validateContactInput(input, true), updated_at: new Date().toISOString() };
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${id}`, select: "id,user_id,name,email,phone,company,tags,notes,created_at,updated_at" });
  const response = await supabaseRequest(`xavier_crm_contacts?${params}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  const rows = await readRows<XavierCrmContact>(response, "CRM contact update");
  if (!rows[0]) throw new Error("Contato não encontrado");
  return rows[0];
}

export async function deleteXavierCrmContact(userId: string, id: string): Promise<void> {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${id}` });
  const response = await supabaseRequest(`xavier_crm_contacts?${params}`, { method: "DELETE" });
  await readRows(response, "CRM contact delete");
}

export async function listXavierCrmDemands(userId: string, status?: string): Promise<XavierCrmDemand[]> {
  const params = baseParams(userId, "id,user_id,contact_id,title,description,status,priority,due_date,created_at,updated_at");
  params.set("order", "updated_at.desc");
  if (status && ["backlog", "in_progress", "blocked", "done", "cancelled"].includes(status)) params.set("status", `eq.${status}`);
  return readRows<XavierCrmDemand>(await supabaseRequest(`xavier_crm_demands?${params}`), "CRM demands list");
}

export async function createXavierCrmDemand(userId: string, input: XavierCrmDemandInput): Promise<XavierCrmDemand> {
  const response = await supabaseRequest("xavier_crm_demands", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, ...validateDemandInput(input) }),
  });
  const rows = await readRows<XavierCrmDemand>(response, "CRM demand insert");
  if (!rows[0]) throw new Error("Demanda não foi criada");
  return rows[0];
}

export async function updateXavierCrmDemand(userId: string, id: string, input: XavierCrmDemandInput): Promise<XavierCrmDemand> {
  const body = { ...validateDemandInput(input, true), updated_at: new Date().toISOString() };
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${id}`, select: "id,user_id,contact_id,title,description,status,priority,due_date,created_at,updated_at" });
  const response = await supabaseRequest(`xavier_crm_demands?${params}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  const rows = await readRows<XavierCrmDemand>(response, "CRM demand update");
  if (!rows[0]) throw new Error("Demanda não encontrada");
  return rows[0];
}

export async function deleteXavierCrmDemand(userId: string, id: string): Promise<void> {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${id}` });
  const response = await supabaseRequest(`xavier_crm_demands?${params}`, { method: "DELETE" });
  await readRows(response, "CRM demand delete");
}

export async function listXavierCrmNotes(userId: string): Promise<XavierCrmNote[]> {
  const params = baseParams(userId, "id,user_id,contact_id,demand_id,content,created_at");
  params.set("order", "created_at.desc");
  return readRows<XavierCrmNote>(await supabaseRequest(`xavier_crm_notes?${params}`), "CRM notes list");
}

export async function createXavierCrmNote(userId: string, input: XavierCrmNoteInput): Promise<XavierCrmNote> {
  const response = await supabaseRequest("xavier_crm_notes", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ user_id: userId, ...validateNoteInput(input) }),
  });
  const rows = await readRows<XavierCrmNote>(response, "CRM note insert");
  if (!rows[0]) throw new Error("Anotação não foi criada");
  return rows[0];
}

export async function updateXavierCrmNote(userId: string, id: string, input: XavierCrmNoteInput): Promise<XavierCrmNote> {
  const body = validateNoteInput(input, true);
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${id}`, select: "id,user_id,contact_id,demand_id,content,created_at" });
  const response = await supabaseRequest(`xavier_crm_notes?${params}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  const rows = await readRows<XavierCrmNote>(response, "CRM note update");
  if (!rows[0]) throw new Error("Anotação não encontrada");
  return rows[0];
}

export async function deleteXavierCrmNote(userId: string, id: string): Promise<void> {
  const params = new URLSearchParams({ user_id: `eq.${userId}`, id: `eq.${id}` });
  const response = await supabaseRequest(`xavier_crm_notes?${params}`, { method: "DELETE" });
  await readRows(response, "CRM note delete");
}
