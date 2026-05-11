import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per window
  message: { error: 'Too many attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const securityMiddleware = (app) => {
  // Use Helmet to set secure HTTP headers
  app.use(helmet());

  // CORS - allow only localhost
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Strict SameSite cookie policy
  app.use((req, res, next) => {
    res.cookie('SameSite', 'Strict', { secure: process.env.NODE_ENV === 'production' });
    next();
  });
};
