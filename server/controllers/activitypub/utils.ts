import * as express from 'express'

function activityPubResponse (data: any, res: express.Response) {
  return res.type('application/activity+json; charset=utf-8')
            .json(data)
            .end()
}

export {
  activityPubResponse
}
