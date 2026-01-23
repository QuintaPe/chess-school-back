import { Request, Response } from 'express';
import * as RoleModel from '../models/auth/roleModel';
import * as PermissionModel from '../models/auth/permissionModel';
import * as RolePermissionModel from '../models/auth/rolePermissionModel';

export const getRoles = async (req: Request, res: Response) => {
    try {
        const roles = await RoleModel.listRoles();
        return res.json(roles);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching roles", error });
    }
};

export const createRole = async (req: Request, res: Response) => {
    try {
        const { name, role_type } = req.body;
        if (!name || !role_type) {
            return res.status(400).json({ message: "Name and role_type are required" });
        }
        const result = await RoleModel.createRole({ name, role_type });
        return res.status(201).json({ id: result.lastInsertRowid, name, role_type });
    } catch (error) {
        return res.status(500).json({ message: "Error creating role", error });
    }
};

export const updateRole = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const updates = req.body;
        await RoleModel.updateRole(id, updates);
        return res.json({ message: "Role updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating role", error });
    }
};

export const deleteRole = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await RoleModel.deleteRole(id);
        return res.json({ message: "Role deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting role", error });
    }
};

// Permissions

export const getPermissions = async (req: Request, res: Response) => {
    try {
        const permissions = await PermissionModel.listPermissions();
        return res.json(permissions);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching permissions", error });
    }
};

export const getRolePermissions = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const permissions = await RolePermissionModel.listRolePermissions(id);
        const permissionIds = permissions.map((p: any) => p.permission_id);
        return res.json(permissionIds);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching role permissions", error });
    }
};

export const updateRolePermissions = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const { permissions } = req.body; // Array of permission codes or ids

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ message: "Permissions must be an array" });
        }

        // Ideally we should transact this, but for now:
        // Get all avail permissions to map codes to IDs if needed.
        // The listRolePermissionCodes returns codes. The input might be codes.
        // Assuming input is permission IDs for robustness or codes?
        // Let's assume input is permission IDs as it's cleaner for editing.
        // Wait, listRolePermissions returns permission_id.

        const currentMap = await RolePermissionModel.listRolePermissions(id);
        const currentIds = currentMap.map((r: any) => r.permission_id as string);

        // Permissions to remove
        const toRemove = currentIds.filter((pid: string) => !permissions.includes(pid));
        for (const pid of toRemove) {
            await RolePermissionModel.removePermissionFromRole(id, pid);
        }

        // Permissions to add
        const toAdd = permissions.filter((pid: string) => !currentIds.includes(pid));
        for (const pid of toAdd) {
            await RolePermissionModel.addPermissionToRole(id, pid);
        }

        return res.json({ message: "Role permissions updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating role permissions", error });
    }
};
