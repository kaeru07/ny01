import { Prompt } from '@/types';
import { storage } from './storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const KEY = 'cds_prompts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDB(row: any): Prompt {
  return {
    id: row.id,
    projectId: row.project_id,
    category: row.category ?? 'new',
    version: row.version ?? 'v1',
    title: row.title ?? '',
    body: row.body ?? '',
    changeMemo: row.change_memo ?? '',
    targetRole: row.target_role ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDB(data: Partial<Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>>) {
  const row: Record<string, unknown> = {};
  if (data.projectId !== undefined) row.project_id = data.projectId;
  if (data.category !== undefined) row.category = data.category;
  if (data.version !== undefined) row.version = data.version;
  if (data.title !== undefined) row.title = data.title;
  if (data.body !== undefined) row.body = data.body;
  if (data.changeMemo !== undefined) row.change_memo = data.changeMemo;
  if (data.targetRole !== undefined) row.target_role = data.targetRole;
  return row;
}

// --- localStorage fallback ---
const local = {
  findAll(): Prompt[] { return storage.get<Prompt[]>(KEY) ?? []; },
  findByProjectId(projectId: string): Prompt[] {
    return this.findAll().filter((p) => p.projectId === projectId);
  },
  findById(id: string): Prompt | null {
    return this.findAll().find((p) => p.id === id) ?? null;
  },
  create(data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Prompt {
    const now = new Date().toISOString();
    const prompt: Prompt = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    storage.set(KEY, [...this.findAll(), prompt]);
    return prompt;
  },
  update(id: string, data: Partial<Omit<Prompt, 'id' | 'createdAt'>>): Prompt | null {
    const all = this.findAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: Prompt = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    storage.set(KEY, all);
    return updated;
  },
  delete(id: string): void {
    storage.set(KEY, this.findAll().filter((p) => p.id !== id));
  },
};

// --- Supabase ---
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) throw new Error('ログインしてください');
  return user.id;
}

export const promptRepository = {
  async findAll(): Promise<Prompt[]> {
    if (!isSupabaseConfigured || !supabase) return local.findAll();
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async findByProjectId(projectId: string): Promise<Prompt[]> {
    if (!isSupabaseConfigured || !supabase) return local.findByProjectId(projectId);
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async findById(id: string): Promise<Prompt | null> {
    if (!isSupabaseConfigured || !supabase) return local.findById(id);
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return fromDB(data);
  },

  async create(data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Prompt> {
    if (!isSupabaseConfigured || !supabase) return local.create(data);
    const userId = await getCurrentUserId();
    const row = { ...toDB(data), user_id: userId };
    const { data: created, error } = await supabase
      .from('prompts')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return fromDB(created);
  },

  async update(
    id: string,
    data: Partial<Omit<Prompt, 'id' | 'createdAt'>>
  ): Promise<Prompt | null> {
    if (!isSupabaseConfigured || !supabase) return local.update(id, data);
    const row = { ...toDB(data), updated_at: new Date().toISOString() };
    const { data: updated, error } = await supabase
      .from('prompts')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromDB(updated);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) { local.delete(id); return; }
    const { error } = await supabase.from('prompts').delete().eq('id', id);
    if (error) throw error;
  },
};
