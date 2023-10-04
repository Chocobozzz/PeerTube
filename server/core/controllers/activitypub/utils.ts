import express from 'express'

async function activityPubResponse (promise: Promise<any>, res: express.Response) {
  const data = await promise

  return res.type('application/activity+json; charset=utf-8')
            .json(data)
}

export {
  activityPubResponse
}
