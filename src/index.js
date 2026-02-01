require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

// Route imports
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payments');
const googleRoutes = require('./routes/google');
const templateRoutes = require('./routes/templates');
const aiRoutes = require('./routes/ai');
const reviewRoutes = require('./routes/reviews');

const app = express();

// Connect to database
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS - Allow all origins for mobile app
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'InstaTool API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString() 
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/google', googleRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reviews', reviewRoutes);

// Google OAuth callback redirect
app.get('/google-connected', (req, res) => {
  const success = req.query.success === 'true';
  const error = req.query.error;
  
  if (success) {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connected!</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background: #0F172A; color: #F8FAFC; }
            h1 { color: #22c55e; }
            p { color: #94A3B8; }
          </style>
        </head>
        <body>
          <h1>✅ Google Business Profile Connected!</h1>
          <p>You can now close this window and return to the app.</p>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background: #0F172A; color: #F8FAFC; }
            h1 { color: #ef4444; }
            p { color: #94A3B8; }
          </style>
        </head>
        <body>
          <h1>❌ Connection Failed</h1>
          <p>Error: ${error || 'Unknown error'}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found', path: req.path });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Start automation job only in development
    const { startAutomationJob } = require('./services/automation');
    startAutomationJob();
  });
}

// Export for Vercel
module.exports = app;
