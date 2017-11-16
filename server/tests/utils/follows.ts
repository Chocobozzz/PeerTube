import * as request from 'supertest'

import { wait } from './miscs'

function getFollowersListPaginationAndSort (url: string, start: number, count: number, sort: string) {
  const path = '/api/v1/servers/followers'

  return request(url)
    .get(path)
    .query({ start })
    .query({ count })
    .query({ sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function getFollowingListPaginationAndSort (url: string, start: number, count: number, sort: string) {
  const path = '/api/v1/servers/following'

  return request(url)
    .get(path)
    .query({ start })
    .query({ count })
    .query({ sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

async function follow (follower: string, following: string[], accessToken: string, expectedStatus = 204) {
  const path = '/api/v1/servers/follow'

  const res = await request(follower)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ 'hosts': following })
    .expect(expectedStatus)

  // Wait request propagation
  await wait(1000)

  return res
}

// ---------------------------------------------------------------------------

export {
  getFollowersListPaginationAndSort,
  getFollowingListPaginationAndSort,
  follow
}
