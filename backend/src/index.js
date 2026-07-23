import 'express-async-errors';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { tripRouter } from './routes/trip.routes.js';
import { itineraryRouter } from './routes/itinerary.routes.js';
import { expenseRouter } from './routes/expense.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { paymentRouter } from './routes/payment.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { vehicleRouter } from './routes/vehicle.routes.js';
import { rentalRouter } from './routes/rental.routes.js';
import { rideRouter } from './routes/ride.routes.js';
import { verificationRouter } from './routes/verification.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import { registerSocketHandlers } from './socket/index.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === 'null' || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
};

// Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io to app for use in routes
app.set('io', io);
registerSocketHandlers(io);

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  const protocol = req.protocol;
  const host = req.get('host');
  res.json({
    success: true,
    apiBaseUrl: `${protocol}://${host}/api`,
    socketUrl: `${protocol}://${host}`,
    clients: ['web', 'desktop', 'android'],
  });
});

// Root route
app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to PackAndSync API',
    status: 'running',
    docs: '/api-docs', // placeholder if there are docs
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/trips', tripRouter);
app.use('/api/trips', itineraryRouter);
app.use('/api/trips', expenseRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);
app.use('/api/vehicles', vehicleRouter);
app.use('/api/rentals', rentalRouter);
app.use('/api/rides', rideRouter);
app.use('/api/verifications', verificationRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);

httpServer.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((net) => net?.family === 'IPv4' && !net.internal)?.address;
  console.log(`🚀 PackAndSync API running on http://localhost:${PORT}`);
  if (lan) console.log(`📱 Android/other devices: http://${lan}:${PORT}/api`);
});

export { app, io };
