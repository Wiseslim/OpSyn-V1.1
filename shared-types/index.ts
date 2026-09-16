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
  | 'new'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'blocked'
  | 'done'
  | 'archived';

export type TaskTriggerType = 'manual' | 'automation' | 'comment' | 'system' | 'dependency';

export type DeadlineBucket =
  | 'overdue' | 'today' | 'this_week' | 'next_week' | 'no_deadline' | 'backlog';

// ── Pipelines & Stages ─────────────────────────────────────────
export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  stages: Stage[];
  department_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  pipeline_id: string;
  name: string;
  order: number;
  allowed_statuses: TaskStatus[];
  is_terminal: boolean;
  is_entry: boolean;
  created_at: string;
}

// ── Task Dependency & Summary ──────────────────────────────────
export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  assignee?: StaffProfileSummary;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_task?: TaskSummary;
  created_at: string;
}

// ── Task ──────────────────────────────────────────────────────
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
  deadline_bucket: DeadlineBucket;
  pipeline_id?: string;
  stage_id?: string;
  department?: Department;
  project_id?: string;
  assignee?: StaffProfileSummary;
  responsible_user?: StaffProfileSummary;
  created_by: string;
  tags: string[];
  comment_count: number;
  dependencies?: TaskDependency[];
  created_at: string;
  updated_at: string;
}

// ── Comment System ────────────────────────────────────────────
export type CommentType = 'NORMAL' | 'SYSTEM' | 'ACTION' | 'APPROVAL' | 'BLOCKER';
export type ApprovalAction = 'approved' | 'rejected' | 'pending';

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

// ── Automation ────────────────────────────────────────────────
export type AutomationTrigger =
  | 'status_changed'
  | 'deadline_passed'
  | 'dependency_completed'
  | 'comment_added'
  | 'sla_breached';

export type AutomationAction =
  | 'move_to_status'
  | 'move_to_pipeline'
  | 'move_to_stage'
  | 'assign_user'
  | 'notify_user'
  | 'add_system_comment';

export interface AutomationCondition {
  field: string;
  operator: 'eq' | 'neq' | 'lt' | 'gt' | 'contains' | 'is_empty';
  value: unknown;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  pipeline_id?: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  action: AutomationAction;
  action_params: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

// ── Task Audit ────────────────────────────────────────────────
export interface TaskAuditEntry {
  id: string;
  task_id: string;
  actor?: StaffProfileSummary;
  from_status?: TaskStatus;
  to_status?: TaskStatus;
  from_pipeline_id?: string;
  to_pipeline_id?: string;
  from_stage_id?: string;
  to_stage_id?: string;
  trigger_type: TaskTriggerType;
  comment_id?: string;
  note?: string;
  created_at: string;
}

// ── Task Transition ───────────────────────────────────────────
export interface TransitionRequest {
  to_status: TaskStatus;
  to_stage_id?: string;
  to_pipeline_id?: string;
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

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority: TaskPriority;
  status?: TaskStatus;
  deadline?: string;
  pipeline_id?: string;
  stage_id?: string;
  department_id?: string;
  project_id?: string;
  assignee_user_id?: string;
  responsible_user_id?: string;
  dependent_task_ids?: string[];
  tags?: string[];
}

// ── Projects ─────────────────────────────────────────────────
export type ProjectStatus = 'active' | 'completed' | 'paused';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  department?: Department;
  completion_pct: number;
  due_date?: string;
  members: StaffProfileSummary[];
  task_count: number;
  completed_task_count: number;
  created_at: string;
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
  region_id?: string;
  olt_reference?: string;
  reported_by?: StaffProfileSummary;
  assigned_team?: Team;
  assigned_engineers?: StaffProfileSummary[];
  duration_minutes?: number;
  resolved_at?: string;
  created_at: string;
  updated_at?: string;
  // S3.4 SmartOLT fields
  source?: 'manual' | 'smartolt' | 'webhook';
  affected_subscribers?: number;
  sla_deadline?: string;
  breached_sla?: boolean;
  linked_task_id?: string;
  affected_customer_ids?: string[];
  timeline?: OutageTimelineEntry[];
}

