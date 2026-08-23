"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalServerError = exports.ValidationError = exports.RateLimitError = exports.FileUploadError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.BadRequestError = exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    isOperational;
    details;
    constructor(statusCode, message, details = null, isOperational = true) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = new.target.name || this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
class BadRequestError extends ApiError {
    constructor(message = 'Bad Request', details = null) {
        super(400, message, details);
    }
}
exports.BadRequestError = BadRequestError;
class UnauthorizedError extends ApiError {
    constructor(message = 'Unauthorized access', details = null) {
        super(401, message, details);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends ApiError {
    constructor(message = 'Forbidden access: insufficient permissions', details = null) {
        super(403, message, details);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ApiError {
    constructor(message = 'Resource not found', details = null) {
        super(404, message, details);
    }
}
exports.NotFoundError = NotFoundError;
class FileUploadError extends ApiError {
    constructor(message = 'File upload failed', details = null) {
        super(400, message, details);
    }
}
exports.FileUploadError = FileUploadError;
class RateLimitError extends ApiError {
    constructor(message = 'Too many requests, please try again later', details = null) {
        super(429, message, details);
    }
}
exports.RateLimitError = RateLimitError;
class ValidationError extends ApiError {
    constructor(message = 'Validation failed', details = null) {
        super(422, message, details);
    }
}
exports.ValidationError = ValidationError;
class InternalServerError extends ApiError {
    constructor(message = 'Internal Server Error', details = null) {
        super(500, message, details, false);
    }
}
exports.InternalServerError = InternalServerError;
