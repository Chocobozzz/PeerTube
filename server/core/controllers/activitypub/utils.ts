import express from 'express'

export async function activityPubResponse (promise: Promise<any>, res: express.Response) {
  const data = await promise

  if (!res.headersSent) {
    res.type('application/activity+json; charset=utf-8')
  }

  return res.json(data)
}