export interface OutageTimelineEntry {
  id: string;
  event_type: string;
  actor_id?: string;
  body: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface SmartOLTConfig {
  id: string;
  api_url: string;
  polling_enabled: boolean;
  polling_interval_secs: number;
  severity_thresholds?: { warning: number; high: number; critical: number };
  has_api_key: boolean;
  has_webhook_secret: boolean;
  updated_at?: string;
}

export interface SmartOLTOltMap {
  id: string;
  smartolt_olt_id: string;
  olt_name?: string;
  region_id?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  last_synced_at?: string;
}

// ── Infrastructure (S4.1) ──────────────────────────────────────
export interface InfraPort {
  id: string;
  node_id: string;
  port_number: string;
  port_type: string;
  total_capacity: number;
  used_capacity: number;
  utilisation_pct: number;
  status: 'active' | 'down' | string;
  last_synced_at?: string;
  created_at: string;
}

export interface InfraSubscriber {
  id: string;
  customer_id: string;
  site_id?: string;
  node_id?: string;
  port_id?: string;
  service_type: string;
  status: 'active' | 'suspended' | 'churned' | string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export interface InfraCapacityAlert {
  id: string;
  site_id?: string;
  node_id?: string;
  alert_type: string;
  severity: 'critical' | 'high' | 'warning' | 'low';
  threshold_pct: number;
  current_pct: number;
  message?: string;
  is_resolved: boolean;
  resolved_at?: string;
  linked_task_id?: string;
  created_at: string;
}

export interface InfraMonitoringConfig {
  id: string;
  entity_type: string;
  entity_id: string;
  warn_threshold_pct: number;
  critical_threshold_pct: number;
  check_interval_minutes: number;
  alert_channels: string[];
  assigned_role_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InfraAlertRule {
  id: string;
  name: string;
  condition_field: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold_value: number;
  severity: 'critical' | 'high' | 'warning' | 'low';
  action_type: 'notify' | 'create_task' | 'email' | string;
  action_params: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface InfraMapSite {
  id: string;
  name: string;
  site_type: string;
  latitude?: number;
  longitude?: number;
  status: string;
  region_id?: string;
  is_monitored: boolean;
  has_alert: boolean;
}

export interface InfraMapNode {
  id: string;
  name: string;
  node_type: string;
  site_id?: string;
  ip_address?: string;
  status: string;
  utilisation: { used: number; total: number; pct: number };
  has_alert: boolean;
}

export interface InfraMapRoute {
  id: string;
  from_node_id: string;
  to_node_id: string;
  cable_type?: string;
  status: string;
  length_km?: number;
  capacity_gbps?: number;
}

export interface InfraMapCabinet {
  id: string;
  cabinet_id: string;
  latitude: number;
  longitude: number;
  capacity: number;
  number_tray?: number;
}

export interface InfraMapOLT {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  location_description?: string;
  number_of_odf?: number;
}

export interface InfraMapSplitter {
  id: string;
  box_id: string;
  latitude: number;
  longitude: number;
  splitter_level: string;
  splitter_type: string;
  input_ports: number;
  output_ports: number;
  number_customer?: number;
}

export interface InfraMapData {
  sites: InfraMapSite[];
  nodes: InfraMapNode[];
  routes: InfraMapRoute[];
  cabinets: InfraMapCabinet[];
  olts: InfraMapOLT[];
  splitters: InfraMapSplitter[];
}

export interface InfraUtilisationPoint {
  site_id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  used: number;
  total: number;
  utilisation_pct: number;
}

// ── Shifts ─────────────────────────────────────────────────────
export interface Shift {
  id: string;
  name: string;
  shift_type: 'day' | 'night' | 'oncall' | string;
  start_time: string;
  end_time: string;
  color: string;
  created_at?: string;
}

export interface ShiftAssignment {
  id: string;
  shift_id: string;
  user_id: string;
  date: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'swapped';
  notes?: string;
  shift?: Shift;
  user?: { id: string; name: string; email: string };
  created_at?: string;
}

export interface ShiftSwapRequest {
  id: string;
  from_assignment_id: string;
  to_user_id: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  responded_by?: string;
  responded_at?: string;
  created_at?: string;
}

// ── Outage Notification Rules ──────────────────────────────────
export interface OutageNotificationRule {
  id: string;
  name: string;
  min_severity: 'critical' | 'high' | 'warning' | 'low';
  min_subscribers: number;
  channels: ('sms' | 'email' | 'whatsapp')[];
  message_template?: string;
  is_auto: boolean;
  is_active: boolean;
  created_at?: string;
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
  | 'task_overdue'
  | 'task_blocked'
  | 'task_approval_needed'
  | 'task_approved'
  | 'task_rejected'
  | 'task_dependency_ready'
  | 'task_commented'
  | 'task_mentioned'
  | 'task_moved';

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
