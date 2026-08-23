"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const apiError_1 = require("../utils/apiError");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Mock bill dataset
const mockBills = [
    { id: 'b101', title: 'Dinner at IIIT Mess', amount: 450, paidBy: 'user1', status: 'SPLIT' },
    { id: 'b102', title: 'Hostel Wi-Fi Bill', amount: 1200, paidBy: 'user2', status: 'PENDING' },
];
// Router-level middleware 1: Require authentication on all bill routes
router.use(rbac_middleware_1.authenticateToken);
// Router-level middleware 2: Require role USER, MANAGER, or ADMIN
router.use((0, rbac_middleware_1.authorizeRoles)('USER', 'MANAGER', 'ADMIN'));
// Router-level middleware 3: Custom bill audit logger
router.use((req, res, next) => {
    logger_1.default.info(`BillRouter accessed by user: ${req.user?.id} (${req.user?.role})`, {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
    });
    next();
});
/**
 * GET /api/bills
 * Retrieve list of split bills
 */
router.get('/', (req, res) => {
    res.json({
        success: true,
        count: mockBills.length,
        data: mockBills,
    });
});
/**
 * GET /api/bills/:id
 * Retrieve specific bill by ID
 */
router.get('/:id', (req, res, next) => {
    const bill = mockBills.find((b) => b.id === req.params.id);
    if (!bill) {
        return next(new apiError_1.NotFoundError(`Bill with ID ${req.params.id} not found`));
    }
    res.json({
        success: true,
        data: bill,
    });
});
/**
 * POST /api/bills
 * Create new bill (requires title and positive amount)
 */
router.post('/', (req, res, next) => {
    const { title, amount } = req.body || {};
    if (!title || typeof title !== 'string') {
        return next(new apiError_1.BadRequestError('Bill title is required and must be a string'));
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
        return next(new apiError_1.BadRequestError('Bill amount is required and must be a positive number'));
    }
    const newBill = {
        id: `b${Date.now()}`,
        title,
        amount,
        paidBy: req.user?.id || 'unknown',
        status: 'PENDING',
    };
    mockBills.push(newBill);
    logger_1.default.info(`New bill created: ${newBill.id} - "${title}" ($${amount}) by ${req.user?.id}`, {
        requestId: req.requestId,
    });
    res.status(201).json({
        success: true,
        message: 'Bill created successfully',
        data: newBill,
    });
});
exports.default = router;
