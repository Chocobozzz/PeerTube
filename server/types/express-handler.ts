import { NextFunction, Request, Response } from 'express'

export type ExpressPromiseHandler = (req: Request<any>, res: Response, next: NextFunction) => Promise<any>
