'use strict'

const request = require('supertest')

const videosBlacklistsUtils = {
  addVideoToBlacklist
}

// ---------------------- Export functions --------------------

function addVideoToBlacklist (url, token, videoId, specialStatus, end) {
  if (!end) {
    end = specialStatus
    specialStatus = 204
  }

  const path = '/api/v1/videos/' + videoId + '/blacklist'

  request(url)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(specialStatus)
    .end(end)
}

// ---------------------------------------------------------------------------

module.exports = videosBlacklistsUtils
