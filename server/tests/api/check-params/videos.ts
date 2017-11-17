/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import { join } from 'path'
import 'mocha'
import * as chai from 'chai'
const expect = chai.expect

import {
  ServerInfo,
  flushTests,
  runServer,
  getVideosList,
  makePutBodyRequest,
  setAccessTokensToServers,
  killallServers,
  makePostUploadRequest,
  getMyUserInformation,
  createUser,
  getUserAccessToken
} from '../../utils'
import { VideoPrivacy } from '../../../../shared/models/videos/video-privacy.enum'

describe('Test videos API validator', function () {
  const path = '/api/v1/videos/'
  let server: ServerInfo
  let channelId: number

  function getCompleteVideoUploadAttributes () {
    return {
      name: 'my super name',
      category: 5,
      licence: 1,
      language: 6,
      nsfw: false,
      description: 'my super description',
      tags: [ 'tag1', 'tag2' ],
      privacy: VideoPrivacy.PUBLIC,
      channelId
    }
  }

  function getCompleteVideoUpdateAttributes () {
    return {
      name: 'my super name',
      category: 5,
      licence: 2,
      language: 6,
      nsfw: false,
      description: 'my super description',
      privacy: VideoPrivacy.PUBLIC,
      tags: [ 'tag1', 'tag2' ]
    }
  }

  function getVideoUploadAttaches () {
    return {
      'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
    }
  }

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(20000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])

    const res = await getMyUserInformation(server.url, server.accessToken)
    channelId = res.body.videoChannels[0].id
  })

  describe('When listing a video', function () {
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

  describe('When searching a video', function () {
    it('Should fail with nothing', async function () {
      await request(server.url)
              .get(join(path, 'search'))
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
              .get(join(path, 'search', 'test'))
              .query({ start: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
              .get(join(path, 'search', 'test'))
              .query({ count: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
              .get(join(path, 'search', 'test'))
              .query({ sort: 'hello' })
              .set('Accept', 'application/json')
              .expect(400)
    })
  })

  describe('When listing my videos', function () {
    const path = '/api/v1/users/me/videos'

    it('Should fail with a bad start pagination', async function () {
      await request(server.url)
        .get(path)
        .set('Authorization', 'Bearer ' + server.accessToken)
        .query({ start: 'hello' })
        .set('Accept', 'application/json')
        .expect(400)
    })

    it('Should fail with a bad count pagination', async function () {
      await request(server.url)
        .get(path)
        .set('Authorization', 'Bearer ' + server.accessToken)
        .query({ count: 'hello' })
        .set('Accept', 'application/json')
        .expect(400)
    })

    it('Should fail with an incorrect sort', async function () {
      await request(server.url)
        .get(path)
        .set('Authorization', 'Bearer ' + server.accessToken)
        .query({ sort: 'hello' })
        .set('Accept', 'application/json')
        .expect(400)
    })
  })

  describe('When adding a video', function () {
    it('Should fail with nothing', async function () {
      const fields = {}
      const attaches = {}
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without name', async function () {
      const fields = getCompleteVideoUploadAttributes()
      delete fields.name

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long name', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.name = 'My very very very very very very very very very very very very very very very very very  ' +
                    'very very very very very very very very very very very very very very very very long long' +
                    'very very very very very very very very very very very very very very very very long name'

      const attaches = getVideoUploadAttaches
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without a category', async function () {
      const fields = getCompleteVideoUploadAttributes()
      delete fields.category

      const attaches = getVideoUploadAttaches
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad category', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.category = 125

      const attaches = getVideoUploadAttaches
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without a licence', async function () {
      const fields = getCompleteVideoUploadAttributes()
      delete fields.licence

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad licence', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.licence = 125

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad language', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.language = 563

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without nsfw attribute', async function () {
      const fields = getCompleteVideoUploadAttributes()
      delete fields.nsfw

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad nsfw attribute', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.nsfw = 2 as any

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without description', async function () {
      const fields = getCompleteVideoUploadAttributes()
      delete fields.description

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long description', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.description = 'my super description which is very very very very very very very very very very very very long'.repeat(35)

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without a channel', async function () {
      const fields = getCompleteVideoUploadAttributes()
      delete fields.channelId

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad channel', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.channelId = 545454

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with another user channel', async function () {
      const user = {
        username: 'fake',
        password: 'fake_password'
      }
      await createUser(server.url, server.accessToken, user.username, user.password)

      const accessTokenUser = await getUserAccessToken(server, user)
      const res = await getMyUserInformation(server.url, accessTokenUser)
      const customChannelId = res.body.videoChannels[0].id

      const fields = getCompleteVideoUploadAttributes()
      fields.channelId = customChannelId

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with too many tags', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.tags = [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ]

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.tags = [ 'tag1', 't' ]

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = getCompleteVideoUploadAttributes()
      fields.tags = [ 'my_super_tag_too_long_long_long_long_long_long', 'tag1' ]

      const attaches = getVideoUploadAttaches()
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without an input file', async function () {
      const fields = getCompleteVideoUploadAttributes()
      const attaches = {}
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail without an incorrect input file', async function () {
      const fields = getCompleteVideoUploadAttributes()
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should fail with a too big duration', async function () {
      const fields = getCompleteVideoUploadAttributes()
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_too_long.webm')
      }
      await makePostUploadRequest({ url: server.url, path: path + '/upload', token: server.accessToken, fields, attaches })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(10000)

      const fields = getCompleteVideoUploadAttributes()
      const attaches = getVideoUploadAttaches()

      await makePostUploadRequest({
        url: server.url,
        path: path + '/upload',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 204
      })

      attaches.videofile = join(__dirname, '..', 'fixtures', 'video_short.mp4')
      await makePostUploadRequest({
        url: server.url,
        path: path + '/upload',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 204
      })

      attaches.videofile = join(__dirname, '..', 'fixtures', 'video_short.ogv')
      await makePostUploadRequest({
        url: server.url,
        path: path + '/upload',
        token: server.accessToken,
        fields,
        attaches,
        statusCodeExpected: 204
      })
    })
  })

  describe('When updating a video', function () {
    let videoId

    before(async function () {
      const res = await getVideosList(server.url)
      videoId = res.body.data[0].id
    })

    it('Should fail with nothing', async function () {
      const fields = {}
      await makePutBodyRequest({ url: server.url, path, token: server.accessToken, fields })
    })

    it('Should fail without a valid uuid', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      await makePutBodyRequest({ url: server.url, path: path + 'blabla', token: server.accessToken, fields })
    })

    it('Should fail with an unknown id', async function () {
      const fields = getCompleteVideoUpdateAttributes()

      await makePutBodyRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06',
        token: server.accessToken,
        fields,
        statusCodeExpected: 404
      })
    })

    it('Should fail with a long name', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.name = 'My very very very very very very very very very very very very very very very very long'.repeat(3)

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad category', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.category = 128

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad licence', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.licence = 128

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad language', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.language = 896

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad nsfw attribute', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.nsfw = (-4 as any)

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.description = 'my super description which is very very very very very very very very very very very very very long'.repeat(35)

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with too many tags', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.tags = [ 'tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6' ]

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.tags = [ 'tag1', 't' ]

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = getCompleteVideoUpdateAttributes()
      fields.tags = [ 'my_super_tag_too_long_long_long_long', 'tag1' ]

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a video of another user')

    it('Should fail with a video of another server')

    it('Should succeed with the correct parameters', async function () {
      const fields = getCompleteVideoUpdateAttributes()

      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields, statusCodeExpected: 204 })
    })
  })

  describe('When getting a video', function () {
    it('Should return the list of the videos with nothing', async function () {
      const res = await request(server.url)
                          .get(path)
                          .set('Accept', 'application/json')
                          .expect(200)
                          .expect('Content-Type', /json/)

      expect(res.body.data).to.be.an('array')
      expect(res.body.data.length).to.equal(3)
    })

    it('Should fail without a correct uuid', async function () {
      await request(server.url)
              .get(path + 'coucou')
              .set('Accept', 'application/json')
              .expect(400)
    })

    it('Should return 404 with an incorrect video', async function () {
      await request(server.url)
              .get(path + '4da6fde3-88f7-4d16-b119-108df5630b06')
              .set('Accept', 'application/json')
              .expect(404)
    })

    it('Should succeed with the correct parameters')
  })

  describe('When rating a video', function () {
    let videoId

    before(async function () {
      const res = await getVideosList(server.url)
      videoId = res.body.data[0].id
    })

    it('Should fail without a valid uuid', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({ url: server.url, path: path + 'blabla/rate', token: server.accessToken, fields })
    })

    it('Should fail with an unknown id', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06/rate',
        token: server.accessToken,
        fields,
        statusCodeExpected: 404
      })
    })

    it('Should fail with a wrong rating', async function () {
      const fields = {
        rating: 'likes'
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId + '/rate', token: server.accessToken, fields })
    })

    it('Should succeed with the correct parameters', async function () {
      const fields = {
        rating: 'like'
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + videoId + '/rate',
        token: server.accessToken,
        fields,
        statusCodeExpected: 204
      })
    })
  })

  describe('When removing a video', function () {
    it('Should have 404 with nothing', async function () {
      await request(server.url)
              .delete(path)
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail without a correct uuid', async function () {
      await request(server.url)
              .delete(path + 'hello')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(400)
    })

    it('Should fail with a video which does not exist', async function () {
      await request(server.url)
              .delete(path + '4da6fde3-88f7-4d16-b119-108df5630b06')
              .set('Authorization', 'Bearer ' + server.accessToken)
              .expect(404)
    })

    it('Should fail with a video of another user')

    it('Should fail with a video of another server')

    it('Should succeed with the correct parameters')
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
