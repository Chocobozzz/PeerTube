export * from '@server/types/index.js'
export * from '@server/types/models/index.js'
export * from '@peertube/peertube-models'

declare global {
  namespace Express {
    interface Request {
      rawBody: Buffer
    }
  }
}
