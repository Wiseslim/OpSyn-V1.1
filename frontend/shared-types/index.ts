// ============================================================
// OPSYN SHARED TYPES — Frontend ↔ Backend Contract
// All API responses conform to these types
// ============================================================

// ── API Wrappers ────────────────────────────────────────────
export interface APIResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface ErrorDetail {
  field?: string;
  message: string;
  code: string;
}

export interface APIError {
  detail: ErrorDetail[] | string;
  status_code: number;
}

// ── Auth ────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  role_level: number;
  is_active: boolean;
  staff_profile?: StaffProfileSummary;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ── Roles & Permissions ─────────────────────────────────────
export interface Role {
  id: string;
  name: string;
  level: number;
  is_system_role: boolean;
  description?: string;
}

export type RoleName =
  | 'Admin'
  | 'Manager'
  | 'Team Lead'
  | 'NOC Operator'
  | 'MEC Reviewer'
  | 'Executive Viewer'
  | 'Staff';

export interface Permission {
  id: string;
  key: string;
  description?: string;
}

export interface UserScope {
  id: string;
  user_id: string;
  scope_type: 'department' | 'team' | 'region' | 'system';
  scope_reference_id: string;
  granted_by: string;
  created_at: string;
}

export interface UserRoleHistory {
  id: string;
  old_role?: Role;
  new_role: Role;
  changed_by: string;
  changed_at: string;
}

// ── Organisation ────────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  head_user_id?: string;
  parent_id?: string;
  staff_count?: number;
  team_count?: number;
}

export interface Team {
  id: string;
  name: string;
  department_id: string;
  department?: Department;
  lead_user_id?: string;
  member_count?: number;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  parent_id?: string;
}

// ── Staff ────────────────────────────────────────────────────
export type StaffStatus = 'active' | 'inactive' | 'suspended';
export type EmploymentType = 'permanent' | 'contract' | 'intern';

export interface StaffProfileSummary {
  id: string;
  staff_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title?: string;
}

export interface StaffProfile {
  id: string;
  user_id: string;
  staff_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  job_title?: string;
  skill_category?: string;
  specialization?: string;
  employment_type: EmploymentType;
  region?: Region;
  department: Department;
  team?: Team;
  manager?: StaffProfileSummary;
  approval_authority_level: number;
  olt_domain?: string;
  work_location?: string;
  outage_responsibility?: string;
  mec_responsibility?: string;
  status: StaffStatus;
  notes?: string;
  joined_at?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  // Joined from users
  username: string;
  email: string;
  role: Role;
  last_login_at?: string;
  scopes?: UserScope[];
  role_history?: UserRoleHistory[];
}

export interface CreateStaffRequest {
  // Tab 1: Basic Info
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  username: string;
  staff_code?: string;
  invite_method: 'email' | 'password';
  temporary_password?: string;
  // Tab 2: Organisation
  department_id: string;
  team_id?: string;
  manager_user_id?: string;
  role_id: string;
  job_title: string;
  employment_type: EmploymentType;
  // Tab 3: Access
  permission_profile?: string;
  scope_level: 'department' | 'team' | 'region' | 'system';
  allowed_dashboards: string[];
  // Tab 4: Operational
  region_id?: string;
  olt_domain?: string;
  project_unit?: string;
  outage_responsibility?: string;
  mec_responsibility?: string;
  approval_authority_level: number;
  work_location?: string;
  specialization?: string;
  notes?: string;
  // Tab 5: Status
  status: StaffStatus;
  joined_at?: string;
  end_date?: string;
}

// ── Tasks ────────────────────────────────────────────────────
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskStatus =
  | 'new' | 'assigned' | 'in_progress' | 'review' | 'blocked' | 'done' | 'archived';
export type DeadlineBucket =
  | 'overdue' | 'today' | 'this_week' | 'next_week' | 'no_deadline' | 'backlog';
