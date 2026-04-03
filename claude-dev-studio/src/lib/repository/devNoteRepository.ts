import { DevNote } from '@/types';
import { storage } from './storage';

const KEY = 'cds_devnotes';

export const devNoteRepository = {
  findAll(): DevNote[] {
    return storage.get<DevNote[]>(KEY) ?? [];
  },

  findByProjectId(projectId: string): DevNote | null {
    const all = this.findAll();
    return all.find((n) => n.projectId === projectId) ?? null;
  },

  upsert(projectId: string, data: Partial<Omit<DevNote, 'id' | 'projectId' | 'updatedAt'>>): DevNote {
    const all = this.findAll();
    const existing = all.find((n) => n.projectId === projectId);
    const now = new Date().toISOString();
    if (existing) {
      const updated: DevNote = { ...existing, ...data, updatedAt: now };
      const newAll = all.map((n) => (n.projectId === projectId ? updated : n));
      storage.set(KEY, newAll);
      return updated;
    } else {
      const note: DevNote = {
        id: crypto.randomUUID(),
        projectId,
        requirements: '',
        mvpScope: '',
        screens: '',
        dataStructure: '',
        tasks: '',
        implementOrder: '',
        cautions: '',
        ...data,
        updatedAt: now,
      };
      storage.set(KEY, [...all, note]);
      return note;
    }
  },

  delete(id: string): void {
    const all = this.findAll().filter((n) => n.id !== id);
    storage.set(KEY, all);
  },
};
