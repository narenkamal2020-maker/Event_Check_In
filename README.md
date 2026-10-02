# Eventra

> **Event Operations, Reimagined.**

## 🚀 Overview

**Eventra** is a full-stack event operations platform designed to streamline event registration, attendee management, and high-throughput on-site check-in.

It combines secure QR-based entry, real-time attendance tracking, offline scanning, multi-gate operations, and AI-powered event insights into a single responsive application.

The system is designed for both attendees and event organizers, with role-based access control and a PostgreSQL-backed architecture that ensures data consistency even under high concurrent traffic.

✨ Features
🎟️ Event Management
Create and manage events
Configure event capacity
Publish and cancel events
Configure multiple gates/stations
View event registrations
👥 Registration & Waitlist
Attendee registration
Registration cancellation
Capacity management
Automatic waitlist handling
Registration status tracking
Concurrency-safe registration
🔐 Secure QR Check-In
Unique QR code for every registration
Cryptographically secure tokens
QR token expiration and rotation
Token revocation
Server-side QR validation
Duplicate check-in prevention
Multi-gate check-in
📱 Offline-First Scanning
Continue scanning during network failures
IndexedDB-based local queue
Automatic synchronization
Retry handling
Idempotent synchronization
Conflict detection
Server-authoritative conflict resolution
📊 Real-Time Organizer Dashboard
Live registration statistics
Check-in count
Attendance percentage
Remaining capacity
Gate-wise statistics
Recent activity
Suspicious activity
Real-time updates through Socket.IO
🚨 Suspicious Activity Detection

Detects events such as:

Duplicate scans
Invalid QR attempts
Expired QR attempts
Revoked QR attempts
Rapid multi-gate scans
Offline synchronization conflicts
🤖 Gemini AI Insights

Organizers can ask questions such as:

How many attendees have checked in?
What is the attendance percentage?
When did check-ins peak?
Which gate is busiest?
How many people are waitlisted?
How many suspicious activities occurred?

Gemini receives verified statistics from the backend and does not directly access the database.

📄 CSV Export

Export attendance information with filters such as:

All attendees
Checked in
Not checked in
Cancelled
Waitlisted
Suspicious
🏗️ Architecture

                    ┌─────────────────────┐
                    │      Users          │
                    │ Attendee / Staff    │
                    │ Organizer / Admin   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   React Frontend    │
                    │ TypeScript + Vite   │
                    │     Tailwind CSS    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Express Backend   │
                    │ Auth / RBAC / API   │
                    │ Validation/Services │
                    └──────┬───────┬──────┘
                           │       │
                ┌──────────┘       └───────────┐
                ▼                              ▼
       ┌─────────────────┐             ┌───────────────┐
       │   PostgreSQL    │             │   Socket.IO   │
       │  Source of Truth│             │ Real-time Data│
       └─────────────────┘             └───────────────┘
                ▲
                │
       ┌────────┴────────┐
       │ Offline Sync    │
       │    IndexedDB    │
       └─────────────────┘

                     Backend
                        │
                        ▼
                 ┌────────────┐
                 │   Gemini   │
                 │ AI Insights│
                 └────────────┘
🛠️ Tech Stack
Category	Technology
Frontend	React + TypeScript
Build Tool	Vite
Styling	Tailwind CSS
UI	Bklit UI + Kokonut UI
Backend	Node.js + Express
Database	PostgreSQL
Real-Time	Socket.IO
QR Scanning	html5-qrcode
Offline Storage	IndexedDB
Validation	Zod
AI	Google Gemini
Animation	Motion.dev + GSAP + Anime.js
👤 User Roles
Attendee
Browse events
Register
Join waitlists
View registration
Access digital event pass
Display QR code
View check-in status
Staff
Access assigned events
Operate assigned scanning stations
Scan attendee QR codes
View check-in results
Organizer
Create and manage events
Manage registrations
Configure gates
Operate scanners
Monitor live attendance
View analytics
Manage suspicious activity
Export data
Use Gemini insights
Admin
Manage users
Manage roles
Manage platform-level configuration

All permissions are enforced server-side.

🔒 Security

The system is designed with security at both the application and database layers.

Key protections include:

Secure password hashing
Server-side role-based access control
Input validation
Parameterized database queries
PostgreSQL constraints
Transaction-based operations
Rate limiting
Restricted CORS
Security headers
CSP
Secure cookies
Environment-based secrets
Backend-only Gemini API access
Audit logging
Secure QR tokens
QR expiration and revocation

Sensitive information is never embedded directly inside QR codes.

⚡ Concurrency Safety

A major design goal is preventing race conditions during high-traffic events.

For example:

100 simultaneous scans
        │
        ▼
 PostgreSQL Transaction
        │
        ▼
 Unique Constraint
        │
        ├──────► SUCCESS
        │
        └──────► REJECTED

