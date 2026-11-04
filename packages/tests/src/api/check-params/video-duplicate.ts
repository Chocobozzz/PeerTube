/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { SQLCommand } from '@tests/shared/sql-command.js'

describe('Test video duplicate API validator', function () {
  let server: PeerTubeServer
  let sqlCommand: SQLCommand

  let userToken: string
  let editorToken: string

  let videoUUID: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120_000)

    server = await createSingleServer(1)
    sqlCommand = new SQLCommand(server)

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    userToken = await server.users.generateUserAndToken('user1')
    editorToken = await server.channelCollaborators.createEditor('editor', 'root_channel')

    await server.config.enableMinimumTranscoding()

    const { uuid } = await server.videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    await waitJobs([ server ])
  })

  it('Should fail without token', async function () {
    await server.videos.duplicate({ id: videoUUID, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
  })

  it('Should fail with another user token', async function () {
    await server.videos.duplicate({ id: videoUUID, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should fail with an invalid video', async function () {
    await server.videos.duplicate({ id: 'toto', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should fail with an unknown video', async function () {
    await server.videos.duplicate({ id: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should fail with an invalid name', async function () {
    await server.videos.duplicate({ id: videoUUID, name: 'a', expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    await server.videos.duplicate({ id: videoUUID, name: 'a'.repeat(121), expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should fail with a live', async function () {
    await server.config.enableLive({ allowReplay: false })

    const { uuid } = await server.live.create({
      fields: { name: 'live', channelId: server.store.channel.id, privacy: VideoPrivacy.PUBLIC }
    })

    await server.videos.duplicate({ id: uuid, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should fail with a video that is being transcoded', async function () {
    this.timeout(60000)

    await server.jobs.pauseJobQueue()

    try {
      await server.videos.runTranscoding({ videoId: videoUUID, transcodingType: 'hls' })

      await server.videos.duplicate({ id: videoUUID, expectedStatus: HttpStatusCode.CONFLICT_409 })
    } finally {
      await server.jobs.resumeJobQueue()
    }

    await waitJobs([ server ])
  })

  it('Should fail with a video without files', async function () {
    this.timeout(120_000)

    const { uuid } = await server.videos.quickUpload({ name: 'video without files' })
    await waitJobs([ server ])

    await sqlCommand.removeVideoFilesOf(uuid)

    await server.videos.duplicate({ id: uuid, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should check the quota of the channel owner', async function () {
    this.timeout(120_000)

    const user = await server.users.create({ username: 'user_quota' })
    const quotaUserToken = await server.login.getAccessToken('user_quota')
    const quotaEditorToken = await server.channelCollaborators.createEditor('editor_quota', 'user_quota_channel')

    const { uuid } = await server.videos.quickUpload({ token: quotaUserToken, name: 'video quota', fixture: 'video_short.mp4' })
    await waitJobs([ server ])

    const { videoQuotaUsed } = await server.users.getMyQuotaUsed({ token: quotaUserToken })
    await server.users.update({ userId: user.id, videoQuota: Math.round(videoQuotaUsed * 1.5) })

    for (const token of [ quotaUserToken, quotaEditorToken, server.accessToken ]) {
      await server.videos.duplicate({ token, id: uuid, expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413 })
    }
  })

  it('Should fail with a blocked video unless the user can manage blocks', async function () {
    this.timeout(120_000)

    const { uuid } = await server.videos.quickUpload({ token: userToken, name: 'blocked video' })
    await waitJobs([ server ])

    await server.blacklist.add({ videoId: uuid })

    await server.videos.duplicate({ id: uuid, token: userToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    await server.videos.duplicate({ id: uuid })

    await waitJobs([ server ])
  })

  it('Should succeed with the correct params', async function () {
    await server.videos.duplicate({ id: videoUUID })
    await server.videos.duplicate({ id: videoUUID, token: editorToken, name: 'my copy' })

    await waitJobs([ server ])
  })

  after(async function () {
    await sqlCommand.cleanup()
    await cleanupTests([ server ])
  })
})
