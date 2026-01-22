import { Request, Response } from 'express';
import * as UserModel from '../models/auth/userModel';
import * as ClassModel from '../models/classes/liveClassesModel'; // For settings


const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Redirects user to Discord OAuth2
 */
export const redirectToDiscord = (req: Request, res: Response) => {
    const scope = encodeURIComponent('identify email guilds.join');
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI!)}&response_type=code&scope=${scope}`;
    res.redirect(url);
};

/**
 * Handles Discord OAuth2 callback
 */
export const handleDiscordCallback = async (req: Request, res: Response) => {
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ message: "No code provided" });

    try {
        // Exchange code for token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID!,
                client_secret: CLIENT_SECRET!,
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI!,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const tokens = await tokenResponse.json();
        if (tokens.error) throw new Error(tokens.error_description);

        // Get user info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        const discordUser = await userResponse.json();

        // Update user in DB
        // Assuming user is logged in and we have their DB ID in req.user
        const userId = (req as any).user?.id;
        if (!userId) {
            // If not logged in, we might need a different flow or look up by email
            // For now, let's assume they MUST be logged in to link discord
            return res.status(401).json({ message: "Must be logged in to link Discord" });
        }

        await UserModel.updateUser(userId, {
            discord_id: discordUser.id,
            discord_username: `${discordUser.username}#${discordUser.discriminator}`,
            discord_access_token: tokens.access_token,
            discord_refresh_token: tokens.refresh_token
        });

        // Trigger initial role sync
        const user = await UserModel.findUserById(userId);
        if (user) {
            await syncUserRole(user);
        }

        // Redirect back to dashboard
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/dashboard/profile?discord=success`);
    } catch (error: any) {
        console.error("Discord Auth Error:", error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/dashboard/profile?discord=error&message=` + encodeURIComponent(error.message));
    }
};

/**
 * Removes Discord link from user profile
 */
export const unlinkDiscord = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        // Remove role if possible before unlinking
        const user = await UserModel.findUserById(userId);
        if (user && user.discord_id) {
            // Force subscription_plan 'free' for the sync call to trigger role removal
            await syncUserRole({ ...user, subscription_plan: 'free' });
        }

        await UserModel.updateUser(userId, {
            discord_id: null as any,
            discord_username: null as any,
            discord_access_token: null as any,
            discord_refresh_token: null as any
        });

        res.json({ message: "Discord unlinked successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error unlinking Discord" });
    }
};

/**
 * Syncs roles for all premium users in the database
 */
export const syncAllRoles = async (req: Request, res: Response) => {
    try {
        const users = await UserModel.listUsers({});
        let synced = 0;

        for (const user of users) {
            if ((user as any).discord_id) {
                await syncUserRole(user);
                synced++;
            }
        }

        res.json({ message: `Sync completed. ${synced} users processed.` });
    } catch (error) {
        res.status(500).json({ message: "Error in bulk sync" });
    }
};

export const syncUserRole = async (user: any) => {
    // Role synchronization disabled for now as per user request
    return;
};

/**
 * Get/Update Discord settings
 */
export const getSettings = async (req: Request, res: Response) => {
    try {
        const settings = await ClassModel.getDiscordSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: "Error fetching settings" });
    }
};

export const updateSettings = async (req: Request, res: Response) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            await ClassModel.updateDiscordSetting(key, value as string);
        }
        res.json({ message: "Settings updated" });
    } catch (error) {
        res.status(400).json({ message: "Invalid settings data" });
    }
};
