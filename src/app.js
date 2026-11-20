const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    // No Origin header (curl, server-to-server) is allowed; browsers must be listed in CORS_ORIGINS.
    origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ data: { status: 'ok' } }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
