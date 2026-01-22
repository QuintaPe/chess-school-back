import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/auth/userModel';
import * as UserRoleModel from '../models/auth/userRolesModel';
import { z } from 'zod';
import { logActivity } from '../models/audit/activityLogModel';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string(),
});

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = registerSchema.parse(req.body);

        const existingUser = await UserModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await UserModel.createUser({
            email,
            name,
            password_hash: hashedPassword,
            status: 'active'
        });

        await UserRoleModel.assignRoleToUser(user.lastInsertRowid as string, 'role_student');

        await logActivity('new_user', `Nuevo usuario: ${name} se ha unido al club`);

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

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        await UserModel.updateLastLogin(user.id);
        const roles = await UserRoleModel.getUserRoles(user.id);

        const token = jwt.sign({
            user_id: user.id
        }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                roles,
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

        const { password_hash, ...userWithoutPassword } = user as any;
        const roles = await UserRoleModel.getUserRoles(userId);
        return res.json({ ...userWithoutPassword, roles });
    } catch (error) {
        return res.status(500).json({ message: "Error fetching profile" });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const updates = req.body;
        delete (updates as any).role;
        delete (updates as any).roles;
        delete (updates as any).password_hash;
        delete (updates as any).password;

        await UserModel.updateUser(userId, updates);

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

        if (updates.roles && Array.isArray(updates.roles)) {
            const currentRoles = await UserRoleModel.listUserRoleIds(id);
            for (const role of currentRoles) {
                await UserRoleModel.removeRoleFromUser(id, role);
            }
            for (const role of updates.roles) {
                await UserRoleModel.assignRoleToUser(id, role);
            }
            delete updates.roles;
        }

        // Remove legacy role field if present to avoid SQL error
        if ('role' in updates) {
            delete (updates as any).role;
        }

        await UserModel.updateUser(id, updates);

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
