import express from 'express'

function disableRobots (req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('X-Robots-Tag', 'noindex')

  return next()
}

// ---------------------------------------------------------------------------

export {
  disableRobots
}
