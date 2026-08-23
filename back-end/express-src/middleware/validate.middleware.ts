'use strict';

/**
 * validateBody(schema)
 * Lightweight body validator using a plain schema object.
 * Schema format: { fieldName: { required, type, minLength, pattern, isIn, min } }
 */
type ValidationRule = {
  required?: boolean;
  type?: 'string' | 'number' | 'array';
  minLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  isIn?: unknown[];
  min?: number;
};

function validateBody(schema: Record<string, ValidationRule>) {
  return (req, res, next) => {
    const body = req.body || {};
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];
      const isEmpty = value === undefined || value === null || value === '';

      if (rules.required && isEmpty) {
        errors.push(`${field} is required`);
        continue;
      }
      if (isEmpty) continue;

      if (rules.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }
      if (rules.type === 'number' && typeof value !== 'number') {
        errors.push(`${field} must be a number`);
      }
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      }
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.pattern && typeof value === 'string' && !rules.pattern.test(value)) {
        errors.push(rules.patternMessage || `${field} has an invalid format`);
      }
      if (rules.isIn && !rules.isIn.includes(value)) {
        errors.push(`${field} must be one of: ${rules.isIn.join(', ')}`);
      }
      if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
        errors.push(`${field} must be at least ${rules.min}`);
      }
    }

    // Strip unknown fields (whitelist)
    const allowedFields = Object.keys(schema);
    const extraFields = Object.keys(body).filter((k) => !allowedFields.includes(k));
    if (extraFields.length > 0) {
      errors.push(`Unknown field(s): ${extraFields.join(', ')}`);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId || null,
        message: errors,
        error: 'Bad Request',
      });
    }

    next();
  };
}

module.exports = { validateBody };
