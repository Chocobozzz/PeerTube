/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import {
  buildAbsoluteFixturePath,
  flushAndRunServer,
  getMyUserInformation,
  prepareResumableUpload,
  sendResumableChunks,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateUser
} from '@shared/extra-utils'
import { MyUser, VideoPrivacy } from '@shared/models'

const expect = chai.expect

// Most classic resumable upload tests are done in other test suites

describe('Test resumable upload', function () {
  let server: ServerInfo
  let rootId: number

  async function prepareUpload (size: number) {
    const attributes = {
      name: 'video',
      channelId: server.videoChannel.id,
      privacy: VideoPrivacy.PUBLIC,
      fixture: 'video_short.mp4'
    }
    const mimetype = 'video/mp4'

    const res = await prepareResumableUpload({ url: server.url, token: server.accessToken, attributes, size, mimetype })

    return res.header['location'].split('?')[1]
  }

  async function sendChunks (pathUploadId: string, fixture: string, size: number) {
    const absoluteFilePath = buildAbsoluteFixturePath(fixture)

    return sendResumableChunks({ url: server.url, token: server.accessToken, pathUploadId, videoFilePath: absoluteFilePath, size })
  }

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    const res = await getMyUserInformation(server.url, server.accessToken)
    rootId = (res.body as MyUser).id

    await updateUser({
      url: server.url,
      userId: rootId,
      accessToken: server.accessToken,
      videoQuota: 1000
    })
  })

  describe('Resumable upload and chunks', function () {

    it('Should not accept more chunks than expected', async function () {
      const size = 100
      const uploadId = await prepareUpload(size)

      const otherSize = 500
      await sendChunks(uploadId, 'video_short.mp4', otherSize)
    })
  })
})
