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

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/teams', teamsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/final-reports', finalReportsRouter);
app.use('/api/attachments', attachmentsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[app] Unhandled error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize DB then start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[app] Failed to start server:', err);
    process.exit(1);
  });

export default app;
