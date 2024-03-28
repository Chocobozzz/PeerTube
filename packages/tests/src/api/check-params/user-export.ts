/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  makeRawRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'

describe('Test user export API validators', function () {
  let server: PeerTubeServer
  let rootId: number

  let userId: number
  let userToken: string

  let exportId: number
  let userExportId: number

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    {
      const user = await server.users.getMyInfo()
      rootId = user.id
    }

    {
      userToken = await server.users.generateUserAndToken('user')
      const user = await server.users.getMyInfo({ token: userToken })
      userId = user.id
    }
  })

  describe('Request export', function () {

    it('Should fail if export is disabled', async function () {
      await server.config.disableUserExport()

      await server.userExports.request({ userId: rootId, withVideoFiles: false, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await server.config.enableUserExport()
    })

    it('Should fail without token', async function () {
      await server.userExports.request({
        userId: rootId,
        withVideoFiles: false,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with invalid token', async function () {
      await server.userExports.request({
        userId: rootId,
        withVideoFiles: false,
        token: 'hello',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a token of another user', async function () {
      await server.userExports.request({
        userId: rootId,
        withVideoFiles: false,
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an unknown user', async function () {
      await server.userExports.request({ userId: 404, withVideoFiles: false, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail if user quota is too big', async function () {
      const { videoQuotaUsed } = await server.users.getMyQuotaUsed()

      await server.config.updateExistingConfig({
        newConfig: {
          export: {
            users: { maxUserVideoQuota: videoQuotaUsed - 1 }
          }
        }
      })

      await server.userExports.request({ userId: rootId, withVideoFiles: true, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      await server.userExports.request({ userId: rootId, withVideoFiles: false, expectedStatus: HttpStatusCode.OK_200 })

      // Cleanup
      await server.userExports.waitForCreation({ userId: rootId })
      await server.userExports.deleteAllArchives({ userId: rootId })

      await server.config.updateExistingConfig({
        newConfig: {
          export: {
            users: { maxUserVideoQuota: 1000 * 1000 * 1000 * 1000 }
          }
        }
      })
    })

    it('Should succeed with the appropriate token', async function () {
      const { export: { id } } = await server.userExports.request({ userId: rootId, withVideoFiles: false })

      exportId = id
    })

    it('Should fail if there is already an export', async function () {
      await server.userExports.request({
        userId: rootId,
        withVideoFiles: false,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should succeed after a delete with an admin token', async function () {
      await server.userExports.waitForCreation({ userId: rootId })
      await server.userExports.delete({ userId: rootId, exportId })

      const { export: { id } } = await server.userExports.request({ userId: rootId, withVideoFiles: false })
      exportId = id
    })
  })

  describe('List exports', function () {

    it('Should fail if export is disabled', async function () {
      await server.config.disableUserExport()

      await server.userExports.list({ userId: rootId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await server.config.enableUserExport()
    })

    it('Should fail without token', async function () {
      await server.userExports.list({
        userId: rootId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with invalid token', async function () {
      await server.userExports.list({
        userId: rootId,
        token: 'toto',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a token of another user', async function () {
      await server.userExports.list({
        userId: rootId,
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an unknown user', async function () {
      await server.userExports.list({ userId: 404, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should succeed with the correct parameters', async function () {
      // User token
      await server.userExports.list({ userId, token: userToken })
      // Root token
      await server.userExports.list({ userId })
    })
  })

  describe('Deleting export', function () {

    before(async function () {
      const { export: { id } } = await server.userExports.request({ userId, withVideoFiles: true })
      userExportId = id

      await server.userExports.waitForCreation({ userId })
    })

    it('Should fail if export is disabled', async function () {
      await server.config.disableUserExport()

      await server.userExports.delete({ userId, exportId: userExportId, token: userToken, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })

      await server.config.enableUserExport()
    })

    it('Should fail without token', async function () {
      await server.userExports.delete({
        userId: rootId,
        exportId,
        token: null,
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with invalid token', async function () {
      await server.userExports.delete({
        userId: rootId,
        exportId,
        token: 'toto',
        expectedStatus: HttpStatusCode.UNAUTHORIZED_401
      })
    })

    it('Should fail with a token of another user', async function () {
      await server.userExports.delete({
        userId: rootId,
        exportId,
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an export id of another user', async function () {
      await server.userExports.delete({
        userId,
        exportId,
        token: userToken,
        expectedStatus: HttpStatusCode.FORBIDDEN_403
      })
    })

    it('Should fail with an unknown user', async function () {
      await server.userExports.delete({
        userId: 404,
        exportId,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should fail with an unknown export id', async function () {
      await server.userExports.delete({
        userId,
        exportId: 404,
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should succeed with the correct parameters', async function () {
      await server.userExports.delete({
        userId,
        exportId: userExportId,
        token: userToken
      })
    })
  })

  describe('Downloading an export', function () {

    before(async function () {
      await server.userExports.request({ userId, withVideoFiles: true })
      await server.userExports.waitForCreation({ userId })
    })

    it('Should fail without jwt token', async function () {
      const { data } = await server.userExports.list({ userId })

      const url = data[0].privateDownloadUrl.replace('jwt=', 'toto=')
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
    })

    it('Should fail with a wrong jwt token', async function () {
      const { data } = await server.userExports.list({ userId })

      // Invalid format
      {
        const url = data[0].privateDownloadUrl.replace('jwt=', 'jwt=hello.coucou')
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }

      // Invalid content
      {
        const url = data[0].privateDownloadUrl.replace('jwt=', 'jwt=a')
        await makeRawRequest({ url, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should fail with a jwt token of another export', async function () {
      let userQuery: string

      // Save user JWT token
      {
        const { data } = await server.userExports.list({ userId })

        const { pathname, search } = new URL(data[0].privateDownloadUrl)
        const rawQuery = search.replace('?', '')
        userQuery = rawQuery

        await makeGetRequest({ url: server.url, path: pathname, rawQuery, expectedStatus: HttpStatusCode.OK_200 })
      }

      // This user JWT token must not be used to download an export of another user
      {
        const { data } = await server.userExports.list({ userId: rootId })

        const { pathname, search } = new URL(data[0].privateDownloadUrl)
        const rawQuery = search.replace('?', '')

        await makeGetRequest({ url: server.url, path: pathname, rawQuery, expectedStatus: HttpStatusCode.OK_200 })
        await makeGetRequest({ url: server.url, path: pathname, rawQuery: userQuery, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      }
    })

    it('Should fail with an invalid filename', async function () {
      const { data } = await server.userExports.list({ userId })

      const url = data[0].privateDownloadUrl.replace('.zip', '.tar')
      await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fail with an expired JWT token', async function () {
      const { data } = await server.userExports.list({ userId })

      await wait(3000)
      await makeRawRequest({ url: data[0].privateDownloadUrl, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
    })

    it('Should succeed with the correct params', async function () {
      const { data } = await server.userExports.list({ userId })
      await makeRawRequest({ url: data[0].privateDownloadUrl, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
