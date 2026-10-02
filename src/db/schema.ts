import { pgTable, serial, text, timestamp, integer, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['ADMIN', 'ORGANIZER', 'STAFF', 'ATTENDEE']);
export const eventStatusEnum = pgEnum('event_status', ['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED']);
export const registrationStatusEnum = pgEnum('registration_status', ['REGISTERED', 'WAITLISTED', 'CANCELLED', 'CHECKED_IN']);
export const suspiciousTypeEnum = pgEnum('suspicious_type', [
  'DUPLICATE_SCAN',
  'RAPID_MULTI_STATION_SCAN',
  'INVALID_TOKEN',
  'EXPIRED_TOKEN',
  'REVOKED_TOKEN',
  'OFFLINE_SYNC_CONFLICT',
  'OTHER'
]);
export const suspiciousSeverityEnum = pgEnum('suspicious_severity', ['LOW', 'MEDIUM', 'HIGH']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').default('ATTENDEE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  organizerId: integer('organizer_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  location: text('location').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  capacity: integer('capacity').notNull(),
  status: eventStatusEnum('status').default('DRAFT').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stations = pgTable('stations', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  gateName: text('gate_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const registrations = pgTable('registrations', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  attendeeId: integer('attendee_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  registrationNumber: text('registration_number').notNull(),
  status: registrationStatusEnum('status').default('REGISTERED').notNull(),
  registeredAt: timestamp('registered_at').defaultNow(),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  eventAttendeeIdx: uniqueIndex('event_attendee_idx').on(table.eventId, table.attendeeId),
}));

export const qrTokens = pgTable('qr_tokens', {
  id: serial('id').primaryKey(),
  registrationId: integer('registration_id').references(() => registrations.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const checkIns = pgTable('check_ins', {
  id: serial('id').primaryKey(),
  registrationId: integer('registration_id').references(() => registrations.id, { onDelete: 'cascade' }).unique().notNull(),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  stationId: integer('station_id').references(() => stations.id).notNull(),
  tokenId: integer('token_id').references(() => qrTokens.id).notNull(),
  deviceId: text('device_id'),
  checkedInAt: timestamp('checked_in_at').defaultNow().notNull(),
  syncSource: text('sync_source').default('ONLINE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const offlineScans = pgTable('offline_scans', {
  id: serial('id').primaryKey(),
  clientScanId: text('client_scan_id').unique().notNull(),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  registrationToken: text('registration_token').notNull(),
  stationId: integer('station_id').references(() => stations.id).notNull(),
  deviceId: text('device_id'),
  scannedAtClient: timestamp('scanned_at_client').notNull(),
  syncStatus: text('sync_status').default('PENDING').notNull(),
  syncedAt: timestamp('synced_at'),
  conflictReason: text('conflict_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const suspiciousActivity = pgTable('suspicious_activity', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  registrationId: integer('registration_id').references(() => registrations.id, { onDelete: 'set null' }),
  stationId: integer('station_id').references(() => stations.id, { onDelete: 'set null' }),
  type: suspiciousTypeEnum('type').notNull(),
  severity: suspiciousSeverityEnum('severity').default('MEDIUM').notNull(),
  description: text('description').notNull(),
  metadata: text('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  metadata: text('metadata'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations for convenience
export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  registrations: many(registrations),
  auditLogs: many(auditLogs),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  stations: many(stations),
  registrations: many(registrations),
  checkIns: many(checkIns),
  suspiciousActivity: many(suspiciousActivity),
}));

export const registrationsRelations = relations(registrations, ({ one, many }) => ({
  event: one(events, { fields: [registrations.eventId], references: [events.id] }),
  attendee: one(users, { fields: [registrations.attendeeId], references: [users.id] }),
  qrTokens: many(qrTokens),
  checkIn: one(checkIns, { fields: [registrations.id], references: [checkIns.registrationId] }),
}));
