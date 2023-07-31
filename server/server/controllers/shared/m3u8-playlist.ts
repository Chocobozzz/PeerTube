import express from 'express'

function doReinjectVideoFileToken (req: express.Request) {
  return req.query.videoFileToken && req.query.reinjectVideoFileToken
}

function buildReinjectVideoFileTokenQuery (req: express.Request, isMaster: boolean) {
  const query = 'videoFileToken=' + req.query.videoFileToken
  if (isMaster) {
    return query + '&reinjectVideoFileToken=true'
  }
  return query
}

export {
  doReinjectVideoFileToken,
  buildReinjectVideoFileTokenQuery
}
