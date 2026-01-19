import { Request, Response } from 'express';
import { db } from '../config/db';
import { getRecentActivity } from '../models/activityModel';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        // 1. Summary Metrics
        const studentsCount = await db.execute("SELECT COUNT(*) as count FROM users WHERE role = 'student'");
        const teachersCount = await db.execute("SELECT COUNT(*) as count FROM users WHERE role = 'teacher'");
        const activeClassesCount = await db.execute("SELECT COUNT(*) as count FROM classes WHERE status IN ('scheduled', 'live')");
        const puzzlesCount = await db.execute("SELECT COUNT(*) as count FROM puzzles");
        const coursesCount = await db.execute("SELECT COUNT(*) as count FROM courses");

        // Calculate theoretical revenue from course enrollments in the last 30 days
        const revenueResult = await db.execute(`
            SELECT SUM(c.price) as total 
            FROM course_enrollments ce
            JOIN courses c ON ce.course_id = c.id
            WHERE ce.enrolled_at > date('now', '-30 days')
        `);
        const monthlyRevenue = Number(revenueResult.rows[0]?.total || 0);

        // 2. Recent Students (Last 10)
        const recentStudents = await db.execute(`
            SELECT id, name, email, avatar_url, created_at 
            FROM users 
            WHERE role = 'student' 
            ORDER BY created_at DESC 
            LIMIT 10
        `);

        // 3. Upcoming Classes (Next 7 days)
        const upcomingClasses = await db.execute({
            sql: `
                SELECT c.*, u.name as teacher_name 
                FROM classes c
                LEFT JOIN users u ON c.teacher_id = u.id
                WHERE c.start_time >= CURRENT_TIMESTAMP 
                AND c.start_time <= date('now', '+7 days')
                ORDER BY c.start_time ASC
            `
        });

        // 4. Published Courses
        const publishedCourses = await db.execute("SELECT * FROM courses WHERE is_published = 1");

        // 5. Puzzles (Small sample)
        const samplePuzzles = await db.execute("SELECT * FROM puzzles ORDER BY created_at DESC LIMIT 5");

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
