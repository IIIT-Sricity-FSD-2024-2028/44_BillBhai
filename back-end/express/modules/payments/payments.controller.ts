import { Request, Response } from 'express';
import { paymentsService } from './payments.service';

/** Payments Module Controller — Handles HTTP requests and responses */

export class PaymentsController {
  public async createRazorpayOrder(req: Request, res: Response): Promise<void> {
    const result = await paymentsService.createRazorpayOrder(req.body);
    res.status(201).json(result);
  }

  public verifyRazorpayPayment(req: Request, res: Response): void {
    const result = paymentsService.verifyRazorpayPayment(req.body);
    res.status(200).json(result);
  }

  public async createSubscriptionOrder(
    req: Request,
    res: Response,
  ): Promise<void> {
    const result = await paymentsService.createSubscriptionOrder(req.body);
    res.status(201).json(result);
  }

  public verifySubscriptionPayment(req: Request, res: Response): void {
    const result = paymentsService.verifySubscriptionPayment(req.body);
    res.status(200).json(result);
  }

  public handleWebhook(req: Request, res: Response): void {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const result = paymentsService.handleWebhook(req.body, signature);
    res.status(200).json(result);
  }
}

export const paymentsController = new PaymentsController();
