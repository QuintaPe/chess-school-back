import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/userModel';
import { z } from 'zod';
import { syncUserRole } from './discordController';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string(),
    role: z.enum(['student', 'teacher', 'admin']).optional(),
    subscription_plan: z.enum(['free', 'premium']).optional(),
});

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name, role, subscription_plan } = registerSchema.parse(req.body);

        const existingUser = await UserModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await UserModel.createUser({
            email,
            password: hashedPassword,
            name,
            role: role || 'student',
            subscription_plan: subscription_plan || 'free',
            status: 'active'
        });

        return res.status(201).json({ message: "User registered successfully", id: user.lastInsertRowid });
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: error.issues });
        }
        if (error.code && error.code.includes('SQLITE_CONSTRAINT')) {
            return res.status(400).json({ message: "User already exists (email taken)", error });
        }
        return res.status(500).json({ message: "Error registering user", error });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        const user: any = await UserModel.findUserByEmail(email);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({
            id: user.id,
            role: user.role,
            subscription_plan: user.subscription_plan
        }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                subscription_plan: user.subscription_plan,
                avatar_url: user.avatar_url
            }
        });
    } catch (error) {
        return res.status(500).json({ message: "Error logging in", error });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const user = await UserModel.findUserById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const { password, ...userWithoutPassword } = user as any;
        return res.json(userWithoutPassword);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching profile" });
    }
};

export const getStats = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const stats = await UserModel.getUserStats(userId);

        // Mocking some data for the charts as specified in requirements
        const response = {
            summary: {
                currentRating: stats?.rating || 1200,
                ratingChange: 0,
                puzzlesSolved: stats?.puzzles_solved || 0,
                winRate: stats?.win_rate || 0,
                streak: stats?.streak || 0,
                accuracy: stats?.accuracy || 0,
                studyHours: stats?.study_hours || 0,
                totalGames: stats?.total_games || 0
            },
            ratingHistory: [
                { "month": "Ene", "rating": 1200 }
            ],
            weeklyActivity: [],
            achievements: []
        };

        return res.json(response);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching stats" });
    }
};


export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const updates = req.body;
        // Restrict some fields if not admin?
        delete (updates as any).role;

        await UserModel.updateUser(userId, updates);

        // Sync Discord role if subscription plan changed
        if (updates.subscription_plan) {
            const user = await UserModel.findUserById(userId);
            if (user) {
                await syncUserRole(user);
            }
        }

        return res.json({ message: "Profile updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating profile" });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    try {
        const role = req.query.role as string;
        const search = req.query.search as string;
        const users = await UserModel.listUsers({
            role,
            search
        });
        return res.json(users);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching users" });
    }
};

export const adminUpdateUser = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const updates = req.body;

        await UserModel.updateUser(id, updates);

        // Sync Discord if needed
        if (updates.subscription_plan) {
            const user = await UserModel.findUserById(id);
            if (user) await syncUserRole(user);
        }

        return res.json({ message: "User updated by admin" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating user" });
    }
};

export const adminDeleteUser = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        await UserModel.deleteUser(id);
        return res.json({ message: "User deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting user" });
    }
};
