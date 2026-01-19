import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Club Reino Ajedrez API',
            version: '1.0.0',
            description: 'Documentación de la API para el Club Reino Ajedrez. Incluye gestión de usuarios, clases, puzzles y logros.',
            contact: {
                name: 'Soporte Técnico',
                email: 'soporte@reinoajedrez.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Servidor de Desarrollo',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'uuid-123' },
                        name: { type: 'string', example: 'Juan Pérez' },
                        email: { type: 'string', format: 'email', example: 'juan@example.com' },
                        role: { type: 'string', enum: ['student', 'teacher', 'admin'], example: 'student' },
                        subscription_plan: { type: 'string', enum: ['free', 'premium'], example: 'free' },
                    },
                },
                DailyPuzzle: {
                    type: 'object',
                    properties: {
                        id: { type: 'integer' },
                        dailyPuzzleId: { type: 'integer' },
                        date: { type: 'string', format: 'date' },
                        fen: { type: 'string' },
                        solution: { type: 'array', items: { type: 'string' } },
                        difficulty: { type: 'string' },
                        userAttempt: {
                            type: 'object',
                            nullable: true,
                            properties: {
                                solved: { type: 'boolean' },
                                attempts: { type: 'integer' },
                                timeSpent: { type: 'integer' },
                            },
                        },
                    },
                },
                Achievement: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        isUnlocked: { type: 'boolean' },
                        unlocked_at: { type: 'string', format: 'date-time', nullable: true },
                    },
                },
            },
        },
    },
    // Path to the API docs
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const specs = swaggerJSDoc(options);
