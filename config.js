// config.js
export const CONFIG = {
  server: {
    port: 10000,
    baseUrl: 'https://chglobalfree.onrender.com',
    env: 'production'
  },

  jwt: {
    secret: 'chatglobal_secret_key_cambiar_en_produccion_2024',
    expiresIn: '7d'
  },

  postgres: {
    connectionString: 'postgresql://chat_global_user:XOi9kLBuetQBQEpXkQmzp1jfmbD4eNJj@dpg-dar1vbh7lnhs739ogavg-a.oregon-postgres.render.com/chat_global',
    ssl: { rejectUnauthorized: false },
    host: 'localhost',
    port: 5432,
    database: 'chat_global',
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
