// ============================================================
// OPSYN DEPLOYMENT API CLIENT
// API client for deployment tracking and management
// ============================================================

import { apiClient } from './client';

// ── Types ────────────────────────────────────────────────────

export interface Deployment {
  id: string;
  tenant_id: string;
  project_id: string;
  design_id: string | null;
  boq_id: string | null;
  deployment_type: string | null;
  deployment_status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  assigned_crew_id: string | null;
  crew_lead_id: string | null;
  completion_pct: number;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  milestones: DeploymentMilestone[];
}

export interface DeploymentSummary {
  id: string;
  project_id: string;
  design_id: string | null;
  deployment_type: string | null;
  deployment_status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  completion_pct: number;
  milestone_count: number;
  milestones_completed: number;
  created_at: string;
}

export interface DeploymentMilestone {
  id: string;
  deployment_id: string;
  milestone_name: string;
  milestone_order: number;
  description: string | null;
  milestone_status: string;
  due_date: string | null;
  completed_date: string | null;
  completed_by: string | null;
  blocker_reason: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateDeploymentData {
  design_id?: string;
  boq_id?: string;
  deployment_type?: 'new_build' | 'upgrade' | 'extension' | 'repair';
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_crew_id?: string;
  crew_lead_id?: string;
  notes?: string;
  metadata?: Record<string, any>;
  milestones?: CreateMilestoneData[];
}

export interface CreateMilestoneData {
  milestone_name: string;
  milestone_order: number;
  description?: string;
  due_date?: string;
  metadata?: Record<string, any>;
}

export interface UpdateDeploymentData {
  deployment_type?: 'new_build' | 'upgrade' | 'extension' | 'repair';
  deployment_status?: 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  assigned_crew_id?: string;
  crew_lead_id?: string;
  completion_pct?: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface UpdateProgressData {
  completion_pct: number;
  notes?: string;
}

export interface UpdateMilestoneData {
  milestone_name?: string;
  milestone_order?: number;
  description?: string;
  milestone_status?: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  due_date?: string;
  completed_date?: string;
  blocker_reason?: string;
  metadata?: Record<string, any>;
}

// ── API Functions ────────────────────────────────────────────

export async function listDeployments(params?: {
  project_id?: string;
  deployment_status?: string;
}): Promise<DeploymentSummary[]> {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id);
  if (params?.deployment_status) queryParams.append('deployment_status', params.deployment_status);

  const url = `/engineering/deployments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<DeploymentSummary[]>(url);
  return response.data;
}

export async function getDeployment(deploymentId: string): Promise<Deployment> {
  const response = await apiClient.get<Deployment>(`/engineering/deployments/${deploymentId}`);
  return response.data;
}

export async function createDeployment(
  projectId: string,
  data: CreateDeploymentData
): Promise<Deployment> {
  const response = await apiClient.post<Deployment>('/engineering/deployments', {
    project_id: projectId,
    ...data,
  });
  return response.data;
}

export async function updateDeployment(
  deploymentId: string,
  data: UpdateDeploymentData
): Promise<Deployment> {
  const response = await apiClient.patch<Deployment>(
    `/engineering/deployments/${deploymentId}`,
    data
  );
  return response.data;
}

export async function deleteDeployment(deploymentId: string): Promise<void> {
  await apiClient.delete(`/engineering/deployments/${deploymentId}`);
}

export async function updateDeploymentProgress(
  deploymentId: string,
  data: UpdateProgressData
): Promise<Deployment> {
  const response = await apiClient.put<Deployment>(
    `/engineering/deployments/${deploymentId}/progress`,
    data
  );
  return response.data;
}

// ── Milestone Functions ──────────────────────────────────────

export async function listMilestones(deploymentId: string): Promise<DeploymentMilestone[]> {
  const response = await apiClient.get<DeploymentMilestone[]>(
    `/engineering/deployments/${deploymentId}/milestones`
  );
  return response.data;
}

export async function createMilestone(
  deploymentId: string,
  data: CreateMilestoneData
): Promise<DeploymentMilestone> {
  const response = await apiClient.post<DeploymentMilestone>(
    `/engineering/deployments/${deploymentId}/milestones`,
    data
  );
  return response.data;
}

export async function updateMilestone(
  deploymentId: string,
  milestoneId: string,
  data: UpdateMilestoneData
): Promise<DeploymentMilestone> {
  const response = await apiClient.patch<DeploymentMilestone>(
    `/engineering/deployments/${deploymentId}/milestones/${milestoneId}`,
    data
  );
  return response.data;
}

export async function deleteMilestone(
  deploymentId: string,
  milestoneId: string
): Promise<void> {
  await apiClient.delete(`/engineering/deployments/${deploymentId}/milestones/${milestoneId}`);
}

export async function getProposedDeployments(): Promise<any[]> {
  const response = await apiClient.get<any[]>('/engineering/deployments/proposed/list');
  return response.data;
}
