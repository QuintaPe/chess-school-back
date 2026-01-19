import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface Participant {
    socketId: string;
    userId: string;
    name: string;
    role: 'student' | 'teacher' | 'admin';
    hasControl: boolean;
    classId: string;
}

// In-memory storage for participants (In production, use Redis)
const participants: Map<string, Participant> = new Map();

interface ClassState {
    fen: string;
    turn: 'w' | 'b';
    lastMove?: any;
    history: string[]; // FEN history
    moves: Array<{ num: number; white: string; black?: string; }>; // Move notation
}

// Store basic state for each class so late joiners get current board
const classStates: Map<string, ClassState> = new Map();

export const setupSocketIO = (io: Server) => {
    io.on('connection', (socket: Socket) => {
        console.log('User connected to socket:', socket.id);

        socket.on('join-class', async (data: { classId: string | number, token: string }) => {
            const classId = String(data.classId);
            const token = data.token;

            try {
                // Verify Token
                if (!token) throw new Error("No token provided");
                const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'secret');

                // Register Participant
                const participant: Participant = {
                    socketId: socket.id,
                    userId: decoded.id,
                    name: decoded.name || 'Usuario', // Ideally fetch from DB if not in token
                    role: decoded.role,
                    hasControl: decoded.role === 'teacher' || decoded.role === 'admin', // Teachers have control by default
                    classId: classId
                };

                participants.set(socket.id, participant);
                socket.join(classId);
                console.log(`Socket ${socket.id} (${participant.name}) joined class ${classId}`);

                // Emit updated list to room
                const roomParticipants = Array.from(participants.values()).filter(p => p.classId === classId);
                io.to(classId).emit('participants-update', roomParticipants);

                // Send current board state to the new joiner
                const currentState = classStates.get(classId);
                if (currentState) {
                    socket.emit('initial-state', currentState);
                } else {
                    // Start position if no state exists
                    socket.emit('initial-state', {
                        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                        turn: 'w',
                        history: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
                        moves: []
                    });
                }

            } catch (error) {
                console.error("Socket Auth Error:", error);
                socket.emit('error', { message: 'Authentication failed' });
            }
        });

        socket.on('move', (data: {
            classId: string | number;
            move: any;
            fen: string;
            turn: string;
            fromIndex?: number;
            newMoves?: any[];
        }) => {
            const participant = participants.get(socket.id);
            if (!participant) return;

            // Permission Check
            if (participant.hasControl) {
                // Update state
                // Update state
                const currentState: ClassState = classStates.get(String(data.classId)) || {
                    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                    turn: 'w',
                    history: ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
                    moves: []
                };

                currentState.fen = data.fen;
                currentState.turn = data.turn as 'w' | 'b';
                currentState.lastMove = data.move;
                if (!currentState.history) currentState.history = [];
                // Store fen history for replay
                currentState.history.push(data.fen);

                if (data.newMoves) {
                    currentState.moves = data.newMoves;
                }

                classStates.set(String(data.classId), currentState);

                io.to(String(data.classId)).emit('move', data);
            } else {
                console.warn(`User ${participant.name} tried to move without control.`);
            }
        });

        socket.on('grant-control', (data: { classId: string, targetSocketId: string }) => {
            const requester = participants.get(socket.id);
            // Only teacher/admin can grant control
            if (requester && (requester.role === 'teacher' || requester.role === 'admin')) {
                const target = participants.get(data.targetSocketId);
                if (target && target.classId === String(data.classId)) {
                    target.hasControl = true;
                    participants.set(data.targetSocketId, target); // Update map

                    // Broadcast update
                    const roomParticipants = Array.from(participants.values()).filter(p => p.classId === String(data.classId));
                    io.to(String(data.classId)).emit('participants-update', roomParticipants);
                }
            }
        });

        socket.on('revoke-control', (data: { classId: string, targetSocketId: string }) => {
            const requester = participants.get(socket.id);
            if (requester && (requester.role === 'teacher' || requester.role === 'admin')) {
                const target = participants.get(data.targetSocketId);
                if (target && target.classId === String(data.classId)) {

                    // Don't revoke teacher's own control inadvertently unless intended? 
                    // Usually teachers keep control. Let's allow revoking student control.
                    if (target.role === 'student') {
                        target.hasControl = false;
                        participants.set(data.targetSocketId, target);

                        // Broadcast update
                        const roomParticipants = Array.from(participants.values()).filter(p => p.classId === String(data.classId));
                        io.to(String(data.classId)).emit('participants-update', roomParticipants);
                    }
                }
            }
        });

        socket.on('nav-change', (data: { classId: string | number; index: number }) => {
            const participant = participants.get(socket.id);
            // Allow nav change if has control (teacher or authorized student)
            if (participant && participant.hasControl) {
                io.to(String(data.classId)).emit('nav-change', data);
            }
        });

        socket.on('disconnect', () => {
            const p = participants.get(socket.id);
            if (p) {
                const classId = p.classId;
                participants.delete(socket.id);
                console.log('User disconnected:', socket.id);

                // Emit update
                const roomParticipants = Array.from(participants.values()).filter(p => p.classId === classId);
                io.to(classId).emit('participants-update', roomParticipants);
            }
        });
    });
};
