'use strict';

const express = require('express');
const router = express.Router();

const { supabase } = require('../utils/supabase');

// POST /api/auth/verify
router.post('/verify', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(200).json({ valid: false });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(200).json({ valid: false });
    }
    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error('POST /auth/verify unexpected error:', err);
    return res.status(200).json({ valid: false });
  }
});

module.exports = router;
