import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as UserRoleModel from '../models/auth/userRole.model';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        const userId = decoded?.user_id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: Invalid token payload" });
        }

        void (async () => {
            const roles = await UserRoleModel.getUserRoles(userId);
            (req as any).user = { id: userId, roles };
            next();
        })().catch(() => res.status(401).json({ message: "Unauthorized: Invalid or expired token" }));
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return next();
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        const userId = decoded?.user_id;
        if (!userId) return next();
        void (async () => {
            const roles = await UserRoleModel.getUserRoles(userId);
            (req as any).user = { id: userId, roles };
            next();
        })();
        return;
    } catch (err) {
        // Continue without user if token is invalid
    }
    next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.roles.includes('role_admin')) {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
};

export const isStaff = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || (!user.roles.includes('role_admin') && !user.roles.includes('role_teacher'))) {
        return res.status(403).json({ message: "Forbidden: Staff access required" });
    }
    next();
};

