/**
 * API Client — centralized fetch wrapper with auto JWT cookie handling
 */

const API_BASE = '/api';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal,
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, options);
  } catch (networkErr: any) {
    if (networkErr?.name === 'AbortError') throw networkErr;
    throw new ApiError(0, 'Network error — please check your connection');
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    // json.error may be an object {code, message} or a plain string
    const errorMsg =
      typeof json.error === 'object' && json.error !== null
        ? json.error.message || JSON.stringify(json.error)
        : json.error || json.message || `Request failed (HTTP ${res.status})`;
    throw new ApiError(res.status, errorMsg);
  }

  return json as T;
}

const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
};

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/auth/login', { email, password }),

  register: (name: string, email: string, password: string) =>
    api.post<{ user: User }>('/auth/register', { name, email, password }),

  logout: () => api.post('/auth/logout'),

  me: (signal?: AbortSignal) => api.get<{ user: User }>('/auth/me', signal),
};

export const eventsApi = {
  list: (paramsOrSignal?: Record<string, string> | AbortSignal, maybeSignal?: AbortSignal) => {
    let params: Record<string, string> | undefined;
    let signal: AbortSignal | undefined;
    if (paramsOrSignal && 'aborted' in paramsOrSignal) {
      signal = paramsOrSignal as AbortSignal;
    } else {
      params = paramsOrSignal as Record<string, string> | undefined;
      signal = maybeSignal;
    }
    const searchParams = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get<{ events: Event[] }>(`/events${searchParams}`, signal);
  },

  get: (id: number, signal?: AbortSignal) =>
    api.get<{ event: EventDetail }>(`/events/${id}`, signal),

  create: (data: CreateEventPayload) =>
    api.post<{ event: EventDetail }>('/events', data),

  update: (id: number, data: Partial<CreateEventPayload>) =>
    api.patch<{ event: EventDetail }>(`/events/${id}`, data),
};

// ─── REGISTRATIONS ───────────────────────────────────────────────────────────
export const registrationsApi = {
  register: (eventId: number) =>
    api.post<{ registration: Registration }>(`/registrations/${eventId}/register`),

  cancel: (registrationId: number) =>
    api.post<{ cancelled: boolean }>(`/registrations/${registrationId}/cancel`),

  myRegistrations: (signal?: AbortSignal) =>
    api.get<{ registrations: Registration[] }>('/registrations/my', signal),

  eventRegistrations: (eventId: number, signal?: AbortSignal) =>
    api.get<{ registrations: Registration[] }>(`/registrations/event/${eventId}`, signal),

  getPass: (registrationId: number, signal?: AbortSignal) =>
    api.get<PassData>(`/registrations/${registrationId}/pass`, signal),
};

// ─── CHECK-IN ────────────────────────────────────────────────────────────────
export const checkInApi = {
  scanToken: (eventId: number, rawToken: string, stationId: number, deviceId?: string) =>
    api.post<CheckInResult>(`/checkin/${eventId}/scan`, { token: rawToken, stationId, deviceId }),

  syncOffline: (eventId: number, scans: OfflineScanItem[]) =>
    api.post<SyncResult>(`/checkin/${eventId}/sync`, { scans }),
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  getStats: (eventId: number, signal?: AbortSignal) =>
    api.get<AnalyticsData>(`/analytics/${eventId}`, signal),

  getAiInsight: (eventId: number, question: string) =>
    api.post<{ answer: string; verifiedStats: VerifiedStats }>(`/analytics/${eventId}/ai-insight`, { question }),
};

// ─── SUSPICIOUS ──────────────────────────────────────────────────────────────
export const suspiciousApi = {
  list: (eventId: number, signal?: AbortSignal) =>
    api.get<{ incidents: SuspiciousIncident[] }>(`/suspicious/${eventId}`, signal),

  resolve: (incidentId: number, resolution: string) =>
    api.post(`/suspicious/${incidentId}/resolve`, { resolution }),
};

