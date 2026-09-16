// ============================================================
// OPSYN — Form Builder API client
// src/api/form-builder.api.ts
// Calls /api/v1/form-builder/* (Phase 3 & 4 backend)
//
// All responses are { success: boolean; data: T } — use .data.data
// ============================================================

import client from './client';

// ── Narrow APIResponse wrapper (matches backend envelope) ─────
type AR<T> = { success: boolean; data: T };

// ── Types ─────────────────────────────────────────────────────

export interface FieldTypeInfo {
  key:              string;
  label:            string;
  category:         string;
  has_options:      boolean;
  validation_rules: string[];
}

export interface FormSchema {
  id:              string;
  tenant_id:       string;
  name:            string;
  machine_name:    string;
  description:     string | null;
  module:          string;
  status:          'draft' | 'published' | 'archived';
  current_version: number;
  icon:            string | null;
  color:           string | null;
  created_by:      string | null;
  created_at:      string;
  updated_at:      string;
}

export interface FieldDefinition {
  id:                  string;
  schema_id:           string;
  tenant_id:           string;
  field_key:           string;
  label:               string;
  placeholder:         string | null;
  help_text:           string | null;
  field_type:          string;
  display_order:       number;
  is_required:         boolean;
  is_unique:           boolean;
  is_readonly:         boolean;
  is_hidden:           boolean;
  default_value:       unknown;
  validation_rules:    Record<string, unknown>;
  options:             string[] | null;
  conditional_logic:   unknown;
  role_visibility:     string[] | null;
  role_editable:       string[] | null;
  stage_visible_from:  number | null;
  stage_required_at:   number | null;
  department_owner:    string | null;
  width:               string;
  section_group:       string | null;
  schema_version_id:   string | null;
  created_by:          string | null;
  created_at:          string;
  updated_at:          string;
}

export interface FormSchemaVersion {
  id:             string;
  schema_id:      string;
  tenant_id:      string;
  version_number: number;
  published_at:   string | null;
  published_by:   string | null;
  field_snapshot: FieldDefinition[];
  changelog:      string | null;
  is_current:     boolean;
  created_at:     string;
}

// List endpoint returns data array at root level alongside pagination metadata
export interface SchemaListResult {
  schemas: FormSchema[];
  total:   number;
  page:    number;
  limit:   number;
}

// ── Submission types ──────────────────────────────────────────

export interface ValidationError {
  field_key:   string;
  field_label: string;
  error_code:  string;
  message:     string;
}

export interface ValidationWarning {
  field_key: string;
  message:   string;
}

export interface ValidationResult {
  is_valid:                boolean;
  errors:                  ValidationError[];
  warnings:                ValidationWarning[];
  missing_required_fields: string[];
  coerced_data:            Record<string, unknown>;
}

export interface FormSubmission {
  id:                string;
  tenant_id:         string;
  schema_id:         string;
  schema_version_id: string | null;
  entity_type:       string;
  entity_id:         string | null;
  association_id:    string | null;
  submitted_by:      string | null;
  submitted_at:      string;
  status:            'draft' | 'submitted' | 'approved' | 'rejected';
  data:              Record<string, unknown>;
  draft_data:        Record<string, unknown> | null;
  approved_by:       string | null;
  approved_at:       string | null;
  rejection_reason:  string | null;
  is_deleted:        boolean;
  created_at:        string;
  updated_at:        string;
}

export interface RendererConfig {
  schema:      FormSchema;
  version:     FormSchemaVersion | null;
  fields:      FieldDefinition[];
  field_types: FieldTypeInfo[];
}

export interface FormAssociation {
  id:                   string;
  tenant_id:            string;
  schema_id:            string;
  schema_version_id:    string | null;
  context_type:         string;
  context_id:           string | null;
  context_label:        string;
  is_mandatory:         boolean;
  display_order:        number;
  trigger_event:        string | null;
  auto_populate_fields: Record<string, unknown> | null;
  created_by:           string | null;
  created_at:           string;
  updated_at:           string;
}

export interface ContextSchema {
  association: FormAssociation;
  schema: {
    id:              string;
    name:            string;
    machine_name:    string;
    module:          string;
    status:          string;
    current_version: number;
    is_mandatory:    boolean;
    trigger_event:   string | null;
  };
}

// ── API module ─────────────────────────────────────────────────

