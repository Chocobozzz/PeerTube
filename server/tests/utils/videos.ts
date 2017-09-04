import * as request from 'supertest'
import { join, isAbsolute } from 'path'

import { makeGetRequest } from './requests'
import { readFilePromise } from './miscs'

type VideoAttributes = {
  name?: string
  category?: number
  licence?: number
  language?: number
  nsfw?: boolean
  description?: string
  tags?: string[]
  fixture?: string
}

function getVideoCategories (url: string) {
  const path = '/api/v1/videos/categories'

  return makeGetRequest(url, path)
}

function getVideoLicences (url: string) {
  const path = '/api/v1/videos/licences'

  return makeGetRequest(url, path)
}

function getVideoLanguages (url: string) {
  const path = '/api/v1/videos/languages'

  return makeGetRequest(url, path)
}

function getAllVideosListBy (url: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: 'createdAt' })
          .query({ start: 0 })
          .query({ count: 10000 })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideo (url: string, id: number | string) {
  const path = '/api/v1/videos/' + id

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideosList (url: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: 'name' })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getVideosListPagination (url: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos'

  const req = request(url)
              .get(path)
              .query({ start: start })
              .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
           .expect(200)
           .expect('Content-Type', /json/)
}

function getVideosListSort (url: string, sort: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: sort })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function removeVideo (url: string, token: string, id: number, expectedStatus = 204) {
  const path = '/api/v1/videos'

  return request(url)
          .delete(path + '/' + id)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(expectedStatus)
}

function searchVideo (url: string, search: string, field?: string) {
  const path = '/api/v1/videos'
  const req = request(url)
                .get(path + '/search/' + search)
                .set('Accept', 'application/json')

  if (field) req.query({ field })

  return req.expect(200)
            .expect('Content-Type', /json/)
}

function searchVideoWithPagination (url: string, search: string, field: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos'

  const req = request(url)
                .get(path + '/search/' + search)
                .query({ start })
                .query({ count })
                .query({ field })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
            .expect(200)
            .expect('Content-Type', /json/)
}

function searchVideoWithSort (url: string, search: string, sort: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path + '/search/' + search)
          .query({ sort })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

async function testVideoImage (url: string, imageName: string, imagePath: string) {
  // Don't test images if the node env is not set
  // Because we need a special ffmpeg version for this test
  if (process.env['NODE_TEST_IMAGE']) {
    const res = await request(url)
                        .get(imagePath)
                        .expect(200)

    const data = await readFilePromise(join(__dirname, '..', 'api', 'fixtures', imageName + '.jpg'))

    return data.equals(res.body)
  } else {
    console.log('Do not test images. Enable it by setting NODE_TEST_IMAGE env variable.')
    return true
  }
}

function uploadVideo (url: string, accessToken: string, videoAttributesArg: VideoAttributes, specialStatus = 204) {
  const path = '/api/v1/videos'

  // Default attributes
  let attributes = {
    name: 'my super video',
    category: 5,
    licence: 4,
    language: 3,
    nsfw: true,
    description: 'my super description',
    tags: [ 'tag' ],
    fixture: 'video_short.webm'
  }
  attributes = Object.assign(attributes, videoAttributesArg)

  const req = request(url)
              .post(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + accessToken)
              .field('name', attributes.name)
              .field('category', attributes.category.toString())
              .field('licence', attributes.licence.toString())
              .field('language', attributes.language.toString())
              .field('nsfw', JSON.stringify(attributes.nsfw))
              .field('description', attributes.description)

  for (let i = 0; i < attributes.tags.length; i++) {
    req.field('tags[' + i + ']', attributes.tags[i])
  }

  let filepath = ''
  if (isAbsolute(attributes.fixture)) {
    filepath = attributes.fixture
  } else {
    filepath = join(__dirname, '..', 'api', 'fixtures', attributes.fixture)
  }

  return req.attach('videofile', filepath)
            .expect(specialStatus)
}

function updateVideo (url: string, accessToken: string, id: number, attributes: VideoAttributes, specialStatus = 204) {
  const path = '/api/v1/videos/' + id
  const body = {}

  if (attributes.name) body['name'] = attributes.name
  if (attributes.category) body['category'] = attributes.category
  if (attributes.licence) body['licence'] = attributes.licence
  if (attributes.language) body['language'] = attributes.language
  if (attributes.nsfw) body['nsfw'] = attributes.nsfw
  if (attributes.description) body['description'] = attributes.description
  if (attributes.tags) body['tags'] = attributes.tags

  return request(url)
          .put(path)
          .send(body)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(specialStatus)
}

function rateVideo (url: string, accessToken: string, id: number, rating: string, specialStatus = 204) {
  const path = '/api/v1/videos/' + id + '/rate'

  return request(url)
          .put(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .send({ rating })
          .expect(specialStatus)
}

// ---------------------------------------------------------------------------

export {
  getVideoCategories,
  getVideoLicences,
  getVideoLanguages,
  getAllVideosListBy,
  getVideo,
  getVideosList,
  getVideosListPagination,
  getVideosListSort,
  removeVideo,
  searchVideo,
  searchVideoWithPagination,
  searchVideoWithSort,
  testVideoImage,
  uploadVideo,
  updateVideo,
  rateVideo
}
