'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { projectRepository } from '@/lib/repository/projectRepository';
import { Project } from '@/types';
import { toast } from 'sonner';

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    async function load() {
      const p = await projectRepository.findById(id);
      if (!p) { router.push('/projects'); return; }
      setProject(p);
    }
    load();
  }, [id, router]);

  const handleSubmit = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    console.log('[EditProjectPage] handleSubmit called, id:', id);
    await projectRepository.update(id, data);
    console.log('[EditProjectPage] update success');
    toast.success('案件を更新しました');
    console.log('[ProjectForm] after save navigation start → /projects/' + id);
    router.push(`/projects/${id}`);
  };

  if (!project) return <div className="p-6 text-gray-400">読み込み中...</div>;

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">案件を編集</h1>
      <ProjectForm initialData={project} onSubmit={handleSubmit} />
    </div>
  );
}
