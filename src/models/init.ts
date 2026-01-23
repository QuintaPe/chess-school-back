import { db } from "../config/db";

export const initDB = async () => {
    try {
        // await db.execute("PRAGMA foreign_keys = OFF");
        // const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        // for (const row of tables.rows) {
        //     await db.execute(`DROP TABLE IF EXISTS ${row.name}`);
        // }
        // await db.execute("PRAGMA foreign_keys = ON");
        // return;

        // 1. Núcleo de Usuarios y Acceso
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                avatar_url TEXT,
                status TEXT NOT NULL CHECK(status IN ('active', 'banned', 'pending')) DEFAULT 'active',
                last_login_at DATETIME,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                role_type TEXT NOT NULL CHECK(role_type IN ('admin', 'membership'))
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS permissions (
                id TEXT PRIMARY KEY,
                code TEXT NOT NULL UNIQUE,
                description TEXT
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id TEXT NOT NULL,
                permission_id TEXT NOT NULL,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                PRIMARY KEY (user_id, role_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
            )
        `);

        // 2. Monetización
        await db.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                product_type TEXT NOT NULL CHECK(product_type IN ('course_lifetime', 'subscription', 'bundle')),
                price REAL NOT NULL,
                currency TEXT NOT NULL,
                external_reference TEXT,
                is_active INTEGER NOT NULL DEFAULT 1
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS product_resources (
                id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                resource_type TEXT NOT NULL CHECK(resource_type IN ('course', 'role')),
                resource_id TEXT NOT NULL,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_entitlements (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                resource_type TEXT NOT NULL CHECK(resource_type IN ('course', 'role')),
                resource_id TEXT NOT NULL,
                access_mode TEXT NOT NULL CHECK(access_mode IN ('lifetime', 'subscription')),
                starts_at DATETIME NOT NULL,
                expires_at DATETIME,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                gateway_name TEXT NOT NULL,
                external_tx_id TEXT,
                amount_paid REAL NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('completed', 'refunded', 'failed', 'pending')),
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        // 3. Contenido
        await db.execute(`
            CREATE TABLE IF NOT EXISTS courses (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                level TEXT NOT NULL CHECK(level IN ('beginner', 'intermediate', 'advanced')),
                is_published INTEGER NOT NULL DEFAULT 0
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS modules (
                id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL,
                title TEXT NOT NULL,
                order_index INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS lessons (
                id TEXT PRIMARY KEY,
                module_id TEXT NOT NULL,
                title TEXT NOT NULL,
                lesson_type TEXT NOT NULL CHECK(lesson_type IN ('video', 'article', 'interactive_board')),
                content_md TEXT,
                video_url TEXT,
                order_index INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_progress (
                user_id TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('started', 'completed')),
                completed_at DATETIME,
                PRIMARY KEY (user_id, lesson_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
            )
        `);

        // 4. Puzzles
        await db.execute(`
            CREATE TABLE IF NOT EXISTS puzzles (
                id TEXT PRIMARY KEY,
                external_id TEXT,
                initial_fen TEXT NOT NULL,
                solution_moves TEXT NOT NULL,
                rating INTEGER NOT NULL DEFAULT 1200,
                themes TEXT
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS puzzle_attempts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                puzzle_id TEXT NOT NULL,
                solved INTEGER NOT NULL,
                time_spent INTEGER,
                rating_delta INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE
            )
        `);

        // 5. Clases
        await db.execute(`
            CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                teacher_id TEXT,
                level_tag TEXT,
                FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS group_members (
                group_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (group_id, user_id),
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS live_classes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                teacher_id TEXT,
                group_id TEXT,
                scheduled_at DATETIME NOT NULL,
                duration_mins INTEGER NOT NULL,
                room_url TEXT,
                status TEXT NOT NULL CHECK(status IN ('scheduled', 'live', 'finished')),
                FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS live_attendance (
                live_class_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (live_class_id, user_id),
                FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // 6. Auditoria
        await db.execute(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                action TEXT NOT NULL,
                metadata TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Indexes
        await db.execute("CREATE INDEX IF NOT EXISTS idx_user_entitlements_user ON user_entitlements(user_id)");
        await db.execute("CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id)");
        await db.execute("CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_user ON puzzle_attempts(user_id)");
        await db.execute("CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)");

        // Default Roles
        await db.execute({
            sql: "INSERT OR IGNORE INTO roles (id, name, role_type) VALUES (?, ?, ?)",
            args: ['role_admin', 'Admin', 'admin']
        });
        await db.execute({
            sql: "INSERT OR IGNORE INTO roles (id, name, role_type) VALUES (?, ?, ?)",
            args: ['role_teacher', 'Teacher', 'admin']
        });
        await db.execute({
            sql: "INSERT OR IGNORE INTO roles (id, name, role_type) VALUES (?, ?, ?)",
            args: ['role_student', 'Student', 'membership']
        });

        // Migration: Rename role_coach to role_teacher if it exists
        await db.execute("UPDATE OR IGNORE user_roles SET role_id = 'role_teacher' WHERE role_id = 'role_coach'");
        await db.execute("DELETE FROM roles WHERE id = 'role_coach'");

        console.log("Database tables initialized successfully (Reino Ajedrez v1)");
    } catch (error) {
        console.error("Error initializing database:", error);
    }
};