export const formBuilderApi = {

  // Field type catalogue (static, cache forever)
  getFieldTypes: (): Promise<FieldTypeInfo[]> =>
    client.get<AR<FieldTypeInfo[]>>('/form-builder/field-types')
      .then(r => r.data.data),

  // ── Schema CRUD ────────────────────────────────────────────

  getSchemas: (params?: {
    module?:  string;
    status?:  string;
    search?:  string;
    page?:    number;
    limit?:   number;
  }): Promise<SchemaListResult> =>
    client.get('/form-builder/schemas', { params })
      .then(r => ({
        schemas: (r.data.data   ?? []) as FormSchema[],
        total:   (r.data.total  ?? 0)  as number,
        page:    (r.data.page   ?? 1)  as number,
        limit:   (r.data.limit  ?? 20) as number,
      })),

  createSchema: (data: {
    name:         string;
    machine_name: string;
    module:       string;
    description?: string;
    icon?:        string;
    color?:       string;
  }): Promise<FormSchema> =>
    client.post<AR<FormSchema>>('/form-builder/schemas', data)
      .then(r => r.data.data),

  getSchema: (id: string): Promise<FormSchema> =>
    client.get<AR<FormSchema>>(`/form-builder/schemas/${id}`)
      .then(r => r.data.data),

  updateSchema: (
    id:   string,
    data: Partial<{ name: string; description: string; icon: string; color: string; module: string }>,
  ): Promise<FormSchema> =>
    client.put<AR<FormSchema>>(`/form-builder/schemas/${id}`, data)
      .then(r => r.data.data),

  deleteSchema: (id: string): Promise<void> =>
    client.delete(`/form-builder/schemas/${id}`).then(() => undefined),

  publishSchema: (id: string, changelog?: string): Promise<FormSchemaVersion> =>
    client.post<AR<FormSchemaVersion>>(
      `/form-builder/schemas/${id}/publish`,
      { changelog: changelog ?? null },
    ).then(r => r.data.data),

  archiveSchema: (id: string): Promise<FormSchema> =>
    client.post<AR<FormSchema>>(`/form-builder/schemas/${id}/archive`)
      .then(r => r.data.data),

  // ── Version history ────────────────────────────────────────

  getSchemaVersions: (id: string): Promise<FormSchemaVersion[]> =>
    client.get<AR<FormSchemaVersion[]>>(`/form-builder/schemas/${id}/versions`)
      .then(r => r.data.data),

  getSchemaVersion: (id: string, versionId: string): Promise<FormSchemaVersion> =>
    client.get<AR<FormSchemaVersion>>(
      `/form-builder/schemas/${id}/versions/${versionId}`,
    ).then(r => r.data.data),

  // ── Field CRUD ─────────────────────────────────────────────

  getFields: (schemaId: string): Promise<FieldDefinition[]> =>
    client.get<AR<FieldDefinition[]>>(
      `/form-builder/schemas/${schemaId}/fields`,
    ).then(r => r.data.data),

  createField: (
    schemaId: string,
    data: {
      field_key:   string;
      label:       string;
      field_type:  string;
      [k: string]: unknown;
    },
  ): Promise<FieldDefinition> =>
    client.post<AR<FieldDefinition>>(
      `/form-builder/schemas/${schemaId}/fields`, data,
    ).then(r => r.data.data),

  updateField: (
    schemaId: string,
    fieldId:  string,
    data: {
      label?:              string;
      placeholder?:        string | null;
      help_text?:          string | null;
      is_required?:        boolean;
      is_unique?:          boolean;
      is_readonly?:        boolean;
      is_hidden?:          boolean;
      default_value?:      string | null;
      validation_rules?:   Record<string, unknown>;
      options?:            string[];
      width?:              string;
      section_group?:      string | null;
      conditional_logic?:  unknown;
      role_visibility?:    string[];
      role_editable?:      string[];
      stage_visible_from?: number | null;
      stage_required_at?:  number | null;
    },
  ): Promise<FieldDefinition> =>
    client.put<AR<FieldDefinition>>(
      `/form-builder/schemas/${schemaId}/fields/${fieldId}`, data,
    ).then(r => r.data.data),

  deleteField: (schemaId: string, fieldId: string): Promise<void> =>
    client.delete(
      `/form-builder/schemas/${schemaId}/fields/${fieldId}`,
    ).then(() => undefined),

  // order = list of field UUIDs in the desired display order
  reorderFields: (schemaId: string, order: string[]): Promise<FieldDefinition[]> =>
    client.patch<AR<FieldDefinition[]>>(
      `/form-builder/schemas/${schemaId}/fields/reorder`, { order },
    ).then(r => r.data.data),

  // ── Renderer config ────────────────────────────────────────

  getRendererConfig: (schemaId: string): Promise<RendererConfig> =>
    client.get<AR<RendererConfig>>(
      `/form-builder/schemas/${schemaId}/renderer-config`,
    ).then(r => r.data.data),

  // ── Submissions ────────────────────────────────────────────

  validateSubmission: (data: {
    schema_id:             string;
    data:                  Record<string, unknown>;
    pipeline_stage_order?: number;
    is_draft?:             boolean;
  }): Promise<ValidationResult> =>
    client.post<AR<ValidationResult>>(
      '/form-builder/submissions/validate', data,
    ).then(r => r.data.data),

  saveDraft: (data: {
    schema_id:             string;
    entity_type:           string;
    entity_id?:            string;
    association_id?:       string;
    data:                  Record<string, unknown>;
    draft_id?:             string;
    pipeline_stage_order?: number;
  }): Promise<FormSubmission> =>
    client.post<AR<FormSubmission>>(
      '/form-builder/submissions/draft', data,
    ).then(r => r.data.data),

  submitForm: (data: {
    schema_id:             string;
    entity_type:           string;
    entity_id?:            string;
    association_id?:       string;
    data:                  Record<string, unknown>;
    pipeline_stage_order?: number;
  }): Promise<FormSubmission> =>
    client.post<AR<FormSubmission>>(
      '/form-builder/submissions', data,
    ).then(r => r.data.data),

  getSubmissions: (params?: {
    schema_id?:   string;
    entity_type?: string;
    entity_id?:   string;
    status?:      string;
    page?:        number;
    limit?:       number;
  }): Promise<{ submissions: FormSubmission[]; total: number; page: number }> =>
    client.get('/form-builder/submissions', { params })
      .then(r => ({
        submissions: (r.data.data  ?? []) as FormSubmission[],
        total:       (r.data.total ?? 0)  as number,
        page:        (r.data.page  ?? 1)  as number,
      })),

  getSubmission: (id: string): Promise<FormSubmission> =>
    client.get<AR<FormSubmission>>(`/form-builder/submissions/${id}`)
      .then(r => r.data.data),

  approveSubmission: (id: string): Promise<FormSubmission> =>
    client.patch<AR<FormSubmission>>(`/form-builder/submissions/${id}/approve`)
      .then(r => r.data.data),

  rejectSubmission: (id: string, reason: string): Promise<FormSubmission> =>
    client.patch<AR<FormSubmission>>(
      `/form-builder/submissions/${id}/reject`, { reason },
    ).then(r => r.data.data),

  // Export returns a streaming download — open in tab via URL + auth header workaround
  getSubmissionExportUrl: (id: string): string =>
    `/api/v1/form-builder/submissions/${id}/export`,

  // ── Associations ───────────────────────────────────────────

  getAssociations: (params?: {
    schema_id?:    string;
    context_type?: string;
    page?:         number;
    limit?:        number;
  }): Promise<{ associations: FormAssociation[]; total: number; page: number }> =>
    client.get('/form-builder/associations', { params })
      .then(r => ({
        associations: (r.data.data  ?? []) as FormAssociation[],
        total:        (r.data.total ?? 0)  as number,
        page:         (r.data.page  ?? 1)  as number,
      })),

  createAssociation: (data: {
    schema_id:             string;
    context_type:          string;
    context_id?:           string;
    context_label:         string;
    is_mandatory?:         boolean;
    display_order?:        number;
    trigger_event?:        string | null;
    auto_populate_fields?: Record<string, unknown>;
  }): Promise<FormAssociation> =>
    client.post<AR<FormAssociation>>('/form-builder/associations', data)
      .then(r => r.data.data),

  updateAssociation: (
    id:   string,
    data: {
      context_label?:        string;
      is_mandatory?:         boolean;
      display_order?:        number;
      trigger_event?:        string | null;
      auto_populate_fields?: Record<string, unknown>;
    },
  ): Promise<FormAssociation> =>
    client.put<AR<FormAssociation>>(`/form-builder/associations/${id}`, data)
      .then(r => r.data.data),

  deleteAssociation: (id: string): Promise<void> =>
    client.delete(`/form-builder/associations/${id}`).then(() => undefined),

  // ── Context lookup ─────────────────────────────────────────

  getContextSchemas: (
    contextType: string,
    contextId:   string,
  ): Promise<ContextSchema[]> =>
    client.get<AR<ContextSchema[]>>(
      `/form-builder/context/${contextType}/${contextId}/schemas`,
    ).then(r => r.data.data),
};
