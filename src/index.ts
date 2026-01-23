import express from 'express';
import cors from 'cors';
import { db } from './config/db';
import { initDB } from './models/init';
import authRoutes from './routes/auth.routes';
import classRoutes from './routes/classes.routes';
import puzzleRoutes from './routes/puzzles.routes';
import courseRoutes from './routes/courses.routes';
import adminRoutes from './routes/admins.routes';
import billingRoutes from './routes/billings.routes';
import studentGroupRoutes from './routes/studentGroups.routes';

import swaggerUi from 'swagger-ui-express';
import { specs } from './config/swagger';

import { createServer } from 'http';
import { Server } from 'socket.io';

import { setupSocketIO } from './sockets';
import { initScheduler } from './config/scheduler';

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

// Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

const startServer = async () => {
    try {
        // Initialize Database
        await initDB();

        // Initialize Scheduler
        initScheduler();
    } catch (e) {
        console.error("Failed to initialize database, but starting server anyway...", e);
    }

    app.use('/auth', authRoutes);
    app.use('/admin', adminRoutes);
    app.use('/admin/billing', billingRoutes);
    app.use('/classes', classRoutes);
    app.use('/puzzles', puzzleRoutes);
    app.use('/courses', courseRoutes);
    app.use('/student-groups', studentGroupRoutes);

    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();
