'use strict'

const fs = require('fs')
const pathUtils = require('path')
const request = require('supertest')

const videosUtils = {
  getVideoCategories,
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

// ---------------------- Export functions --------------------

function getVideoCategories (url, end) {
  const path = '/api/v1/videos/categories'

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getAllVideosListBy (url, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ sort: 'createdAt' })
    .query({ start: 0 })
    .query({ count: 10000 })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideo (url, id, end) {
  const path = '/api/v1/videos/' + id

  request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideosList (url, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ sort: 'name' })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function getVideosListPagination (url, start, count, sort, end) {
  if (!end) {
    end = sort
    sort = null
  }

  const path = '/api/v1/videos'

  const req = request(url)
              .get(path)
              .query({ start: start })
              .query({ count: count })

  if (sort) req.query({ sort })

  req.set('Accept', 'application/json')
     .expect(200)
     .expect('Content-Type', /json/)
     .end(end)
}

function getVideosListSort (url, sort, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path)
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function removeVideo (url, token, id, expectedStatus, end) {
  if (!end) {
    end = expectedStatus
    expectedStatus = 204
  }

  const path = '/api/v1/videos'

  request(url)
    .delete(path + '/' + id)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
    .end(end)
}

function searchVideo (url, search, field, end) {
  if (!end) {
    end = field
    field = null
  }

  const path = '/api/v1/videos'
  const req = request(url)
              .get(path + '/search/' + search)
              .set('Accept', 'application/json')

  if (field) req.query({ field: field })
  req.expect(200)
     .expect('Content-Type', /json/)
     .end(end)
}

function searchVideoWithPagination (url, search, field, start, count, sort, end) {
  if (!end) {
    end = sort
    sort = null
  }

  const path = '/api/v1/videos'

  const req = request(url)
              .get(path + '/search/' + search)
              .query({ start: start })
              .query({ count: count })
              .query({ field: field })

  if (sort) req.query({ sort })

  req.set('Accept', 'application/json')
     .expect(200)
     .expect('Content-Type', /json/)
     .end(end)
}

function searchVideoWithSort (url, search, sort, end) {
  const path = '/api/v1/videos'

  request(url)
    .get(path + '/search/' + search)
    .query({ sort: sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
    .end(end)
}

function testVideoImage (url, videoName, imagePath, callback) {
  // Don't test images if the node env is not set
  // Because we need a special ffmpeg version for this test
  if (process.env.NODE_TEST_IMAGE) {
    request(url)
      .get(imagePath)
      .expect(200)
      .end(function (err, res) {
        if (err) return callback(err)

        fs.readFile(pathUtils.join(__dirname, '..', 'api', 'fixtures', videoName + '.jpg'), function (err, data) {
          if (err) return callback(err)

          callback(null, data.equals(res.body))
        })
      })
  } else {
    console.log('Do not test images. Enable it by setting NODE_TEST_IMAGE env variable.')
    callback(null, true)
  }
}

function uploadVideo (url, accessToken, name, category, description, tags, fixture, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/videos'

  const req = request(url)
              .post(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + accessToken)
              .field('name', name)
              .field('category', category)
              .field('description', description)

  for (let i = 0; i < tags.length; i++) {
    req.field('tags[' + i + ']', tags[i])
  }

  let filepath = ''
  if (pathUtils.isAbsolute(fixture)) {
    filepath = fixture
  } else {
    filepath = pathUtils.join(__dirname, '..', 'api', 'fixtures', fixture)
  }

  req.attach('videofile', filepath)
     .expect(specialStatus)
     .end(end)
}

function updateVideo (url, accessToken, id, name, category, description, tags, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/videos/' + id

  const req = request(url)
              .put(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + accessToken)

  if (name) req.field('name', name)
  if (category) req.field('category', category)
  if (description) req.field('description', description)

  if (tags) {
    for (let i = 0; i < tags.length; i++) {
      req.field('tags[' + i + ']', tags[i])
    }
  }

  req.expect(specialStatus).end(end)
}

function rateVideo (url, accessToken, id, rating, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/videos/' + id + '/rate'

  request(url)
    .put(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ rating })
    .expect(specialStatus)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = videosUtils
