import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[REQUEST] ${req.method} ${req.url}`);

    const oldSend = res.send;
    res.send = function (data) {
      if (res.statusCode >= 400) {
        console.error(
          `[RESPONSE ERROR] ${req.method} ${req.url} - Status: ${res.statusCode}`,
        );
        console.error('Body:', data);
      }
      return oldSend.apply(res, arguments as any);
    };

    next();
  }
}
