// config.js
export const CONFIG = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    env: process.env.NODE_ENV || 'development'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'chatglobal_secret_key_cambiar_en_produccion_2024',
    expiresIn: '7d'
  },

  postgres: {
    connectionString: process.env.DATABASE_URL || null,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    host: 'localhost',
    port: 5432,
    database: 'chatglobal',
    user: 'postgres',
    password: 'postgres'
  },

  chat: {
    maxMessageLength: 500,
    maxHistory: 100,
    typingTimeoutMs: 3000
  },

  rateLimit: {
    global: { windowMs: 15 * 60 * 1000, max: 300 },
    auth:   { windowMs: 15 * 60 * 1000, max: 20  },
    message:{ windowMs: 60 * 1000,      max: 30  }
  }
};

export default CONFIG;
