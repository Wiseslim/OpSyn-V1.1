// ============================================================
// OPSYN AS-BUILT API CLIENT
// API client for as-built documentation and variance tracking
// ============================================================

import { apiClient } from './client';

// ── Types ────────────────────────────────────────────────────

export interface AsBuilt {
  id: string;
  tenant_id: string;
  project_id: string;
  deployment_id: string;
  design_id: string | null;
  as_built_status: string;
  design_variance_pct: number | null;
  variance_notes: string | null;
  as_built_data: Record<string, any>;
  test_results: Record<string, any>;
  photos: any[];
  documents: any[];
  submitted_by: string | null;
  verified_by: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  items: AsBuiltItem[];
}

export interface AsBuiltSummary {
  id: string;
  project_id: string;
  deployment_id: string;
  as_built_status: string;
  design_variance_pct: number | null;
  item_count: number;
  submitted_at: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface AsBuiltItem {
  id: string;
  as_built_id: string;
  design_item_id: string | null;
  item_type: string;
  item_name: string;
  design_quantity: number | null;
  actual_quantity: number | null;
  variance_quantity: number | null;
  unit: string | null;
  design_location: any | null;
  actual_location: any | null;
  location_variance_m: number | null;
  installed_date: string | null;
  serial_numbers: string[] | null;
  specifications: Record<string, any>;
  notes: string | null;
  photos: any[];
  created_at: string;
  updated_at: string;
}

export interface CreateAsBuiltData {
  deployment_id: string;
  design_id?: string;
  variance_notes?: string;
  as_built_data?: Record<string, any>;
  test_results?: Record<string, any>;
  photos?: any[];
  documents?: any[];
  notes?: string;
  items?: CreateAsBuiltItemData[];
}

export interface CreateAsBuiltItemData {
  design_item_id?: string;
  item_type: string;
  item_name: string;
  design_quantity?: number;
  actual_quantity?: number;
  unit?: string;
  design_location?: any;
  actual_location?: any;
  installed_date?: string;
  serial_numbers?: string[];
  specifications?: Record<string, any>;
  notes?: string;
  photos?: any[];
}

export interface UpdateAsBuiltData {
  design_variance_pct?: number;
  variance_notes?: string;
  as_built_data?: Record<string, any>;
  test_results?: Record<string, any>;
  photos?: any[];
  documents?: any[];
  notes?: string;
}

export interface UpdateAsBuiltItemData {
  item_name?: string;
  design_quantity?: number;
  actual_quantity?: number;
  unit?: string;
  actual_location?: any;
  installed_date?: string;
  serial_numbers?: string[];
  specifications?: Record<string, any>;
  notes?: string;
  photos?: any[];
}

export interface AsBuiltSubmissionData {
  action: 'submit' | 'verify' | 'reject';
  notes?: string;
}

export interface VarianceStats {
  total_items: number;
  items_with_variance: number;
  avg_location_variance_m: number;
  max_location_variance_m: number;
  items_within_tolerance: number;
  variance_by_type: Record<string, {
    count: number;
    avg_m: number;
    max_m: number;
  }>;
}

// ── API Functions ────────────────────────────────────────────

export async function listAsBuiltRecords(params?: {
  deployment_id?: string;
  project_id?: string;
  as_built_status?: string;
}): Promise<AsBuiltSummary[]> {
  const queryParams = new URLSearchParams();
  if (params?.deployment_id) queryParams.append('deployment_id', params.deployment_id);
  if (params?.project_id) queryParams.append('project_id', params.project_id);
  if (params?.as_built_status) queryParams.append('as_built_status', params.as_built_status);

  const url = `/engineering/as-built${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<AsBuiltSummary[]>(url);
  return response.data;
}

export async function getAsBuiltRecord(asBuiltId: string): Promise<AsBuilt> {
  const response = await apiClient.get<AsBuilt>(`/engineering/as-built/${asBuiltId}`);
  return response.data;
}

export async function createAsBuiltRecord(data: CreateAsBuiltData): Promise<AsBuilt> {
  const response = await apiClient.post<AsBuilt>('/engineering/as-built', data);
  return response.data;
}

export async function updateAsBuiltRecord(
  asBuiltId: string,
  data: UpdateAsBuiltData
): Promise<AsBuilt> {
  const response = await apiClient.patch<AsBuilt>(`/engineering/as-built/${asBuiltId}`, data);
  return response.data;
}

export async function deleteAsBuiltRecord(asBuiltId: string): Promise<void> {
  await apiClient.delete(`/engineering/as-built/${asBuiltId}`);
}

// ── Item Functions ───────────────────────────────────────────

export async function listAsBuiltItems(asBuiltId: string): Promise<AsBuiltItem[]> {
  const response = await apiClient.get<AsBuiltItem[]>(`/engineering/as-built/${asBuiltId}/items`);
  return response.data;
}

export async function createAsBuiltItem(
  asBuiltId: string,
  data: CreateAsBuiltItemData
): Promise<AsBuiltItem> {
  const response = await apiClient.post<AsBuiltItem>(
    `/engineering/as-built/${asBuiltId}/items`,
    data
  );
  return response.data;
}

export async function updateAsBuiltItem(
  asBuiltId: string,
  itemId: string,
  data: UpdateAsBuiltItemData
): Promise<AsBuiltItem> {
  const response = await apiClient.patch<AsBuiltItem>(
    `/engineering/as-built/${asBuiltId}/items/${itemId}`,
    data
  );
  return response.data;
}

export async function deleteAsBuiltItem(asBuiltId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/engineering/as-built/${asBuiltId}/items/${itemId}`);
}

export async function addPhotoToItem(
  asBuiltId: string,
  itemId: string,
  photoUrl: string
): Promise<AsBuiltItem> {
  const response = await apiClient.post<AsBuiltItem>(
    `/engineering/as-built/${asBuiltId}/items/${itemId}/photos`,
    { photo_url: photoUrl }
  );
  return response.data;
}

// ── Workflow Functions ───────────────────────────────────────

export async function submitAsBuilt(asBuiltId: string): Promise<AsBuilt> {
  const response = await apiClient.post<AsBuilt>(`/engineering/as-built/${asBuiltId}/submit`);
  return response.data;
}

export async function verifyAsBuilt(
  asBuiltId: string,
  data: AsBuiltSubmissionData
): Promise<AsBuilt> {
  const response = await apiClient.post<AsBuilt>(
    `/engineering/as-built/${asBuiltId}/verify`,
    data
  );
  return response.data;
}

export async function finalizeAsBuilt(asBuiltId: string): Promise<AsBuilt> {
  const response = await apiClient.post<AsBuilt>(`/engineering/as-built/${asBuiltId}/finalize`);
  return response.data;
}

export async function promoteAsBuilt(asBuiltId: string): Promise<AsBuilt> {
  const response = await apiClient.post<AsBuilt>(`/engineering/as-built/${asBuiltId}/promote`);
  return response.data;
}

// ── Statistics ───────────────────────────────────────────────

export async function getAsBuiltVariance(asBuiltId: string): Promise<VarianceStats> {
  const response = await apiClient.get<VarianceStats>(
    `/engineering/as-built/${asBuiltId}/variance`
  );
  return response.data;
}

export async function getAsBuiltStats(params?: {
  deployment_id?: string;
  project_id?: string;
}): Promise<Record<string, any>> {
  const queryParams = new URLSearchParams();
  if (params?.deployment_id) queryParams.append('deployment_id', params.deployment_id);
  if (params?.project_id) queryParams.append('project_id', params.project_id);

  const url = `/engineering/as-built/stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<Record<string, any>>(url);
  return response.data;
}