export type CommentType = 'NORMAL' | 'SYSTEM' | 'ACTION' | 'APPROVAL' | 'BLOCKER';
export type ApprovalAction = 'approved' | 'rejected' | 'pending';

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_task?: { id: string; title: string; status: TaskStatus; assignee?: StaffProfileSummary };
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  previous_state?: string;
  state_changed_at?: string;
  deadline?: string;
  deadline_bucket: DeadlineBucket;
  pipeline_id?: string;
  stage_id?: string;
  department?: Department;
  department_id?: string;
  project_id?: string;
  assignee?: StaffProfileSummary;
  responsible_user?: StaffProfileSummary;
  created_by: string;
  tags: string[];
  comment_count: number;
  dependencies?: TaskDependency[];
  ticket_number?: string;
  block_reason?: string;
  estimated_hours?: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author: StaffProfileSummary;
  body: string;
  type: CommentType;
  mentions: string[];
  parent_id?: string;
  replies?: TaskComment[];
  approval_action?: ApprovalAction;
  is_resolved?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AddCommentRequest {
  body: string;
  type?: CommentType;
  mentions?: string[];
  parent_id?: string;
}

export interface TransitionRequest {
  to_status: TaskStatus;
  to_stage_id?: string;
  comment?: AddCommentRequest;
}

export interface TaskBoard {
  overdue: Task[];
  today: Task[];
  this_week: Task[];
  next_week: Task[];
  no_deadline: Task[];
  backlog: Task[];
  total: number;
}

export interface TaskStatusBoard {
  new: Task[];
  assigned: Task[];
  in_progress: Task[];
  review: Task[];
  blocked: Task[];
  done: Task[];
  archived: Task[];
  total: number;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority: TaskPriority;
  status?: TaskStatus;
  deadline?: string;
  department_id?: string;
  project_id?: string;
  assignee_user_id?: string;
  responsible_user_id?: string;
  pipeline_id?: string;
  stage_id?: string;
  dependent_task_ids?: string[];
  tags?: string[];
  estimated_hours?: number;
}

// ── Projects ─────────────────────────────────────────────────
export type ProjectStatus = 'active' | 'completed' | 'paused';
export type ProjectType =
  | 'internal' | 'external' | 'cable_upgrade' | 'olt_installation' | 'procurement';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  project_type: ProjectType;
  ticket_number?: string;
  owner_id?: string;
  department_id?: string;
  department?: Department;
  completion_pct: number;
  due_date?: string;
  pipeline_status?: string;
  current_stage_id?: string;
  members?: StaffProfileSummary[];
  task_count?: number;
  completed_task_count?: number;
  created_at: string;
}

// Pipeline types
export interface PipelineTemplateStage {
  id: string;
  templateId: string;
  stageOrder: number;
  stageName: string;
  departmentId: string;
  departmentName: string;
  isRequired: boolean;
  isParallel: boolean;
  parallelGateStageOrder: number | null;
  expectedDurationDays: number | null;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  stages: PipelineTemplateStage[];
  createdAt: string;
}

export type PipelineStageStatus =
  | 'pending'
  | 'active'
  | 'approved'
  | 'pushed_back'
  | 'skipped'
  | 'gate_waiting';

export type PipelineStatus =
  | 'not_started'
  | 'active'
  | 'stalled'
  | 'completed'
  | 'cancelled';

export interface StageComment {
  id: string;
  stageId: string;
  authorUserId: string;
  authorName: string;
  body: string;
  commentType: 'progress' | 'issue' | 'note' | 'approval_note' | 'pushback_reason' | 'gate_confirmation';
  createdAt: string;
  attachments?: Array<{ filename: string; url?: string }>;
}

export interface ProjectPipelineStage {
  id: string;
  projectId: string;
  stageOrder: number;
  stageName: string;
  departmentId: string;
  departmentName: string;
  status: PipelineStageStatus;
  assignedToUserId: string | null;
  enteredAt: string | null;
  exitedAt: string | null;
  pushedBackReason: string | null;
  durationDays: number | null;
  comments: StageComment[];
}

