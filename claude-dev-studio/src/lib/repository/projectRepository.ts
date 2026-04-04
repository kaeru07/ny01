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
    url: row.url ?? '',
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
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
  if (data.url !== undefined) row.url = data.url;
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
async function getCurrentUser() {
  const { data: { user }, error } = await supabase!.auth.getUser();
  console.log('[ProjectRepository] current user:', user ?? null);
  console.log('[ProjectRepository] user_id:', user?.id ?? null);
  if (error) console.warn('[ProjectRepository] auth.getUser error:', error);
  if (!user) throw new Error('ログインしてください');
  return user;
}

export const projectRepository = {
  async findAll(): Promise<Project[]> {
    console.log('[ProjectRepository] list called, supabaseConfigured:', isSupabaseConfigured);
    if (!isSupabaseConfigured || !supabase) {
      const rows = local.findAll();
      console.log('[ProjectRepository] list query result (local):', rows.length, 'rows');
      return rows;
    }
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[ProjectRepository] list current user:', user?.id ?? null);

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    console.log('[ProjectRepository] list query result: data=', data?.length ?? null, 'rows, error=', error);
    if (error) {
      console.error('[ProjectRepository] list error:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      throw error;
    }
    return (data ?? []).map(fromDB);
  },

  async findById(id: string): Promise<Project | null> {
    console.log('[ProjectRepository] findById called, id:', id);
    if (!isSupabaseConfigured || !supabase) return local.findById(id);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    console.log('[ProjectRepository] findById result: data=', data?.id ?? null, 'error=', error?.code ?? null);
    if (error) {
      if (error.code === 'PGRST116') {
        console.warn('[ProjectRepository] findById: not found (PGRST116), id:', id);
        return null;
      }
      console.error('[ProjectRepository] findById error:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      throw error;
    }
    return fromDB(data);
  },

  async create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    console.log('[ProjectRepository] create called, supabaseConfigured:', isSupabaseConfigured);
    if (!isSupabaseConfigured || !supabase) {
      console.log('[ProjectRepository] Supabase 未設定 → localStorage fallback');
      return local.create(data);
    }

    const user = await getCurrentUser();
    const row = { ...toDB(data), user_id: user.id };

    // カラム名確認用: toDB が何を生成したか
    console.log('[ProjectRepository] insert payload:', JSON.stringify(row, null, 2));
    console.log('[ProjectRepository] payload keys:', Object.keys(row));

    const { data: created, error } = await supabase
      .from('projects')
      .insert(row)
      .select()
      .single();

    // Supabase 生の返り値を必ず出す
    console.log('[ProjectRepository] supabase response: data =', created, '/ error =', error);

    if (error) {
      console.error('[ProjectRepository] supabase error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    console.log('[ProjectRepository] ✅ insert success, id:', created?.id);
    return fromDB(created);
  },

  async update(
    id: string,
    data: Partial<Omit<Project, 'id' | 'createdAt'>>
  ): Promise<Project | null> {
    console.log('[ProjectRepository] update called, id:', id, 'supabaseConfigured:', isSupabaseConfigured);
    if (!isSupabaseConfigured || !supabase) return local.update(id, data);

    // update でも current user を確認（RLS デバッグ用）
    await getCurrentUser();

    const row = { ...toDB(data), updated_at: new Date().toISOString() };

    console.log('[ProjectRepository] insert payload:', JSON.stringify(row, null, 2));
    console.log('[ProjectRepository] payload keys:', Object.keys(row));

    const { data: updated, error } = await supabase
      .from('projects')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    // Supabase 生の返り値を必ず出す
    console.log('[ProjectRepository] supabase response: data =', updated, '/ error =', error);

    if (error) {
      console.error('[ProjectRepository] supabase error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }
    console.log('[ProjectRepository] ✅ update success, id:', updated?.id);
    return fromDB(updated);
  },

  async delete(id: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) { local.delete(id); return; }
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;
  },
};
