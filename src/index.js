import express from 'express';
import cors from 'cors';
import { initDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/booking.js';
import adminRoutes from './routes/admin.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

await initDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/booking', bookingRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});