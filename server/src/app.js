import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import authRoutes from './routes/authRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.set('trust proxy', 1); // needed on Render so rate limit sees the real visitor
app.use(helmet());
app.use(cors({ origin: config.clientUrl })); // only our own frontend may call us
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/partner', partnerRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
