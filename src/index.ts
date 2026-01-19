import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './config/db';
import { initDB } from './models/init';
import authRoutes from './routes/authRoutes';
import classRoutes from './routes/classRoutes';
import puzzleRoutes from './routes/puzzleRoutes';
import courseRoutes from './routes/courseRoutes';
import discordRoutes from './routes/discordRoutes';

import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Socket.io Logic for Chessboard
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

io.on('connection', (socket) => {
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

const startServer = async () => {
    try {
        // Initialize Database
        await initDB();
    } catch (e) {
        console.error("Failed to initialize database, but starting server anyway...", e);
    }

    app.use('/auth', authRoutes);
    app.use('/auth/discord', discordRoutes); // /auth/discord/link, /auth/discord/callback, /auth/discord/unlink
    app.use('/admin/discord', discordRoutes); // /admin/discord/sync-roles
    app.use('/classes', classRoutes);
    app.use('/puzzles', puzzleRoutes);
    app.use('/courses', courseRoutes);

    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
