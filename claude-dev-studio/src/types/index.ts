export type ProjectStatus = 'planning' | 'active' | 'adjusting' | 'done' | 'paused';
export type PromptCategory = 'new' | 'fix' | 'ui' | 'debug';
export type TodoPriority = 'low' | 'medium' | 'high';

// AICOMPANYロール（プロンプト管理で引き続き使用）
export type AICOMPANYRole =
  | 'secretary'
  | 'researcher'
  | 'architect'
  | 'ui_designer'
  | 'coder'
  | 'reviewer'
  | 'deployer';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  priority: TodoPriority;
  dueDate?: string | null; // YYYY-MM-DD or null
  note?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  target: string;
  problem: string;
  mvpFeatures: string;
  futureFeatures: string;
  techStack: string;
  designPolicy: string;
  memo: string;
  status: ProjectStatus;
  todos: Todo[];
  nextAction?: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DevNote {
  id: string;
  projectId: string;
  requirements: string;
  mvpScope: string;
  screens: string;
  dataStructure: string;
  tasks: string;
  implementOrder: string;
  cautions: string;
  updatedAt: string;
}

export interface Prompt {
  id: string;
  projectId: string;
  category: PromptCategory;
  version: string;
  title: string;
  body: string;
  changeMemo: string;
  targetRole?: AICOMPANYRole | '';
  createdAt: string;
  updatedAt: string;
}
