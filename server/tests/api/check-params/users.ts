/* tslint:disable:no-unused-expression */

import { omit } from 'lodash'
import 'mocha'
import { join } from 'path'
import { UserRole } from '../../../../shared'

import {
  createUser, flushTests, getMyUserInformation, getMyUserVideoRating, getUsersList, immutableAssign, killallServers, makeGetRequest,
  makePostBodyRequest, makeUploadRequest, makePutBodyRequest, registerUser, removeUser, runServer, ServerInfo, setAccessTokensToServers,
  updateUser, uploadVideo, userLogin
} from '../../utils'
import { checkBadCountPagination, checkBadSortPagination, checkBadStartPagination } from '../../utils/requests/check-api-params'

describe('Test users API validators', function () {
  const path = '/api/v1/users/'
  let userId: number
  let rootId: number
  let videoId: number
  let server: ServerInfo
  let serverWithRegistrationDisabled: ServerInfo
  let userAccessToken = ''
  const user = {
    username: 'user1',
    password: 'my super password'
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)
    serverWithRegistrationDisabled = await runServer(2)

    await setAccessTokensToServers([ server ])

    const videoQuota = 42000000
    await createUser(server.url, server.accessToken, user.username, user.password, videoQuota)
    userAccessToken = await userLogin(server, user)

    const res = await uploadVideo(server.url, server.accessToken, {})
    videoId = res.body.video.id
  })

  describe('When listing users', function () {
    it('Should fail with a bad start pagination', async function () {
      await checkBadStartPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a bad count pagination', async function () {
      await checkBadCountPagination(server.url, path, server.accessToken)
    })

    it('Should fail with an incorrect sort', async function () {
      await checkBadSortPagination(server.url, path, server.accessToken)
    })

    it('Should fail with a non authenticated user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        statusCodeExpected: 401
      })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({
        url: server.url,
        path,
        token: userAccessToken,
        statusCodeExpected: 403
      })
    })
  })

  describe('When adding a new user', function () {
    const baseCorrectParams = {
      username: 'user2',
      email: 'test@example.com',
      password: 'my super password',
      videoQuota: -1,
      role: UserRole.USER
    }

    it('Should fail with a too small username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'fi' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'my_super_username_which_is_very_long' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a not lowercase username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'Toto' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'my username' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = omit(baseCorrectParams, 'email')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'test_example.com' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'bla' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'super'.repeat(61) })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: 'super token',
        fields: baseCorrectParams,
        statusCodeExpected: 401
      })
    })

    it('Should fail if we add a user with the same username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'user1' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should fail if we add a user with the same email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'user1@example.com' })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should fail without a videoQuota', async function () {
      const fields = omit(baseCorrectParams, 'videoQuota')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuota', async function () {
      const fields = immutableAssign(baseCorrectParams, { videoQuota: -5 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a user role', async function () {
      const fields = omit(baseCorrectParams, 'role')

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid user role', async function () {
      const fields = immutableAssign(baseCorrectParams, { role: 88989 })

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({
        url: server.url,
        path,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 200
      })
    })

    it('Should fail with a non admin user', async function () {
      const user = {
        username: 'user1',
        password: 'my super password'
      }
      userAccessToken = await userLogin(server, user)

      const fields = {
        username: 'user3',
        email: 'test@example.com',
        password: 'my super password',
        videoQuota: 42000000
      }
      await makePostBodyRequest({ url: server.url, path, token: userAccessToken, fields, statusCodeExpected: 403 })
    })
  })

  describe('When updating my account', function () {
    it('Should fail with an invalid email attribute', async function () {
      const fields = {
        email: 'blabla'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = {
        password: 'bla'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        password: 'super'.repeat(61)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid NSFW policy attribute', async function () {
      const fields = {
        nsfwPolicy: 'hello'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid autoPlayVideo attribute', async function () {
      const fields = {
        autoPlayVideo: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        password: 'my super password'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: 'super token', fields, statusCodeExpected: 401 })
    })

    it('Should fail with a too long description', async function () {
      const fields = {
        description: 'super'.repeat(60)
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        password: 'my super password',
        nsfwPolicy: 'blur',
        autoPlayVideo: false,
        email: 'super_email@example.com'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When updating my avatar', function () {
    it('Should fail without an incorrect input file', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', 'fixtures', 'video_short.mp4')
      }
      await makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a big file', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', 'fixtures', 'avatar-big.png')
      }
      await makeUploadRequest({ url: server.url, path: path + '/me/avatar/pick', token: server.accessToken, fields, attaches })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {}
      const attaches = {
        'avatarfile': join(__dirname, '..', 'fixtures', 'avatar.png')
      }
      await makeUploadRequest({
        url: server.url,
        path: path + '/me/avatar/pick',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 200
      })
    })
  })

  describe('When getting a user', function () {
    before(async function () {
      const res = await getUsersList(server.url, server.accessToken)

      userId = res.body.data[1].id
    })

    it('Should fail with an non authenticated user', async function () {
      await makeGetRequest({ url: server.url, path: path + userId, token: 'super token', statusCodeExpected: 401 })
    })

    it('Should fail with a non admin user', async function () {
      await makeGetRequest({ url: server.url, path, token: userAccessToken, statusCodeExpected: 403 })
    })

    it('Should succeed with the correct params', async function () {
      await makeGetRequest({ url: server.url, path: path + userId, token: server.accessToken, statusCodeExpected: 200 })
    })
  })

  describe('When updating a user', function () {

    before(async function () {
      const res = await getUsersList(server.url, server.accessToken)

      userId = res.body.data[1].id
      rootId = res.body.data[2].id
    })

    it('Should fail with an invalid email attribute', async function () {
      const fields = {
        email: 'blabla'
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuota attribute', async function () {
      const fields = {
        videoQuota: -90
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an invalid user role attribute', async function () {
      const fields = {
        role: 54878
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: 'super token', fields, statusCodeExpected: 401 })
    })

    it('Should fail when updating root role', async function () {
      const fields = {
        role: UserRole.MODERATOR
      }

      await makePutBodyRequest({ url: server.url, path: path + rootId, token: server.accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        email: 'email@example.com',
        videoQuota: 42,
        role: UserRole.MODERATOR
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields, statusCodeExpected: 204 })
      userAccessToken = await userLogin(server, user)
    })
  })

  describe('When getting my information', function () {
    it('Should fail with a non authenticated user', async function () {
      await getMyUserInformation(server.url, 'fake_token', 401)
    })

    it('Should success with the correct parameters', async function () {
      await getMyUserInformation(server.url, userAccessToken)
    })
  })

  describe('When getting my video rating', function () {
    it('Should fail with a non authenticated user', async function () {
      await getMyUserVideoRating(server.url, 'fake_token', videoId, 401)
    })

    it('Should fail with an incorrect video uuid', async function () {
      await getMyUserVideoRating(server.url, server.accessToken, 'blabla', 400)
    })

    it('Should fail with an unknown video', async function () {
      await getMyUserVideoRating(server.url, server.accessToken, '4da6fde3-88f7-4d16-b119-108df5630b06', 404)
    })

    it('Should succeed with the correct parameters', async function () {
      await getMyUserVideoRating(server.url, server.accessToken, videoId)
    })
  })

  describe('When removing an user', function () {
    it('Should fail with an incorrect id', async function () {
      await removeUser(server.url, 'blabla', server.accessToken, 400)
    })

    it('Should fail with the root user', async function () {
      await removeUser(server.url, rootId, server.accessToken, 400)
    })

    it('Should return 404 with a non existing id', async function () {
      await removeUser(server.url, 4545454, server.accessToken, 404)
    })
  })

  describe('When register a new user', function () {
    const registrationPath = path + '/register'
    const baseCorrectParams = {
      username: 'user3',
      email: 'test3@example.com',
      password: 'my super password'
    }

    it('Should fail with a too small username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'ji' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'my_super_username_which_is_very_long' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'my username' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = omit(baseCorrectParams, 'email')

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'test_example.com' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'bla' })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = immutableAssign(baseCorrectParams, { password: 'super'.repeat(61) })

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail if we register a user with the same username', async function () {
      const fields = immutableAssign(baseCorrectParams, { username: 'root' })

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        statusCodeExpected: 409
      })
    })

    it('Should fail if we register a user with the same email', async function () {
      const fields = immutableAssign(baseCorrectParams, { email: 'admin1@example.com' })

      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields,
        statusCodeExpected: 409
      })
    })

    it('Should succeed with the correct params', async function () {
      await makePostBodyRequest({
        url: server.url,
        path: registrationPath,
        token: server.accessToken,
        fields: baseCorrectParams,
        statusCodeExpected: 204
      })
    })

    it('Should fail on a server with registration disabled', async function () {
      const fields = {
        username: 'user4',
        email: 'test4@example.com',
        password: 'my super password 4'
      }

      await makePostBodyRequest({
        url: serverWithRegistrationDisabled.url,
        path: registrationPath,
        token: serverWithRegistrationDisabled.accessToken,
        fields,
        statusCodeExpected: 403
      })
    })
  })

  describe('When registering multiple users on a server with users limit', function () {
    it('Should fail when after 3 registrations', async function () {
      await registerUser(server.url, 'user42', 'super password', 403)
    })
  })

  describe('When having a video quota', function () {
    it('Should fail with a user having too many video', async function () {
      await updateUser({
        url: server.url,
        userId: rootId,
        accessToken: server.accessToken,
        videoQuota: 42
      })

      await uploadVideo(server.url, server.accessToken, {}, 403)
    })

    it('Should fail with a registered user having too many video', async function () {
      this.timeout(15000)

      const user = {
        username: 'user3',
        password: 'my super password'
      }
      userAccessToken = await userLogin(server, user)

      const videoAttributes = { fixture: 'video_short2.webm' }
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes, 403)
    })
  })

  describe('When asking a password reset', function () {
    const path = '/api/v1/users/ask-reset-password'

    it('Should fail with a missing email', async function () {
      const fields = {}

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = { email: 'hello' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should success with the correct params', async function () {
      const fields = { email: 'admin@example.com' }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  after(async function () {
    killallServers([ server, serverWithRegistrationDisabled ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
