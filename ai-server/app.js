'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/stt', require('./routes/stt'));
app.use('/api/tts', require('./routes/tts'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/expressions', require('./routes/expressions'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/shadowing', require('./routes/shadowing'));
app.use('/api/quiz', require('./routes/quiz'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

module.exports = app;
