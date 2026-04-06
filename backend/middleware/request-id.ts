import { type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

// Extende Request do Express para incluir requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Gera um UUID v4 para cada requisição, adiciona ao objeto Request
 * e expõe no header X-Request-Id da resposta para rastreabilidade.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}
