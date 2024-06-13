/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode, UserRole } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video transcription API validator', function () {
  let servers: PeerTubeServer[]

  let userToken: string
  let anotherUserToken: string

  let remoteId: string
  let validId: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    await doubleFollow(servers[0], servers[1])

    userToken = await servers[0].users.generateUserAndToken('user', UserRole.USER)
    anotherUserToken = await servers[0].users.generateUserAndToken('user2', UserRole.USER)

    {
      const { uuid } = await servers[1].videos.quickUpload({ name: 'remote video' })
      remoteId = uuid
    }

    {
      const { uuid } = await servers[0].videos.quickUpload({ name: 'both 1', token: userToken })
      validId = uuid
    }

    await waitJobs(servers)

    await servers[0].config.enableTranscription()
  })

  it('Should not run transcription of an unknown video', async function () {
    await servers[0].captions.runGenerate({ videoId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not run transcription of a remote video', async function () {
    await servers[0].captions.runGenerate({ videoId: remoteId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not run transcription by a owner/moderator user', async function () {
    await servers[0].captions.runGenerate({ videoId: validId, token: anotherUserToken, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
  })

  it('Should not run transcription if a caption file already exists', async function () {
    await servers[0].captions.add({
      language: 'en',
      videoId: validId,
      fixture: 'subtitle-good1.vtt'
    })

    await servers[0].captions.runGenerate({ videoId: validId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    await servers[0].captions.delete({ language: 'en', videoId: validId })
  })

  it('Should not run transcription if the instance disabled it', async function () {
    await servers[0].config.disableTranscription()

    await servers[0].captions.runGenerate({ videoId: validId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

    await servers[0].config.enableTranscription()
  })

  it('Should succeed to run transcription', async function () {
    await servers[0].captions.runGenerate({ videoId: validId, token: userToken })
  })

  it('Should fail to run transcription twice', async function () {
    await servers[0].captions.runGenerate({ videoId: validId, token: userToken, expectedStatus: HttpStatusCode.CONFLICT_409 })
  })

  it('Should fail to run transcription twice with a non-admin user with the forceTranscription boolean', async function () {
    await servers[0].captions.runGenerate({
      videoId: validId,
      token: userToken,
      forceTranscription: true,
      expectedStatus: HttpStatusCode.FORBIDDEN_403
    })
  })

  it('Should succeed to run transcription twice with the forceTranscription boolean', async function () {
    await servers[0].captions.runGenerate({ videoId: validId, forceTranscription: true })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