For the same registration:

100 concurrent check-in requests
        ↓
1 successful check-in
99 rejected
1 database record

Capacity management follows the same database-authoritative approach.

If an event has a capacity of 50, concurrent registration requests cannot cause the database to contain more than 50 confirmed registrations.

📡 Offline Architecture

When the scanner loses connectivity:

QR Scan
   ↓
IndexedDB
   ↓
Offline Queue
   ↓
Network Restored
   ↓
Sync API
   ↓
Backend
   ↓
PostgreSQL

Each offline scan receives a unique client_scan_id.

This provides idempotency and prevents the same offline scan from being processed multiple times.

The server remains authoritative when conflicts occur.

🚪 Multi-Gate Check-In

The system supports multiple event gates:

Event
 ├── Gate A
 ├── Gate B
 ├── Gate C
 └── ...

Every check-in can record:

Event
Gate/station
Device
Timestamp
Synchronization source

This enables organizers to compare attendance across different entry points.

🤖 Gemini Architecture

Gemini is deliberately separated from the database.

Organizer
    ↓
Question
    ↓
Backend Authentication
    ↓
Event Authorization
    ↓
PostgreSQL
    ↓
Verified Statistics
    ↓
Gemini
    ↓
AI Response

Gemini does not directly query PostgreSQL.

It also does not make security or check-in decisions.

🎨 Design System
Colors

The application uses a custom visual identity based on:

Exotic Orange
Midnight Blue
Authentic Teal
Sidecar Yellow
Olive Green
Royal Yellow
Masterpiece Red — #5A2132
Dirty White
Lavender Tonic

The palette is applied semantically rather than using every color equally.

Typography

Inter
Primary font for UI, body text, dashboards, forms, navigation and tables.

Tempting
Display/accent font for major headings, event titles and branding.

UI & Motion
Bklit UI
Kokonut UI
Motion.dev
GSAP
Anime.js

The interface is designed to be responsive across:

📱 Mobile
📲 Tablet
💻 Laptop
🖥️ Desktop
📁 Project Structure
event-checkin-system/
│
├── client/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── layouts/
│       ├── hooks/
│       ├── services/
│       ├── animations/
│       ├── store/
│       └── utils/
│
├── server/
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── routes/
│       ├── middleware/
│       ├── validators/
│       ├── db/
│       ├── realtime/
│       ├── ai/
│       └── security/
│
├── database/
│   ├── migrations/
│   └── seed/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── concurrency/
│   └── security/
│
├── docs/
│
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md

Adjust this structure if the actual repository uses different folder names.

⚙️ Environment Variables

Create a .env file based on .env.example.

Example:

DATABASE_URL=
SESSION_SECRET=
JWT_SECRET=
GEMINI_API_KEY=
CLIENT_URL=
SERVER_URL=
NODE_ENV=development

Never commit .env or real credentials to GitHub.

🚀 Getting Started
1. Clone the repository
git clone <repository-url>
cd event-checkin-system
2. Install dependencies
npm install

If frontend and backend use separate packages:

cd client
npm install


cd ../server
npm install
3. Configure environment variables
cp .env.example .env

Add the required PostgreSQL and Gemini configuration.

4. Start PostgreSQL

If the project uses Docker:

docker compose up -d
5. Run migrations
npm run db:migrate
6. Seed development data
npm run db:seed
7. Start the application
npm run dev
🧪 Testing

Run the project's test suite:

npm test

Concurrency tests:

npm run test:concurrency

Capacity tests:

npm run test:capacity

The concurrency tests should verify that database-level constraints remain correct even when many requests arrive simultaneously.

📊 Core Flow
Attendee
Browse Event
     ↓
Register
     ↓
Receive Digital Pass
     ↓
QR Generated
     ↓
Arrive at Event
     ↓
Scan QR
     ↓
Backend Validation
     ↓
Check-In
Organizer
Create Event
     ↓
Set Capacity
     ↓
Configure Gates
     ↓
Monitor Registrations
     ↓
Scan Attendees
     ↓
Monitor Live Dashboard
     ↓
Analyze Attendance
     ↓
Export Reports
🗺️ Future Improvements

Potential extensions include:

Advanced event analytics
Automated notification systems
Dedicated scanner device mode
Advanced fraud/risk scoring
Event recommendation system
Attendance forecasting
Larger-scale distributed deployment
Advanced organizer collaboration
🎯 Project Goals

The system focuses on four core principles:

Secure — QR validation and authorization are handled server-side.

Reliable — PostgreSQL remains the source of truth for critical operations.

Resilient — Check-in continues during temporary network failures.

Intelligent — Gemini provides useful insights from verified event data.
