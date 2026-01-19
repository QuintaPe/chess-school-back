import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        (req as any).user = decoded;
        next();
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        (req as any).user = decoded;
    } catch (err) {
        // Continue without user if token is invalid
    }
    next();
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
};

export const isStaff = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
        return res.status(403).json({ message: "Forbidden: Staff access required" });
    }
    next();
};
