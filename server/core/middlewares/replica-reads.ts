import { runInDbContext, runWithReplicaReads } from '@server/lib/database-replicas/db-context.js'
import express from 'express'

export function requestDbContext (_req: express.Request, res: express.Response, next: express.NextFunction) {
  const request = { ended: false }

  const end = () => {
    request.ended = true
  }

  res.once('finish', end)
  res.once('close', end)

  return runInDbContext({ allowReplica: false, request }, () => next())
}

export function allowReplicaReadsToController<T extends (req: express.Request, res: express.Response, next?: express.NextFunction) => any> (
  handler: T
): T {
  return ((req: express.Request, res: express.Response, next?: express.NextFunction) => {
    return withReplicaReadsFromRes(res, () => handler(req, res, next))
  }) as T
}

export function withReplicaReadsFromRes<T> (res: express.Response, fn: () => T): T {
  return runWithReplicaReads(res.locals.oauth?.token.User.id, fn)
}
