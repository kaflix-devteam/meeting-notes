import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { initDatabase } from './config/initDb';
import teamsRouter from './routes/teams';
import reportsRouter from './routes/reports';
import finalReportsRouter from './routes/finalReports';
import attachmentsRouter from './routes/attachments';
import imagesRouter from './routes/images';
import authRouter from './routes/auth';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Middleware
if (isDev) {
  app.use(cors());
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/teams', teamsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/final-reports', finalReportsRouter);
app.use('/api/attachments', attachmentsRouter);
app.use('/api/images', imagesRouter);
app.use('/api/auth', authRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Production: serve frontend static files + SPA fallback
if (!isDev) {
  const publicPath = path.join(__dirname, '../public');
  app.use(express.static(publicPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[app] Unhandled error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize DB then start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (${isDev ? 'development' : 'production'})`);
    });
  })
  .catch((err) => {
    console.error('[app] Failed to start server:', err);
    process.exit(1);
  });

export default app;
