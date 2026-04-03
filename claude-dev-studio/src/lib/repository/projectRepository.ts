import { Project } from '@/types';
import { storage } from './storage';

const KEY = 'cds_projects';

export const projectRepository = {
  findAll(): Project[] {
    return storage.get<Project[]>(KEY) ?? [];
  },

  findById(id: string): Project | null {
    const all = this.findAll();
    return all.find((p) => p.id === id) ?? null;
  },

  create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const now = new Date().toISOString();
    const project: Project = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const all = this.findAll();
    storage.set(KEY, [...all, project]);
    return project;
  },

  update(id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const all = this.findAll();
    const idx = all.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const updated: Project = {
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
