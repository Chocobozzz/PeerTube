import express from 'express'

function doReinjectVideoFileToken (req: express.Request) {
  return req.query.videoFileToken && req.query.reinjectVideoFileToken
}

function buildReinjectVideoFileTokenQuery (req: express.Request) {
  return 'videoFileToken=' + req.query.videoFileToken
}

export {
  doReinjectVideoFileToken,
  buildReinjectVideoFileTokenQuery
}
