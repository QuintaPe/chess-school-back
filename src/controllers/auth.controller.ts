import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/auth/user.model';
import * as UserRoleModel from '../models/auth/userRole.model';
import { z } from 'zod';
import { logActivity } from '../models/audit/activityLog.model';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string(),
});

// Role mapping helpers
export const mapDbRoleToClient = (dbRole: string): string => {
    if (dbRole === 'role_admin') return 'admin';
    if (dbRole === 'role_teacher' || dbRole === 'role_coach') return 'teacher';
    if (dbRole === 'role_student') return 'student';
    return dbRole;
};

export const mapClientRoleToDb = (clientRole: string): string => {
    const role = clientRole.toLowerCase();
    if (role === 'admin') return 'role_admin';
    if (role === 'teacher') return 'role_teacher';
    if (role === 'student') return 'role_student';
    return clientRole;
};

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

        const mappedRoles = roles.map(mapDbRoleToClient);

        return res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                roles: mappedRoles,
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
        const mappedRoles = roles.map(mapDbRoleToClient);
        return res.json({ ...userWithoutPassword, roles: mappedRoles });
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

        const dbRole = role ? mapClientRoleToDb(role) : undefined;

        const users = await UserModel.listUsers({
            role: dbRole,
            search
        });

        const formattedUsers = users.map((u: any) => ({
            ...u,
            roles: (u.roles || []).map(mapDbRoleToClient)
        }));

        return res.json(formattedUsers);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ message: "Error fetching users" });
    }
};

export const adminUpdateUser = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const updates = req.body;

        if (updates.roles && Array.isArray(updates.roles)) {
            const currentRoles = await UserRoleModel.listUserRoleIds(id);
            for (const roleId of currentRoles) {
                await UserRoleModel.removeRoleFromUser(id, roleId);
            }
            for (const clientRole of updates.roles) {
                const dbRole = mapClientRoleToDb(clientRole);
                await UserRoleModel.assignRoleToUser(id, dbRole);
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
        const id = String(req.params.id);
        await UserModel.deleteUser(id);
        return res.json({ message: "User deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting user" });
    }
};

