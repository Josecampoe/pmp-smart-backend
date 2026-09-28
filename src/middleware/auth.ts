import { Request, Response, NextFunction } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Bypassed for local storage / local logic
  req.userId = 'local_user';
  req.userEmail = 'local@example.com';
  next();
}
