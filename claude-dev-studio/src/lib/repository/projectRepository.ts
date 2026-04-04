import { Project } from '@/types';
import { storage } from './storage';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const KEY = 'cds_projects';

// --- DB ↔ TypeScript 変換 ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDB(row: any): Project {
  return {
    id: row.id,
    title: row.title ?? '',
    summary: row.summary ?? '',
    target: row.target ?? '',
    problem: row.problem ?? '',
    mvpFeatures: row.mvp_features ?? '',
    futureFeatures: row.future_features ?? '',
    techStack: row.tech_stack ?? '',
    designPolicy: row.design_policy ?? '',
    memo: row.memo ?? '',
    status: row.status ?? 'planning',
    todos: Array.isArray(row.todos) ? row.todos : [],
    nextAction: row.next_action ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDB(data: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>) {
  const row: Record<string, unknown> = {};
  if (data.title !== undefined) row.title = data.title;
  if (data.summary !== undefined) row.summary = data.summary;
  if (data.target !== undefined) row.target = data.target;
  if (data.problem !== undefined) row.problem = data.problem;
  if (data.mvpFeatures !== undefined) row.mvp_features = data.mvpFeatures;
  if (data.futureFeatures !== undefined) row.future_features = data.futureFeatures;
  if (data.techStack !== undefined) row.tech_stack = data.techStack;
  if (data.designPolicy !== undefined) row.design_policy = data.designPolicy;
  if (data.memo !== undefined) row.memo = data.memo;
  if (data.status !== undefined) row.status = data.status;
  if (data.todos !== undefined) row.todos = data.todos;
  if (data.nextAction !== undefined) row.next_action = data.nextAction;
  return row;
}

// --- localStorage fallback ---
const local = {
  findAll(): Project[] { return storage.get<Project[]>(KEY) ?? []; },
  findById(id: string): Project | null {
    return this.findAll().find((p) => p.id === id) ?? null;
  },
  create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const now = new Date().toISOString();
    const project: Project = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    storage.set(KEY, [...this.findAll(), project]);
    return project;
  },
  update(id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const all = this.findAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: Project = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
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
  const { data: { user }, error } = await supabase!.auth.getUser();
  console.log('[projectRepository] getCurrentUserId:', user?.id ?? null, error ?? null);
  if (!user) throw new Error('ログインしてください');
  return user.id;
}

export const projectRepository = {
  async findAll(): Promise<Project[]> {
    if (!isSupabaseConfigured || !supabase) return local.findAll();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async findById(id: string): Promise<Project | null> {
    if (!isSupabaseConfigured || !supabase) return local.findById(id);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }
    return fromDB(data);
  },

  async create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    console.log('[projectRepository] create called, supabaseConfigured:', isSupabaseConfigured);
    if (!isSupabaseConfigured || !supabase) return local.create(data);
    const userId = await getCurrentUserId();
    const row = { ...toDB(data), user_id: userId };
    console.log('[projectRepository] inserting row:', row);
    const { data: created, error } = await supabase
      .from('projects')
      .insert(row)
      .select()
      .single();
    if (error) {
      console.error('[projectRepository] insert error:', error);
      throw error;
    }
    console.log('[projectRepository] insert success:', created?.id);
    return fromDB(created);
  },

  async update(
    id: string,
    data: Partial<Omit<Project, 'id' | 'createdAt'>>
  ): Promise<Project | null> {
    console.log('[projectRepository] update called, id:', id, 'supabaseConfigured:', isSupabaseConfigured);
    if (!isSupabaseConfigured || !supabase) return local.update(id, data);
    const row = { ...toDB(data), updated_at: new Date().toISOString() };
    console.log('[projectRepository] updating row:', row);
    const { data: updated, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) {
      console.error('[projectRepository] update error:', error);
      throw error;
    }
    console.log('[projectRepository] update success:', updated?.id);
    return fromDB(updated);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) { local.delete(id); return; }
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
