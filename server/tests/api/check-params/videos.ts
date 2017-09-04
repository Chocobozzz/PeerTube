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
  makePostUploadRequest
} from '../../utils'

describe('Test videos API validator', function () {
  const path = '/api/v1/videos/'
  let server: ServerInfo

  // ---------------------------------------------------------------

  before(async function () {
    this.timeout(20000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])
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

  describe('When adding a video', function () {
    it('Should fail with nothing', async function () {
      const fields = {}
      const attaches = {}
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without name', async function () {
      const fields = {
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long name', async function () {
      const fields = {
        name: 'My very very very very very very very very very very very very very very very very long name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without a category', async function () {
      const fields = {
        name: 'my super name',
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad category', async function () {
      const fields = {
        name: 'my super name',
        category: 125,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without a licence', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad licence', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 125,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad language', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 4,
        language: 563,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without nsfw attribute', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 4,
        language: 6,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a bad nsfw attribue', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 4,
        language: 6,
        nsfw: 2,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without description', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a long description', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description which is very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very long',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with too many tags', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2', 'tag3', 'tag4' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 't' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'my_super_tag_too_long', 'tag1' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without an input file', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {}
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail without an incorrect input file', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short_fake.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should fail with a too big duration', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_too_long.webm')
      }
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches })
    })

    it('Should succeed with the correct parameters', async function () {
      this.timeout(10000)

      const fields = {
        name: 'my super name',
        category: 5,
        licence: 1,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      const attaches = {
        'videofile': join(__dirname, '..', 'fixtures', 'video_short.webm')
      }

      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches, statusCodeExpected: 204 })

      attaches.videofile = join(__dirname, '..', 'fixtures', 'video_short.mp4')
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches, statusCodeExpected: 204 })

      attaches.videofile = join(__dirname, '..', 'fixtures', 'video_short.ogv')
      await makePostUploadRequest({ url: server.url, path, token: server.accessToken, fields, attaches, statusCodeExpected: 204 })
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
      const fields = {
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + 'blabla', token: server.accessToken, fields })
    })

    it('Should fail with an unknown id', async function () {
      const fields = {
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({
        url: server.url,
        path: path + '4da6fde3-88f7-4d16-b119-108df5630b06',
        token: server.accessToken,
        fields,
        statusCodeExpected: 404
      })
    })

    it('Should fail with a long name', async function () {
      const fields = {
        name: 'My very very very very very very very very very very very very very very very very long name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad category', async function () {
      const fields = {
        name: 'my super name',
        category: 128,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad licence', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 128,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad language', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 3,
        language: 896,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a bad nsfw attribute', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 5,
        language: 6,
        nsfw: -4,
        description: 'my super description',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a long description', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description which is very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very very very very very very very' +
                     'very very very very very very very very very very very very very very very long',
        tags: [ 'tag1', 'tag2' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with too many tags', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 'tag2', 'tag3', 'tag4' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too low', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'tag1', 't' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a tag length too big', async function () {
      const fields = {
        name: 'my super name',
        category: 5,
        licence: 2,
        language: 6,
        nsfw: false,
        description: 'my super description',
        tags: [ 'my_super_tag_too_long', 'tag1' ]
      }
      await makePutBodyRequest({ url: server.url, path: path + videoId, token: server.accessToken, fields })
    })

    it('Should fail with a video of another user')

    it('Should fail with a video of another pod')
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

    it('Should fail with a video of another pod')

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
