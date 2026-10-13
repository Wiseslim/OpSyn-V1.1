// ============================================================
// OPSYN BOQ API CLIENT
// API client for Bill of Quantities management
// ============================================================

import { apiClient } from './client';

// ── Types ────────────────────────────────────────────────────

export interface BOQ {
  id: string;
  tenant_id: string;
  project_id: string;
  design_id: string | null;
  boq_number: string | null;
  boq_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  total_material_cost: number;
  total_product_cost: number;
  total_cost: number;
  notes: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  items: BOQItem[];
}

export interface BOQSummary {
  id: string;
  project_id: string;
  design_id: string | null;
  boq_number: string | null;
  boq_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  total_cost: number;
  item_count: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface BOQItem {
  id: string;
  boq_id: string;
  item_source: 'design' | 'product';
  design_item_id: string | null;
  product_id: string | null;
  item_code: string | null;
  item_name: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  total_cost: number | null;
  supplier: string | null;
  lead_time_days: number | null;
  specifications: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBOQData {
  project_id: string;
  design_id?: string;
  boq_number?: string;
  notes?: string;
  items?: CreateBOQItemData[];
}

export interface CreateBOQItemData {
  item_source: 'design' | 'product';
  design_item_id?: string;
  product_id?: string;
  item_code?: string;
  item_name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_cost?: number;
  supplier?: string;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
}

export interface UpdateBOQData {
  boq_number?: string;
  notes?: string;
}

export interface UpdateBOQItemData {
  item_name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unit_cost?: number;
  supplier?: string;
  lead_time_days?: number;
  specifications?: Record<string, any>;
  notes?: string;
}

export interface BOQApprovalData {
  action: 'submit' | 'approve' | 'reject';
  notes?: string;
}

// ── API Functions ────────────────────────────────────────────

export async function listBOQs(params?: {
  project_id?: string;
  boq_status?: string;
}): Promise<BOQSummary[]> {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id);
  if (params?.boq_status) queryParams.append('boq_status', params.boq_status);

  const url = `/engineering/boq${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<BOQSummary[]>(url);
  return response.data;
}

export async function getBOQ(boqId: string): Promise<BOQ> {
  const response = await apiClient.get<BOQ>(`/engineering/boq/${boqId}`);
  return response.data;
}

export async function createBOQ(data: CreateBOQData): Promise<BOQ> {
  const response = await apiClient.post<BOQ>('/engineering/boq', data);
  return response.data;
}

export async function updateBOQ(boqId: string, data: UpdateBOQData): Promise<BOQ> {
  const response = await apiClient.patch<BOQ>(`/engineering/boq/${boqId}`, data);
  return response.data;
}

export async function deleteBOQ(boqId: string): Promise<void> {
  await apiClient.delete(`/engineering/boq/${boqId}`);
}

export async function generateBOQFromDesign(designId: string, projectId: string): Promise<BOQ> {
  const response = await apiClient.post<BOQ>('/engineering/boq/generate', {
    design_id: designId,
    project_id: projectId,
  });
  return response.data;
}

// ── BOQ Item Functions ───────────────────────────────────────

export async function listBOQItems(boqId: string): Promise<BOQItem[]> {
  const response = await apiClient.get<BOQItem[]>(`/engineering/boq/${boqId}/items`);
  return response.data;
}

export async function createBOQItem(boqId: string, data: CreateBOQItemData): Promise<BOQItem> {
  const response = await apiClient.post<BOQItem>(`/engineering/boq/${boqId}/items`, data);
  return response.data;
}

export async function updateBOQItem(
  boqId: string,
  itemId: string,
  data: UpdateBOQItemData
): Promise<BOQItem> {
  const response = await apiClient.patch<BOQItem>(
    `/engineering/boq/${boqId}/items/${itemId}`,
    data
  );
  return response.data;
}

export async function deleteBOQItem(boqId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/engineering/boq/${boqId}/items/${itemId}`);
}

// ── Workflow Functions ───────────────────────────────────────

export async function submitBOQ(boqId: string, notes?: string): Promise<BOQ> {
  const response = await apiClient.post<BOQ>(`/engineering/boq/${boqId}/submit`, {
    action: 'submit',
    notes,
  });
  return response.data;
}

export async function approveBOQ(boqId: string, notes?: string): Promise<BOQ> {
  const response = await apiClient.post<BOQ>(`/engineering/boq/${boqId}/approve`, {
    action: 'approve',
    notes,
  });
  return response.data;
}

export async function rejectBOQ(boqId: string, notes?: string): Promise<BOQ> {
  const response = await apiClient.post<BOQ>(`/engineering/boq/${boqId}/reject`, {
    action: 'reject',
    notes,
  });
  return response.data;
}

// ── Export Functions ─────────────────────────────────────────

export async function exportBOQToExcel(boqId: string): Promise<Blob> {
  const response = await fetch(`/api/v1/engineering/boq/${boqId}/export/excel`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export BOQ to Excel');
  }

  return response.blob();
}

export async function exportBOQToPDF(boqId: string): Promise<Blob> {
  const response = await fetch(`/api/v1/engineering/boq/${boqId}/export/pdf`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to export BOQ to PDF');
  }

  return response.blob();
}

// ── Statistics ───────────────────────────────────────────────

export async function getBOQStats(params?: { project_id?: string }): Promise<Record<string, any>> {
  const queryParams = new URLSearchParams();
  if (params?.project_id) queryParams.append('project_id', params.project_id);

  const url = `/engineering/boq/stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<Record<string, any>>(url);
  return response.data;
}
