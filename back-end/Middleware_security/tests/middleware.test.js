"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app_1 = __importDefault(require("../src/app"));
describe('Mandatory Middleware & Security Test Suite', () => {
    // ── 1. Request Context & Correlation ID Middleware ──────────────────────────
    describe('1. Request Context Middleware', () => {
        it('should assign a unique X-Request-ID header to every response', async () => {
            const response = await (0, supertest_1.default)(app_1.default).get('/health');
            expect(response.status).toBe(200);
            expect(response.headers['x-request-id']).toBeDefined();
            expect(response.headers['x-request-id']).toMatch(/^req-/);
        });
        it('should preserve incoming X-Request-ID header if provided', async () => {
            const customId = 'req-custom-test-12345';
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/health')
                .set('X-Request-ID', customId);
            expect(response.status).toBe(200);
            expect(response.headers['x-request-id']).toBe(customId);
        });
    });
    // ── 2. Security Middleware (Helmet, CORS, Rate Limiting, RBAC) ──────────────
    describe('2. Security Middleware', () => {
        it('should include Helmet security headers in HTTP responses', async () => {
            const response = await (0, supertest_1.default)(app_1.default).get('/health');
            expect(response.headers['x-dns-prefetch-control']).toBe('off');
            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });
        it('should handle CORS headers properly', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/health')
                .set('Origin', 'http://localhost:5500');
            expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5500');
        });
        it('should enforce RBAC authorization: deny USER access to ADMIN routes with 403', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/admin/system-status')
                .set('x-user-role', 'USER')
                .set('x-user-id', 'user-regular-01');
            expect(response.status).toBe(403);
            expect(response.body.success).toBe(false);
            expect(response.body.error.name).toBe('ForbiddenError');
            expect(response.body.error.message).toContain('Access denied');
        });
        it('should enforce RBAC authorization: allow ADMIN access to ADMIN routes with 200', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .get('/api/admin/system-status')
                .set('x-user-role', 'ADMIN')
                .set('x-user-id', 'user-admin-01');
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.status).toBe('OPERATIONAL');
        });
        it('should reject unauthenticated request to protected routes with 401', async () => {
            const response = await (0, supertest_1.default)(app_1.default).get('/api/bills');
            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
            expect(response.body.error.name).toBe('UnauthorizedError');
        });
    });
    // ── 3. File Upload Middleware ────────────────────────────────────────────────
    describe('3. File Upload Middleware', () => {
        const testFilePath = path_1.default.join(__dirname, 'test-receipt.png');
        beforeAll(() => {
            // Create temporary mock PNG file for testing
            fs_1.default.writeFileSync(testFilePath, Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
        });
        afterAll(() => {
            if (fs_1.default.existsSync(testFilePath)) {
                fs_1.default.unlinkSync(testFilePath);
            }
        });
        it('should successfully upload valid image file via uploadReceipt middleware', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/upload/receipt')
                .set('x-user-role', 'USER')
                .attach('receipt', testFilePath);
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.filename).toBeDefined();
            expect(response.body.data.mimeType).toBe('image/png');
        });
        it('should reject file upload with disallowed extension (.txt)', async () => {
            const invalidFile = path_1.default.join(__dirname, 'test-invalid.txt');
            fs_1.default.writeFileSync(invalidFile, 'Plain text content');
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/upload/receipt')
                .set('x-user-role', 'USER')
                .attach('receipt', invalidFile);
            fs_1.default.unlinkSync(invalidFile);
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid file type');
        });
    });
    // ── 4. Error Handling & 404 Middleware ──────────────────────────────────────
    describe('4. Centralized Error Handling Middleware', () => {
        it('should handle 404 Not Found for non-existent routes with standardized JSON error', async () => {
            const response = await (0, supertest_1.default)(app_1.default).get('/api/non-existent-route-xyz');
            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.name).toBe('NotFoundError');
            expect(response.body.error.statusCode).toBe(404);
            expect(response.body.error.requestId).toBeDefined();
        });
        it('should return 400 Bad Request when mandatory bill fields are missing', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/bills')
                .set('x-user-role', 'USER')
                .send({}); // Missing title and amount
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.name).toBe('BadRequestError');
        });
    });
    // ── 5. Router-level Middleware ──────────────────────────────────────────────
    describe('5. Router-level Middleware', () => {
        it('should demonstrate router-level auth middleware on /api/auth/login', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({ email: 'student@iiits.in', password: 'password123', role: 'MANAGER' });
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.role).toBe('MANAGER');
        });
        it('should demonstrate router-level bill creation when authenticated', async () => {
            const response = await (0, supertest_1.default)(app_1.default)
                .post('/api/bills')
                .set('x-user-role', 'USER')
                .send({ title: 'Team Dinner', amount: 800 });
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.title).toBe('Team Dinner');
            expect(response.body.data.amount).toBe(800);
        });
    });
});
