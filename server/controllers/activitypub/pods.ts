// import * as express from 'express'
//
// import { database as db } from '../../../initializers/database'
// import {
//   checkSignature,
//   signatureValidator,
//   setBodyHostPort,
//   remotePodsAddValidator,
//   asyncMiddleware
// } from '../../../middlewares'
// import { sendOwnedDataToPod } from '../../../lib'
// import { getMyPublicCert, getFormattedObjects } from '../../../helpers'
// import { CONFIG } from '../../../initializers'
// import { PodInstance } from '../../../models'
// import { PodSignature, Pod as FormattedPod } from '../../../../shared'
//
// const remotePodsRouter = express.Router()
//
// remotePodsRouter.post('/remove',
//   signatureValidator,
//   checkSignature,
//   asyncMiddleware(removePods)
// )
//
// remotePodsRouter.post('/list',
//   asyncMiddleware(remotePodsList)
// )
//
// remotePodsRouter.post('/add',
//   setBodyHostPort, // We need to modify the host before running the validator!
//   remotePodsAddValidator,
//   asyncMiddleware(addPods)
// )
//
// // ---------------------------------------------------------------------------
//
// export {
//   remotePodsRouter
// }
//
// // ---------------------------------------------------------------------------
//
// async function addPods (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const information = req.body
//
//   const pod = db.Pod.build(information)
//   const podCreated = await pod.save()
//
//   await sendOwnedDataToPod(podCreated.id)
//
//   const cert = await getMyPublicCert()
//   return res.json({ cert, email: CONFIG.ADMIN.EMAIL })
// }
//
// async function remotePodsList (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const pods = await db.Pod.list()
//
//   return res.json(getFormattedObjects<FormattedPod, PodInstance>(pods, pods.length))
// }
//
// async function removePods (req: express.Request, res: express.Response, next: express.NextFunction) {
//   const signature: PodSignature = req.body.signature
//   const host = signature.host
//
//   const pod = await db.Pod.loadByHost(host)
//   await pod.destroy()
//
//   return res.type('json').status(204).end()
// }
