import * as request from 'supertest'
import { wait } from './miscs'
import { ServerInfo } from './servers'

function getFollowersListPaginationAndSort (url: string, start: number, count: number, sort: string) {
  const path = '/api/v1/server/followers'

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
  const path = '/api/v1/server/following'

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
  const path = '/api/v1/server/following'

  const followingHosts = following.map(f => f.replace(/^http:\/\//, ''))
  const res = await request(follower)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ 'hosts': followingHosts })
    .expect(expectedStatus)

  // Wait request propagation
  await wait(20000)

  return res
}

async function doubleFollow (server1: ServerInfo, server2: ServerInfo) {
  await Promise.all([
    follow(server1.url, [ server2.url ], server1.accessToken),
    follow(server2.url, [ server1.url ], server2.accessToken)
  ])

  return true
}

// ---------------------------------------------------------------------------

export {
  getFollowersListPaginationAndSort,
  getFollowingListPaginationAndSort,
  follow,
  doubleFollow
}
