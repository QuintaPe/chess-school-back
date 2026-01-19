import { db } from "../config/db";

export const initDB = async () => {
    try {
        // 1. USERS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, -- UUID
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT CHECK(role IN ('student', 'teacher', 'admin')) DEFAULT 'student',
                status TEXT CHECK(status IN ('active', 'inactive', 'pending')) DEFAULT 'active',
                subscription_plan TEXT CHECK(subscription_plan IN ('free', 'premium')) DEFAULT 'free',
                avatar_url TEXT,
                bio TEXT,
                discord_id TEXT,
                discord_username TEXT,
                discord_access_token TEXT,
                discord_refresh_token TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration for Users
        try { await db.execute("ALTER TABLE users ADD COLUMN discord_id TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN discord_username TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN discord_access_token TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE users ADD COLUMN discord_refresh_token TEXT"); } catch (e) { }

        // 2. COURSES Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                level TEXT CHECK(level IN ('beginner', 'intermediate', 'advanced')),
                category TEXT,
                price REAL DEFAULT 0.00,
                thumbnail_url TEXT,
                is_published BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. LESSONS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS lessons (
                id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT, -- Markdown content
                video_url TEXT,
                order_index INTEGER DEFAULT 0,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        // 4. STUDENT GROUPS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS student_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                teacher_id TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // 5. GROUP MEMBERS Table (Many-to-Many)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS group_members (
                group_id TEXT,
                user_id TEXT,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 6. CLASSES Table (with group_id support)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                level TEXT CHECK(level IN ('beginner', 'intermediate', 'advanced')),
                start_time DATETIME NOT NULL,
                teacher_id TEXT,
                group_id TEXT, -- Optional: Associate class with a specific group
                status TEXT CHECK(status IN ('scheduled', 'live', 'completed', 'canceled')) DEFAULT 'scheduled',
                meeting_link TEXT,
                video_url TEXT,
                recurring_days TEXT, -- JSON array of numbers
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users(id),
                FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE SET NULL
            )
        `);

        // Migrations for Classes
        try { await db.execute("ALTER TABLE classes ADD COLUMN group_id TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE classes ADD COLUMN video_url TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE classes ADD COLUMN recurring_days TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE classes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (e) { }


        // 7. CLASS REGISTRATIONS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS class_registrations (
                user_id TEXT NOT NULL,
                class_id TEXT NOT NULL,
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, class_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
            )
        `);

        // 8. PUZZLES Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS puzzles (
                id TEXT PRIMARY KEY,
                external_id TEXT,
                fen TEXT NOT NULL,
                solution TEXT NOT NULL, -- Stored as JSON string array
                rating INTEGER DEFAULT 800,
                rating_deviation INTEGER,
                popularity INTEGER,
                nb_plays INTEGER,
                turn TEXT CHECK(turn IN ('w', 'b')),
                tags TEXT, -- Stored as JSON string array (Themes in CSV)
                game_url TEXT,
                opening_tags TEXT, -- Stored as JSON string array
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration for Puzzles (ensure columns exist if table was created with an old schema)
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN external_id TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN turn TEXT CHECK(turn IN ('w', 'b'))"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN tags TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN rating INTEGER DEFAULT 800"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN rating_deviation INTEGER"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN popularity INTEGER"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN nb_plays INTEGER"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN game_url TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE puzzles ADD COLUMN opening_tags TEXT"); } catch (e) { }

        // 9. USER PROGRESS Tables
        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_lesson_progress (
                user_id TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, lesson_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
            )
        `);

        // Migration: Rename old table if exists
        try {
            await db.execute("INSERT INTO user_lesson_progress (user_id, lesson_id, completed_at) SELECT user_id, lesson_id, completed_at FROM user_lessons_completed");
            await db.execute("DROP TABLE user_lessons_completed");
        } catch (e) {
            // Table doesn't exist or already migrated
        }

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_puzzle_history (
                user_id TEXT NOT NULL,
                puzzle_id TEXT NOT NULL,
                solved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_correct BOOLEAN,
                PRIMARY KEY (user_id, puzzle_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_stats (
                user_id TEXT PRIMARY KEY,
                rating INTEGER DEFAULT 1200,
                puzzles_solved INTEGER DEFAULT 0,
                accuracy REAL DEFAULT 0.0,
                streak INTEGER DEFAULT 0,
                total_games INTEGER DEFAULT 0,
                win_rate REAL DEFAULT 0.0,
                study_hours REAL DEFAULT 0.0,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 10. COURSE ENROLLMENTS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS course_enrollments (
                user_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        // 11. DISCORD SETTINGS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS discord_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // Initial settings
        try {
            await db.execute("INSERT OR IGNORE INTO discord_settings (key, value) VALUES ('webhook_url', '')");
            await db.execute("INSERT OR IGNORE INTO discord_settings (key, value) VALUES ('guild_id', '')");
            await db.execute("INSERT OR IGNORE INTO discord_settings (key, value) VALUES ('premium_role_id', '')");
        } catch (e) { }

        // 12. DAILY PUZZLES Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS daily_puzzles (
                id TEXT PRIMARY KEY,
                puzzle_id TEXT NOT NULL,
                date DATE NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE
            )
        `);

        // Create index for fast date lookups
        try {
            await db.execute("CREATE INDEX IF NOT EXISTS idx_daily_puzzles_date ON daily_puzzles(date)");
        } catch (e) { }

        // 13. DAILY PUZZLE ATTEMPTS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS daily_puzzle_attempts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                daily_puzzle_id TEXT NOT NULL,
                solved BOOLEAN DEFAULT 0,
                attempts INTEGER DEFAULT 0,
                time_spent INTEGER, -- Time in seconds
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (daily_puzzle_id) REFERENCES daily_puzzles(id) ON DELETE CASCADE,
                UNIQUE(user_id, daily_puzzle_id)
            )
        `);

        // Create indexes for frequent queries
        try {
            await db.execute("CREATE INDEX IF NOT EXISTS idx_daily_puzzle_attempts_user ON daily_puzzle_attempts(user_id)");
            await db.execute("CREATE INDEX IF NOT EXISTS idx_daily_puzzle_attempts_daily_puzzle ON daily_puzzle_attempts(daily_puzzle_id)");
            await db.execute("CREATE INDEX IF NOT EXISTS idx_daily_puzzle_attempts_solved ON daily_puzzle_attempts(solved)");
        } catch (e) { }

        // 14. ACTIVITY LOG Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL, -- e.g., 'new_user', 'class_created', 'course_purchased'
                message TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 15. ACHIEVEMENTS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS achievements (
                id TEXT PRIMARY KEY, -- String ID like 'first_puzzle', 'streak_7'
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                icon_url TEXT,
                criteria_type TEXT NOT NULL, -- 'puzzle_solve_total', 'puzzle_streak', 'course_enroll_total'
                criteria_value INTEGER NOT NULL
            )
        `);

        // 16. USER ACHIEVEMENTS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                user_id TEXT NOT NULL,
                achievement_id TEXT NOT NULL,
                unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, achievement_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
            )
        `);

        // Initial Achievements Seed
        const initialAchievements = [
            ['first_puzzle', 'Primer Paso', 'Resuelve tu primer problema del día', null, 'puzzle_solve_total', 1],
            ['puzzles_10', 'Estratega Novato', 'Resuelve 10 problemas del día', null, 'puzzle_solve_total', 10],
            ['puzzles_50', 'Maestro de Tácticas', 'Resuelve 50 problemas del día', null, 'puzzle_solve_total', 50],
            ['streak_7', 'Siete de Suerte', 'Mantén una racha de 7 días resolviendo el problema del día', null, 'puzzle_streak', 7],
            ['streak_30', 'Constancia de Acero', 'Mantén una racha de 30 días resolviendo el problema del día', null, 'puzzle_streak', 30],
            ['course_enroll_1', 'Estudiante Dedicado', 'Inscríbete en tu primer curso', null, 'course_enroll_total', 1],
        ];

        for (const [id, name, desc, icon, type, val] of initialAchievements) {
            try {
                await db.execute({
                    sql: "INSERT OR IGNORE INTO achievements (id, name, description, icon_url, criteria_type, criteria_value) VALUES (?, ?, ?, ?, ?, ?)",
                    args: [id, name, desc, icon, type, val]
                });
            } catch (e) { }
        }

        console.log("Database tables initialized according to new requirements (including achievements)");

    } catch (error) {
        console.error("Error initializing database:", error);
    }
};
