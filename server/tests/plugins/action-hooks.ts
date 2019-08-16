/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  cleanupTests,
  flushAndRunMultipleServers,
  flushAndRunServer, killallServers, reRunServer,
  ServerInfo,
  waitUntilLog
} from '../../../shared/extra-utils/server/servers'
import {
  addVideoCommentReply,
  addVideoCommentThread, deleteVideoComment,
  getPluginTestPath,
  installPlugin, removeVideo,
  setAccessTokensToServers,
  updateVideo,
  uploadVideo,
  viewVideo
} from '../../../shared/extra-utils'

const expect = chai.expect

describe('Test plugin action hooks', function () {
  let servers: ServerInfo[]
  let videoUUID: string
  let threadId: number

  function checkHook (hook: string) {
    return waitUntilLog(servers[0], 'Run hook ' + hook)
  }

  before(async function () {
    this.timeout(30000)

    servers = await flushAndRunMultipleServers(2)
    await setAccessTokensToServers(servers)

    await installPlugin({
      url: servers[0].url,
      accessToken: servers[0].accessToken,
      path: getPluginTestPath()
    })

    killallServers([ servers[0] ])

    await reRunServer(servers[0])
  })

  it('Should run action:application.listening', async function () {
    await checkHook('action:application.listening')
  })

  it('Should run action:api.video.uploaded', async function () {
    const res = await uploadVideo(servers[0].url, servers[0].accessToken, { name: 'video' })
    videoUUID = res.body.video.uuid

    await checkHook('action:api.video.uploaded')
  })

  it('Should run action:api.video.updated', async function () {
    await updateVideo(servers[0].url, servers[0].accessToken, videoUUID, { name: 'video updated' })

    await checkHook('action:api.video.updated')
  })

  it('Should run action:api.video.viewed', async function () {
    await viewVideo(servers[0].url, videoUUID)

    await checkHook('action:api.video.viewed')
  })

  it('Should run action:api.video-thread.created', async function () {
    const res = await addVideoCommentThread(servers[0].url, servers[0].accessToken, videoUUID, 'thread')
    threadId = res.body.comment.id

    await checkHook('action:api.video-thread.created')
  })

  it('Should run action:api.video-comment-reply.created', async function () {
    await addVideoCommentReply(servers[0].url, servers[0].accessToken, videoUUID, threadId, 'reply')

    await checkHook('action:api.video-comment-reply.created')
  })

  it('Should run action:api.video-comment.deleted', async function () {
    await deleteVideoComment(servers[0].url, servers[0].accessToken, videoUUID, threadId)

    await checkHook('action:api.video-comment.deleted')
  })

  it('Should run action:api.video.deleted', async function () {
    await removeVideo(servers[0].url, servers[0].accessToken, videoUUID)

    await checkHook('action:api.video.deleted')
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
