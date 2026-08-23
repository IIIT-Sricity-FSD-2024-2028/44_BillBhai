export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  cors: {
    origin: string;
    methods: string[];
    allowedHeaders: string[];
  };
}

export const config: AppConfig = Object.freeze({
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api',
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-role'],
  },
});
