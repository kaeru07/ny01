export type ProjectStatus = 'planning' | 'active' | 'done' | 'paused';
export type PromptCategory = 'new' | 'fix' | 'ui' | 'debug';

export type ProjectPhase =
  | 'consulting'
  | 'requirements'
  | 'research'
  | 'design'
  | 'ui_design'
  | 'implementation'
  | 'review'
  | 'deploy_prep'
  | 'done';

export type AICOMPANYRole =
  | 'secretary'
  | 'researcher'
  | 'architect'
  | 'ui_designer'
  | 'coder'
  | 'reviewer'
  | 'deployer';

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
  // AICOMPANY進行管理
  currentPhase?: ProjectPhase;
  currentOwner?: AICOMPANYRole;
  nextOwner?: AICOMPANYRole | '';
  // 担当別メモ
  secretaryNotes?: string;
  researcherNotes?: string;
  architectNotes?: string;
  uiDesignerNotes?: string;
  coderNotes?: string;
  reviewerNotes?: string;
  deployerNotes?: string;
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