// ─── EXPORT ──────────────────────────────────────────────────────────────────
export const exportApi = {
  downloadCsv: async (eventId: number, filter: ExportFilter = 'all') => {
    const res = await fetch(`${API_BASE}/analytics/${eventId}/export?filter=${filter}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new ApiError(res.status, 'Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-${eventId}-${filter}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── ADMIN ───────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: (signal?: AbortSignal) =>
    api.get<{ users: User[] }>('/admin/users', signal),

  updateRole: (userId: number, role: UserRole) =>
    api.patch(`/admin/users/${userId}/role`, { role }),

  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),
};

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'ORGANIZER' | 'STAFF' | 'ATTENDEE';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  registration_count?: number;
  organized_events_count?: number;
}

export interface Station {
  id: number;
  name: string;
  gate_name: string;
  event_id: number;
}

export interface Event {
  id: number;
  name: string;
  description?: string;
  location: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  capacity: number;
  start_time: string;
  end_time: string;
  organizer_id: number;
  registered_count: number;
  waitlisted_count: number;
  checked_in_count: number;
  total_registrations?: number;
  total_check_ins?: number;
  created_at: string;
}

export interface EventDetail extends Event {
  stations: Station[];
  organizer_name?: string;
}

export interface Registration {
  id: number;
  event_id: number;
  attendee_id: number;
  status: 'REGISTERED' | 'WAITLISTED' | 'CANCELLED' | 'CHECKED_IN';
  registration_number: string;
  waitlist_position?: number;
  event_name?: string;
  event_location?: string;
  event_start?: string;
  attendee_name?: string;
  attendee_email?: string;
  checked_in_at?: string;
  gate_name?: string;
  created_at: string;
}

export interface PassData {
  registration: Registration & { event_start_time: string; event_end_time: string };
  qrCodeDataUrl: string;
  expiresInSeconds: number;
  gateName?: string;
  organizerName?: string;
}

export interface CheckInResult {
  success: boolean;
  attendeeName: string;
  registrationNumber: string;
  gateName: string;
  checkedInAt: string;
}

export interface OfflineScanItem {
  clientScanId: string;
  registrationToken: string;
  stationId: number;
  deviceId?: string;
  scannedAtClient: string;
}

export interface SyncResult {
  synced: number;
  conflicts: number;
  alreadyProcessed: number;
  results: Array<{ clientScanId: string; status: string; attendeeName?: string }>;
}

export interface GateBreakdown {
  gateId: number;
  gateName: string;
  count: number;
  percentage: number;
}

export interface PeakWindow {
  hour: string;
  count: number;
}

export interface AnalyticsData {
  // Server-side canonical names
  totalRegistered: number;
  totalCheckedIn: number;
  totalWaitlisted: number;
  totalCancelled: number;
  capacity: number;
  remainingCapacity: number;
  // Aliased percentage fields
  attendancePercentage: number;
  attendanceRate: number;
  noShowPercentage: number;
  noShowRate: number;
  noShowCount: number;
  suspiciousCount: number;
  waitlistCount: number;
  cancelledCount: number;
  checkInVelocity: number;
  peakCheckInWindow: string;
  gateBreakdowns: GateBreakdown[];
  gateStats: Array<{ stationId: number; stationName: string; gateName: string; count: number; percentage: number }>;
  peakWindows: PeakWindow[];
  checkIns: Array<{ checked_in_at: string; gate_name: string; attendee_name: string }>;
  timeline: Array<{ timeWindow: string; checkInCount: number; registrationCount: number }>;
}

export interface VerifiedStats {
  eventId: number;
  eventName: string;
  totalRegistered: number;
  totalCheckedIn: number;
  totalWaitlisted: number;
  attendanceRate: number;
}

export interface SuspiciousIncident {
  id: number;
  event_id: number;
  registration_id?: number;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  is_resolved: boolean;
  resolution?: string;
  detected_at: string;
  registration_number?: string;
  attendee_name?: string;
}

export interface CreateEventPayload {
  name: string;
  description?: string;
  location: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status?: string;
  stations: Array<{ name: string; gateName: string }>;
}

export type ExportFilter = 'all' | 'checked_in' | 'not_checked_in' | 'waitlisted' | 'cancelled' | 'suspicious';

export { ApiError };
