import * as request from 'supertest'
import { ServerInfo } from './servers'
import { waitJobs } from './jobs'
import { makePostBodyRequest } from '../requests/requests'
import { ActivityPubActorType, FollowState } from '@shared/models'

function getFollowersListPaginationAndSort (options: {
  url: string
  start: number
  count: number
  sort: string
  search?: string
  actorType?: ActivityPubActorType
  state?: FollowState
}) {
  const { url, start, count, sort, search, state, actorType } = options
  const path = '/api/v1/server/followers'

  const query = {
    start,
    count,
    sort,
    search,
    state,
    actorType
  }

  return request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function acceptFollower (url: string, token: string, follower: string, statusCodeExpected = 204) {
  const path = '/api/v1/server/followers/' + follower + '/accept'

  return makePostBodyRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function rejectFollower (url: string, token: string, follower: string, statusCodeExpected = 204) {
  const path = '/api/v1/server/followers/' + follower + '/reject'

  return makePostBodyRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function getFollowingListPaginationAndSort (options: {
  url: string
  start: number
  count: number
  sort: string
  search?: string
  actorType?: ActivityPubActorType
  state?: FollowState
}) {
  const { url, start, count, sort, search, state, actorType } = options
  const path = '/api/v1/server/following'

  const query = {
    start,
    count,
    sort,
    search,
    state,
    actorType
  }

  return request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function follow (follower: string, following: string[], accessToken: string, expectedStatus = 204) {
  const path = '/api/v1/server/following'

  const followingHosts = following.map(f => f.replace(/^http:\/\//, ''))
  return request(follower)
    .post(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send({ hosts: followingHosts })
    .expect(expectedStatus)
}

async function unfollow (url: string, accessToken: string, target: ServerInfo, expectedStatus = 204) {
  const path = '/api/v1/server/following/' + target.host

  return request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
}

function removeFollower (url: string, accessToken: string, follower: ServerInfo, expectedStatus = 204) {
  const path = '/api/v1/server/followers/peertube@' + follower.host

  return request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
}

async function doubleFollow (server1: ServerInfo, server2: ServerInfo) {
  await Promise.all([
    follow(server1.url, [ server2.url ], server1.accessToken),
    follow(server2.url, [ server1.url ], server2.accessToken)
  ])

  // Wait request propagation
  await waitJobs([ server1, server2 ])

  return true
}

// ---------------------------------------------------------------------------

export {
  getFollowersListPaginationAndSort,
  getFollowingListPaginationAndSort,
  unfollow,
  removeFollower,
  follow,
  doubleFollow,
  acceptFollower,
  rejectFollower
}
