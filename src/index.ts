import express from 'express';
import cors from 'cors';
import { db } from './config/db';
import { initDB } from './models/init';
import authRoutes from './routes/authRoutes';
import classRoutes from './routes/classRoutes';
import puzzleRoutes from './routes/puzzleRoutes';
import courseRoutes from './routes/courseRoutes';
import discordRoutes from './routes/discordRoutes';

import { createServer } from 'http';
import { Server } from 'socket.io';


import { setupSocketIO } from './sockets';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Adjust for production
        methods: ["GET", "POST"]
    }
});

// Initialize Socket.IO
setupSocketIO(io);

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
