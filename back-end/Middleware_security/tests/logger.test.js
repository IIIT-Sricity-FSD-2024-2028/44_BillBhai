"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("../src/utils/logger"));
describe('Log & Error Management File Storage Test Suite', () => {
    const logsDir = path_1.default.join(process.cwd(), 'logs');
    it('should verify that logs directory exists', () => {
        expect(fs_1.default.existsSync(logsDir)).toBe(true);
    });
    it('should write info, warn, and error log entries to daily rotating log files', (done) => {
        logger_1.default.info('Test info log entry for regular interval file log verification');
        logger_1.default.warn('Test warning log entry');
        logger_1.default.error('Test error log entry for error file verification', {
            errorDetail: 'Simulated system error',
        });
        // Give winston transport a moment to flush to disk
        setTimeout(() => {
            const files = fs_1.default.readdirSync(logsDir);
            expect(files.length).toBeGreaterThan(0);
            // Verify log filenames follow daily rotation pattern (app-*, error-*, access-*)
            const hasAppLog = files.some((f) => f.startsWith('app-') && f.endsWith('.log'));
            const hasErrorLog = files.some((f) => f.startsWith('error-') && f.endsWith('.log'));
            expect(hasAppLog).toBe(true);
            expect(hasErrorLog).toBe(true);
            done();
        }, 500);
    });
});
