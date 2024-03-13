/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer, PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test user import API validators', function () {
  let server: PeerTubeServer
  let userId: number
  let rootId: number
  let token: string

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    {
      const result = await server.users.generate('user')
      userId = result.userId
      token = result.token
    }

    {
      const { id } = await server.users.getMyInfo()
      rootId = id
    }
  })

  describe('Request import', function () {

    it('Should fail if import is disabled', async function () {
      await server.config.disableUserImport()

      await server.userImports.importArchive({
        userId,
        fixture: 'export-without-files.zip',
        token,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })

      await server.config.enableUserImport()
    })

    it('Should fail without token', async function () {
      await server.userImports.importArchive({
        userId,
        fixture: 'export-without-files.zip',
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with invalid token', async function () {
      await server.userImports.importArchive({
        userId,
        fixture: 'export-without-files.zip',
        token: 'invalid',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a token of another user', async function () {
      await server.userImports.importArchive({
        userId: rootId,
        fixture: 'export-without-files.zip',
        token,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an unknown user', async function () {
      await server.userImports.importArchive({
        userId: 404,
        fixture: 'export-without-files.zip',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail if user quota is exceeded', async function () {
      await server.users.update({ userId, videoQuota: 100 })

      await server.userImports.importArchive({
        userId,
        fixture: 'export-without-files.zip',
        expectedStatus: HttpStatusCode.PAYLOAD_TOO_LARGE_413
      })

      await server.users.update({ userId, videoQuota: -1 })
    })

    it('Should succeed with the correct params', async function () {
      await server.userImports.importArchive({ userId, fixture: 'export-without-files.zip' })

      await waitJobs([ server ])
    })

    it('Should fail with an import that is already being processed', async function () {
      await server.userImports.importArchive({ userId, fixture: 'export-without-files.zip' })
      await server.userImports.importArchive({
        userId,
        fixture: 'export-without-files.zip',
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should fail with invalid ZIPs', async function () {
      this.timeout(120000)

      const toTest = [
        'export-bad-video-file.zip',
        'export-bad-video.zip',
        'export-without-videos.zip',
        'export-bad-structure.zip',
        'export-bad-structure.zip'
      ]

      const tokens: string[] = []

      for (let i = 0; i < toTest.length; i++) {
        const { token, userId } = await server.users.generate('import' + i)
        await server.userImports.importArchive({ userId, token, fixture: toTest[i] })
      }

      await waitJobs([ server ])

      for (const token of tokens) {
        const { data } = await server.videos.listMyVideos({ token })
        expect(data).to.have.lengthOf(0)
      }
    })
  })

  describe('Get latest import status', function () {

    it('Should fail without token', async function () {
      await server.userImports.getLatestImport({ userId, token: null, expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with invalid token', async function () {
      await server.userImports.getLatestImport({ userId, token: 'invalid', expectedStatus: HttpStatusCode.UNAUTHORIZED_401 })
    })

    it('Should fail with an unknown user', async function () {
      await server.userImports.getLatestImport({ userId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with a token of another user', async function () {
      await server.userImports.getLatestImport({ userId: rootId, token, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct parameters', async function () {
      await server.userImports.getLatestImport({ userId, token })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