export interface ProjectPipelineResponse {
  projectId: string;
  projectName: string;
  pipelineTemplateId: string;
  pipelineTemplateName: string;
  pipelineStatus: PipelineStatus;
  currentStage: ProjectPipelineStage | null;
  allStages: ProjectPipelineStage[];
  canAdvance: boolean;
  canPushBack: boolean;
}

// ── Outage ────────────────────────────────────────────────────
export type OutageSeverity = 'critical' | 'high' | 'warning' | 'low';
export type OutageStatus = 'active' | 'monitoring' | 'in_resolution' | 'resolved';

export interface OutageIncident {
  id: string;
  reference: string;
  title: string;
  description?: string;
  severity: OutageSeverity;
  status: OutageStatus;
  region?: Region;
  olt_reference?: string;
  reported_by: StaffProfileSummary;
  assigned_team?: Team;
  assigned_engineers: StaffProfileSummary[];
  duration_minutes?: number;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ── Onboarding ────────────────────────────────────────────────
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface OnboardingRequest {
  id: string;
  requested_by: StaffProfileSummary;
  proposed_first_name: string;
  proposed_last_name: string;
  proposed_email: string;
  proposed_role: Role;
  department: Department;
  team?: Team;
  justification?: string;
  approval_status: ApprovalStatus;
  approved_by?: StaffProfileSummary;
  approved_at?: string;
  provisioned_user_id?: string;
  created_at: string;
}

// ── Notifications ─────────────────────────────────────────────
export type NotificationType =
  | 'onboarding_pending'
  | 'onboarding_approved'
  | 'onboarding_rejected'
  | 'outage_critical'
  | 'outage_warning'
  | 'outage_resolved'
  | 'role_changed'
  | 'staff_created'
  | 'staff_deactivated'
  | 'task_assigned'
  | 'task_overdue';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string;
  is_read: boolean;
  action_url?: string;
  created_at: string;
}

// ── Audit ─────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  actor: StaffProfileSummary;
  action: string;
  target_type: string;
  target_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

// ── Forms ─────────────────────────────────────────────────────
export type FormFieldType =
  | 'text' | 'textarea' | 'number' | 'dropdown'
  | 'date' | 'phone' | 'email' | 'boolean' | 'file' | 'coordinates';

export type FormContext = 'lead' | 'task' | 'project' | 'onboarding';

export type DependencyOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'is_empty' | 'is_not_empty';
export type DependencyAction  = 'show' | 'hide' | 'require';

export interface FormFieldDependency {
  id:                 string;
  source_field_key:   string;
  target_field_key:   string;
  condition_operator: DependencyOperator;
  condition_value:    string | null;
  action:             DependencyAction;
}

export interface FormField {
  id:               string;
  field_key:        string;
  field_type:       FormFieldType;
  label:            string;
  placeholder?:     string;
  help_text?:       string;
  required:         boolean;
  field_order:      number;
  options?:         Array<{ label: string; value: string }> | null;
  validation_rules?: Record<string, unknown> | null;
  created_at:       string;
}

export interface FormSchema {
  id:           string;
  context:      FormContext;
  version:      number;
  is_published: boolean;
  title:        string;
  description?: string;
  created_by?:  string;
  created_at:   string;
  updated_at:   string;
  fields:       FormField[];
  dependencies: FormFieldDependency[];
}

export interface FormSubmission {
  id:             string;
  schema_id:      string;
  submitted_by?:  string;
  submitted_data: Record<string, unknown>;
  submitted_at:   string;
}

export type FormData = Record<string, unknown>;

// ── Reports ───────────────────────────────────────────────────
export interface ReportSummary {
  staff_added: number;
  staff_departed: number;
  staff_total: number;
  staff_active: number;
  outages_resolved: number;
  avg_mttr_hours: number;
  tasks_completed: number;
  task_completion_rate: number;
  dept_breakdown: { department: string; count: number }[];
  monthly_staff_changes: { month: string; added: number; departed: number }[];
  monthly_mttr: { month: string; hours: number }[];
}
