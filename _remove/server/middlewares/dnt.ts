import * as express from 'express'

const advertiseDoNotTrack = (_, res: express.Response, next: express.NextFunction) => {
  if (!res.headersSent) {
    res.setHeader('Tk', 'N')
  }

  return next()
}

// ---------------------------------------------------------------------------

export {
  advertiseDoNotTrack
}
