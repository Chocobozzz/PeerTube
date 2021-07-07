/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as request from 'supertest'
import { VideosSearchQuery } from '../../models/search'
import { immutableAssign } from '../miscs/miscs'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function searchVideo (url: string, search: string, sort = '-publishedAt') {
  const path = '/api/v1/search/videos'

  const query = { sort, search: search }
  const req = request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')

  return req.expect(HttpStatusCode.OK_200)
            .expect('Content-Type', /json/)
}

function searchVideoWithToken (url: string, search: string, token: string, query: { nsfw?: boolean } = {}) {
  const path = '/api/v1/search/videos'
  const req = request(url)
    .get(path)
    .set('Authorization', 'Bearer ' + token)
    .query(immutableAssign(query, { sort: '-publishedAt', search }))
    .set('Accept', 'application/json')

  return req.expect(HttpStatusCode.OK_200)
            .expect('Content-Type', /json/)
}

function searchVideoWithSort (url: string, search: string, sort: string) {
  const path = '/api/v1/search/videos'

  const query = { search, sort }

  return request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function advancedVideosSearch (url: string, options: VideosSearchQuery) {
  const path = '/api/v1/search/videos'

  return request(url)
    .get(path)
    .query(options)
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  searchVideo,
  advancedVideosSearch,
  searchVideoWithToken,
  searchVideoWithSort
}
