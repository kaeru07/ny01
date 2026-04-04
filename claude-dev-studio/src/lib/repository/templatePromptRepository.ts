import { TemplatePrompt } from '@/types';
import { storage } from './storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const KEY = 'cds_template_prompts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDB(row: any): TemplatePrompt {
  return {
    id: row.id,
    name: row.name ?? '',
    category: row.category ?? '',
    description: row.description ?? '',
    content: row.content ?? '',
    tags: row.tags ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
}

function toDB(data: Partial<Omit<TemplatePrompt, 'id' | 'createdAt' | 'updatedAt'>>) {
  const row: Record<string, unknown> = {};
  if (data.name !== undefined) row.name = data.name;
  if (data.category !== undefined) row.category = data.category;
  if (data.description !== undefined) row.description = data.description;
  if (data.content !== undefined) row.content = data.content;
  if (data.tags !== undefined) row.tags = data.tags;
  return row;
}

const local = {
  findAll(): TemplatePrompt[] { return storage.get<TemplatePrompt[]>(KEY) ?? []; },
  findById(id: string): TemplatePrompt | null {
    return this.findAll().find((p) => p.id === id) ?? null;
  },
  create(data: Omit<TemplatePrompt, 'id' | 'createdAt' | 'updatedAt'>): TemplatePrompt {
    const now = new Date().toISOString();
    const prompt: TemplatePrompt = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    storage.set(KEY, [...this.findAll(), prompt]);
    return prompt;
  },
  update(id: string, data: Partial<Omit<TemplatePrompt, 'id' | 'createdAt'>>): TemplatePrompt | null {
    const all = this.findAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: TemplatePrompt = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
    all[idx] = updated;
    storage.set(KEY, all);
    return updated;
  },
  delete(id: string): void {
    storage.set(KEY, this.findAll().filter((p) => p.id !== id));
  },
};

async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) throw new Error('ログインしてください');
  return user.id;
}

export const templatePromptRepository = {
  async findAll(): Promise<TemplatePrompt[]> {
    if (!isSupabaseConfigured || !supabase) return local.findAll();
    const { data, error } = await supabase
      .from('template_prompts')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async findById(id: string): Promise<TemplatePrompt | null> {
    if (!isSupabaseConfigured || !supabase) return local.findById(id);
    const { data, error } = await supabase
      .from('template_prompts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return fromDB(data);
  },

  async create(data: Omit<TemplatePrompt, 'id' | 'createdAt' | 'updatedAt'>): Promise<TemplatePrompt> {
    if (!isSupabaseConfigured || !supabase) return local.create(data);
    const userId = await getCurrentUserId();
    const row = { ...toDB(data), user_id: userId };
    const { data: created, error } = await supabase
      .from('template_prompts')
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return fromDB(created);
  },

  async update(id: string, data: Partial<Omit<TemplatePrompt, 'id' | 'createdAt'>>): Promise<TemplatePrompt | null> {
    if (!isSupabaseConfigured || !supabase) return local.update(id, data);
    const row = { ...toDB(data), updated_at: new Date().toISOString() };
    const { data: updated, error } = await supabase
      .from('template_prompts')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return fromDB(updated);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) { local.delete(id); return; }
    const { error } = await supabase.from('template_prompts').delete().eq('id', id);
    if (error) throw error;
  },
};
