import { Prompt } from '@/types';
import { storage } from './storage';

const KEY = 'cds_prompts';

export const promptRepository = {
  findAll(): Prompt[] {
    return storage.get<Prompt[]>(KEY) ?? [];
  },

  findByProjectId(projectId: string): Prompt[] {
    return this.findAll().filter((p) => p.projectId === projectId);
  },

  findById(id: string): Prompt | null {
    return this.findAll().find((p) => p.id === id) ?? null;
  },

  create(data: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'>): Prompt {
    const now = new Date().toISOString();
    const prompt: Prompt = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.findAll();
    storage.set(KEY, [...all, prompt]);
    return prompt;
  },

  update(id: string, data: Partial<Omit<Prompt, 'id' | 'createdAt'>>): Prompt | null {
    const all = this.findAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: Prompt = {
      ...all[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    storage.set(KEY, all);
    return updated;
  },

  delete(id: string): void {
    const all = this.findAll().filter((p) => p.id !== id);
    storage.set(KEY, all);
  },
};
