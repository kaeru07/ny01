'use client';

import { useRouter } from 'next/navigation';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { projectRepository } from '@/lib/repository/projectRepository';
import { Project } from '@/types';
import { toast } from 'sonner';

export default function NewProjectPage() {
  const router = useRouter();

  const handleSubmit = (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const project = projectRepository.create(data);
    toast.success('案件を作成しました');
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white mb-6">新しい案件を作成</h1>
      <ProjectForm onSubmit={handleSubmit} />
    </div>
  );
}
