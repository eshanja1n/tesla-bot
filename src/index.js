import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { debugRouter } from './routes/debug.js';
import { wellKnownRouter } from './routes/well-known.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    message: 'Tesla Fleet API Bot',
    status: 'running',
    endpoints: {
      auth: '/auth',
      api: '/api',
      publicKey: '/.well-known/appspecific/com.tesla.3p.public-key.pem'
    }
  });
});

app.use('/auth', authRouter);
app.use('/api', apiRouter);
app.use('/debug', debugRouter);
app.use('/.well-known', wellKnownRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Tesla Fleet API Bot running on port ${port}`);
  });
}

export default app;