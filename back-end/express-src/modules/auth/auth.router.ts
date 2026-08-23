'use strict';
const express = require('express');
const { loginRateLimiter } = require('../../security/rate-limit');

function createAuthRouter(authService) {
  const router = express.Router();

  /**
   * POST /api/auth/login
   * Public route — no x-role required.
   * Strict rate limit: 5 attempts per 60 seconds per IP.
   */
  router.post('/login', loginRateLimiter, async (req, res, next) => {
    try {
      const { username, password } = req.body;
      if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ statusCode: 400, message: 'username is required', requestId: req.requestId });
      }
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ statusCode: 400, message: 'password is required', requestId: req.requestId });
      }
      const user = await authService.validateCredentials(username.trim(), password);
      return res.status(200).json(user);
    } catch (err) { next(err); }
  });

  return router;
}

module.exports = { createAuthRouter };
