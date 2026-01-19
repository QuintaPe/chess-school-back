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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                content TEXT, -- Markdown content
                video_url TEXT,
                order_index INTEGER DEFAULT 0,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        // 4. CLASSES Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                level TEXT CHECK(level IN ('beginner', 'intermediate', 'advanced')),
                start_time DATETIME NOT NULL,
                end_time DATETIME,
                capacity INTEGER DEFAULT 0,
                teacher_id TEXT,
                status TEXT CHECK(status IN ('scheduled', 'live', 'completed', 'canceled')) DEFAULT 'scheduled',
                meeting_link TEXT,
                recording_url TEXT,
                platform TEXT, -- zoom, meet, discord
                video_url TEXT, -- link de invitación o sala
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Migration for Classes
        try { await db.execute("ALTER TABLE classes ADD COLUMN platform TEXT"); } catch (e) { }
        try { await db.execute("ALTER TABLE classes ADD COLUMN video_url TEXT"); } catch (e) { }

        // 5. CLASS REGISTRATIONS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS class_registrations (
                user_id TEXT NOT NULL,
                class_id INTEGER NOT NULL,
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, class_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
            )
        `);

        // 6. PUZZLES Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS puzzles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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

        // 7. USER PROGRESS Tables
        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_lesson_progress (
                user_id TEXT NOT NULL,
                lesson_id INTEGER NOT NULL,
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
                puzzle_id INTEGER NOT NULL,
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

        // 8. COURSE ENROLLMENTS Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS course_enrollments (
                user_id TEXT NOT NULL,
                course_id INTEGER NOT NULL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, course_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        // 9. DISCORD SETTINGS Table
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

        console.log("Database tables initialized according to new requirements");

    } catch (error) {
        console.error("Error initializing database:", error);
    }
};
