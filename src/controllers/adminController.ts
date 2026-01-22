import { Request, Response } from 'express';
import { db } from '../config/db';
import { getRecentActivity } from '../models/audit/activityLogModel';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Summary Metrics
        const studentsCount = await db.execute({
            sql: "SELECT COUNT(DISTINCT ur.user_id) as count FROM user_roles ur WHERE ur.role_id = ?",
            args: ['role_student']
        });
        const teachersCount = await db.execute({
            sql: "SELECT COUNT(DISTINCT ur.user_id) as count FROM user_roles ur WHERE ur.role_id = ?",
            args: ['role_coach']
        });
        const activeClassesCount = await db.execute("SELECT COUNT(*) as count FROM live_classes WHERE status IN ('scheduled', 'live')");
        const puzzlesCount = await db.execute("SELECT COUNT(*) as count FROM puzzles");
        const coursesCount = await db.execute("SELECT COUNT(*) as count FROM courses");

        // Calculate theoretical revenue from course enrollments in the last 30 days
        const revenueResult = await db.execute(`
            SELECT SUM(amount_paid) as total
            FROM transactions
            WHERE status = 'completed'
            AND created_at > date('now', '-30 days')
        `);
        const monthlyRevenue = Number(revenueResult.rows[0]?.total || 0);

        // 2. Recent Students (Last 10)
        const recentStudents = await db.execute({
            sql: `
                SELECT u.id, u.name, u.email, u.avatar_url, u.created_at
                FROM users u
                WHERE u.id IN (SELECT user_id FROM user_roles WHERE role_id = ?)
                ORDER BY u.created_at DESC
                LIMIT 10
            `,
            args: ['role_student']
        });

        // 3. Upcoming Classes (Next 7 days)
        const upcomingClasses = await db.execute({
            sql: `
                SELECT lc.*, u.name as teacher_name
                FROM live_classes lc
                LEFT JOIN users u ON lc.teacher_id = u.id
                WHERE lc.scheduled_at >= CURRENT_TIMESTAMP
                AND lc.scheduled_at <= date('now', '+7 days')
                ORDER BY lc.scheduled_at ASC
            `
        });

        // 4. Published Courses
        const publishedCourses = await db.execute("SELECT * FROM courses WHERE is_published = 1");

        // 5. Puzzles (Small sample)
        const samplePuzzles = await db.execute("SELECT * FROM puzzles ORDER BY id DESC LIMIT 5");

        // 6. Recent Activity
        const recentActivity = await getRecentActivity(10);

        return res.json({
            summary: {
                totalStudents: Number(studentsCount.rows[0]?.count || 0),
                totalTeachers: Number(teachersCount.rows[0]?.count || 0),
                activeClasses: Number(activeClassesCount.rows[0]?.count || 0),
                totalPuzzles: Number(puzzlesCount.rows[0]?.count || 0),
                totalCourses: Number(coursesCount.rows[0]?.count || 0),
                monthlyRevenue: monthlyRevenue
            },
            students: recentStudents.rows,
            classes: upcomingClasses.rows,
            courses: publishedCourses.rows,
            puzzles: samplePuzzles.rows,
            recentActivity
        });

    } catch (error) {
        console.error("Error fetching admin stats:", error);
        return res.status(500).json({ error: "Error interno del servidor" });
    }
};
