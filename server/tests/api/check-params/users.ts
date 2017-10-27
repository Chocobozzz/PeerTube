/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import 'mocha'

import {
  ServerInfo,
  flushTests,
  runServer,
  uploadVideo,
  getVideosList,
  makePutBodyRequest,
  createUser,
  loginAndGetAccessToken,
  getUsersList,
  registerUser,
  setAccessTokensToServers,
  killallServers,
  makePostBodyRequest,
  getUserAccessToken
} from '../../utils'
import { UserRole } from '../../../../shared'

describe('Test users API validators', function () {
  const path = '/api/v1/users/'
  let userId: number
  let rootId: number
  let videoId: number
  let server: ServerInfo
  let serverWithRegistrationDisabled: ServerInfo
  let userAccessToken = ''

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(120000)

    await flushTests()

    server = await runServer(1)
    serverWithRegistrationDisabled = await runServer(2)

    await setAccessTokensToServers([ server ])

    const username = 'user1'
    const password = 'my super password'
    const videoQuota = 42000000
    await createUser(server.url, server.accessToken, username, password, videoQuota)

    const videoAttributes = {}
    await uploadVideo(server.url, server.accessToken, videoAttributes)

    const res = await getVideosList(server.url)
    const videos = res.body.data
    videoId = videos[0].id

    const user = {
      username: 'user1',
      password: 'my super password'
    }
    userAccessToken = await getUserAccessToken(server, user)
  })

  describe('When listing users', function () {
    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ start: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
              .get(path)
              .query({ count: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
              .get(path)
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })
  })

  describe('When adding a new user', function () {
    it('Should fail with a too small username', async function () {
      const fields = {
        username: 'ji',
        email: 'test@example.com',
        password: 'my_super_password',
        role: UserRole.USER,
        videoQuota: 42000000
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = {
        username: 'my_super_username_which_is_very_long',
        email: 'test@example.com',
        password: 'my_super_password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = {
        username: 'my username',
        email: 'test@example.com',
        password: 'my_super_password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = {
        username: 'ji',
        password: 'my_super_password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = {
        username: 'my_super_username_which_is_very_long',
        email: 'test_example.com',
        password: 'my_super_password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = {
        username: 'my_username',
        email: 'test@example.com',
        password: 'bla',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        username: 'my_username',
        email: 'test@example.com',
        password: 'my super long password which is very very very very very very very very very very very very very very' +
                  'very very very very very very very very very very very very very very very veryv very very very very' +
                  'very very very very very very very very very very very very very very very very very very very very long',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        username: 'my_username',
        email: 'test@example.com',
        password: 'my super password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: 'super token', fields, statusCodeExpected: 401 })
    })

    it('Should fail if we add a user with the same username', async function () {
      const fields = {
        username: 'user1',
        email: 'test@example.com',
        password: 'my super password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should fail if we add a user with the same email', async function () {
      const fields = {
        username: 'my_username',
        email: 'user1@example.com',
        password: 'my super password',
        videoQuota: 42000000,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should fail without a videoQuota', async function () {
      const fields = {
        username: 'my_username',
        email: 'user1@example.com',
        password: 'my super password',
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid videoQuota', async function () {
      const fields = {
        username: 'my_username',
        email: 'user1@example.com',
        password: 'my super password',
        videoQuota: -5,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a user role', async function () {
      const fields = {
        username: 'my_username',
        email: 'user1@example.com',
        password: 'my super password',
        videoQuota: 0
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail with an invalid user role', async function () {
      const fields = {
        username: 'my_username',
        email: 'user1@example.com',
        password: 'my super password',
        videoQuota: 0,
        role: 88989
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        username: 'user2',
        email: 'test@example.com',
        password: 'my super password',
        videoQuota: -1,
        role: UserRole.USER
      }

      await makePostBodyRequest({ url: server.url, path, token: server.accessToken, fields, statusCodeExpected: 204 })
    })

    it('Should fail with a non admin user', async function () {
      server.user = {
        username: 'user1',
        email: 'test@example.com',
        password: 'my super password'
      }

      userAccessToken = await loginAndGetAccessToken(server)
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
        password: 'my super long password which is very very very very very very very very very very very very very very' +
                  'very very very very very very very very very very very very very very very veryv very very very very' +
                  'very very very very very very very very very very very very very very very very very very very very long'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an invalid display NSFW attribute', async function () {
      const fields = {
        displayNSFW: -1
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields })
    })

    it('Should fail with an non authenticated user', async function () {
      const fields = {
        password: 'my super password'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: 'super token', fields, statusCodeExpected: 401 })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        password: 'my super password',
        displayNSFW: true,
        email: 'super_email@example.com'
      }

      await makePutBodyRequest({ url: server.url, path: path + 'me', token: userAccessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When updating a user', function () {

    before(async function () {
      const res = await getUsersList(server.url)

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

    it('Should succeed with the correct params', async function () {
      const fields = {
        email: 'email@example.com',
        videoQuota: 42,
        role: UserRole.MODERATOR
      }

      await makePutBodyRequest({ url: server.url, path: path + userId, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When getting my information', function () {
    it('Should fail with a non authenticated user', async function () {
      await request(server.url)
              .get(path + 'me')
              .set('Authorization', 'Bearer fake_token')
              .set('Accept', 'application/json')
              .expect(401)
    })

    it('Should success with the correct parameters', async function () {
      await request(server.url)
              .get(path + 'me')
              .set('Authorization', 'Bearer ' + userAccessToken)
              .set('Accept', 'application/json')
              .expect(200)
    })
  })

  describe('When getting my video rating', function () {
    it('Should fail with a non authenticated user', async function () {
      await request(server.url)
              .get(path + 'me/videos/' + videoId + '/rating')
              .set('Authorization', 'Bearer fake_token')
              .set('Accept', 'application/json')
              .expect(401)
    })

    it('Should fail with an incorrect video uuid', async function () {
      await request(server.url)
              .get(path + 'me/videos/blabla/rating')
              .set('Authorization', 'Bearer ' + userAccessToken)
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with an unknown video', async function () {
      await request(server.url)
              .get(path + 'me/videos/4da6fde3-88f7-4d16-b119-108df5630b06/rating')
              .set('Authorization', 'Bearer ' + userAccessToken)
              .set('Accept', 'application/json')
              .expect(404)
    })

    it('Should success with the correct parameters', async function () {
      await request(server.url)
              .get(path + 'me/videos/' + videoId + '/rating')
              .set('Authorization', 'Bearer ' + userAccessToken)
              .set('Accept', 'application/json')
              .expect(200)
    })
  })

  describe('When removing an user', function () {
    it('Should fail with an incorrect id', async function () {
      await request(server.url)
              .delete(path + 'bla-bla')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with the root user', async function () {
      await request(server.url)
              .delete(path + rootId)
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should return 404 with a non existing id', async function () {
      await request(server.url)
              .delete(path + '45')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(404)
    })
  })

  describe('When removing an user', function () {
    it('Should fail with an incorrect id', async function () {
      await request(server.url)
              .delete(path + 'bla-bla')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with the root user', async function () {
      await request(server.url)
              .delete(path + rootId)
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should return 404 with a non existing id', async function () {
      await request(server.url)
              .delete(path + '45')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(404)
    })
  })

  describe('When register a new user', function () {
    const registrationPath = path + '/register'

    it('Should fail with a too small username', async function () {
      const fields = {
        username: 'ji',
        email: 'test@example.com',
        password: 'my_super_password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long username', async function () {
      const fields = {
        username: 'my_super_username_which_is_very_long',
        email: 'test@example.com',
        password: 'my_super_password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an incorrect username', async function () {
      const fields = {
        username: 'my username',
        email: 'test@example.com',
        password: 'my_super_password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a missing email', async function () {
      const fields = {
        username: 'ji',
        password: 'my_super_password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with an invalid email', async function () {
      const fields = {
        username: 'my_super_username_which_is_very_long',
        email: 'test_example.com',
        password: 'my_super_password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too small password', async function () {
      const fields = {
        username: 'my_username',
        email: 'test@example.com',
        password: 'bla'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail with a too long password', async function () {
      const fields = {
        username: 'my_username',
        email: 'test@example.com',
        password: 'my super long password which is very very very very very very very very very very very very very very' +
                  'very very very very very very very very very very very very very very very veryv very very very very' +
                  'very very very very very very very very very very very very very very very very very very very very long'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields })
    })

    it('Should fail if we register a user with the same username', async function () {
      const fields = {
        username: 'root',
        email: 'test@example.com',
        password: 'my super password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should fail if we register a user with the same email', async function () {
      const fields = {
        username: 'my_username',
        email: 'admin1@example.com',
        password: 'my super password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields, statusCodeExpected: 409 })
    })

    it('Should succeed with the correct params', async function () {
      const fields = {
        username: 'user3',
        email: 'test3@example.com',
        password: 'my super password'
      }

      await makePostBodyRequest({ url: server.url, path: registrationPath, token: server.accessToken, fields, statusCodeExpected: 204 })
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
      const fields = {
        videoQuota: 42
      }

      await makePutBodyRequest({ url: server.url, path: path + rootId, token: server.accessToken, fields, statusCodeExpected: 204 })

      const videoAttributes = {}
      await uploadVideo(server.url, server.accessToken, videoAttributes, 403)
    })

    it('Should fail with a registered user having too many video', async function () {
      this.timeout(10000)

      server.user = {
        username: 'user3',
        email: 'test3@example.com',
        password: 'my super password'
      }
      userAccessToken = await loginAndGetAccessToken(server)

      const videoAttributes = { fixture: 'video_short2.webm' }
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes)
      await uploadVideo(server.url, userAccessToken, videoAttributes, 403)
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
