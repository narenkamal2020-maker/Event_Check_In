import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export function initSocketIO(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    // Join event-specific room
    socket.on('join:event', (eventId: number | string) => {
      const room = `event:${eventId}`;
      socket.join(room);
    });

    socket.on('leave:event', (eventId: number | string) => {
      const room = `event:${eventId}`;
      socket.leave(room);
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToEvent(eventId: number, eventName: string, data: any) {
  if (!io) return;
  io.to(`event:${eventId}`).emit(eventName, data);
}

export const realtime = {
  checkInSuccess: (eventId: number, data: any) => {
    emitToEvent(eventId, 'checkin:success', data);
  },
  checkInRejected: (eventId: number, data: any) => {
    emitToEvent(eventId, 'checkin:rejected', data);
  },
  attendanceUpdated: (eventId: number, stats: any) => {
    emitToEvent(eventId, 'attendance:updated', stats);
  },
  registrationCreated: (eventId: number, registration: any) => {
    emitToEvent(eventId, 'registration:created', registration);
  },
  registrationCancelled: (eventId: number, data: any) => {
    emitToEvent(eventId, 'registration:cancelled', data);
  },
  waitlistPromoted: (eventId: number, data: any) => {
    emitToEvent(eventId, 'waitlist:promoted', data);
  },
  suspiciousActivityNew: (eventId: number, incident: any) => {
    emitToEvent(eventId, 'suspicious_activity:new', incident);
  }
};
