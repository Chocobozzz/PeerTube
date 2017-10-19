import * as request from 'supertest'

import { wait } from './miscs'

function getFriendsList (url: string) {
  const path = '/api/v1/pods/'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getPodsListPaginationAndSort (url: string, start: number, count: number, sort: string) {
  const path = '/api/v1/pods/'

  return request(url)
    .get(path)
    .query({ start })
    .query({ count })
    .query({ sort })
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

async function makeFriends (url: string, accessToken: string, expectedStatus = 204) {
  // Which pod makes friends with which pod
  const friendsMatrix = {
    'http://localhost:9001': [
      'localhost:9002'
    ],
    'http://localhost:9002': [
      'localhost:9003'
    ],
    'http://localhost:9003': [
      'localhost:9001'
    ],
    'http://localhost:9004': [
      'localhost:9002'
    ],
    'http://localhost:9005': [
      'localhost:9001',
      'localhost:9004'
    ],
    'http://localhost:9006': [
      'localhost:9001',
      'localhost:9002',
      'localhost:9003'
    ]
  }
  const path = '/api/v1/pods/make-friends'

  // The first pod make friend with the third
  const res = await request(url)
                      .post(path)
                      .set('Accept', 'application/json')
                      .set('Authorization', 'Bearer ' + accessToken)
                      .send({ 'hosts': friendsMatrix[url] })
                      .expect(expectedStatus)

  // Wait request propagation
  await wait(1000)

  return res
}

async function quitFriends (url: string, accessToken: string, expectedStatus = 204) {
  const path = '/api/v1/pods/quit-friends'

  // The first pod make friend with the third
  const res = await request(url)
                      .get(path)
                      .set('Accept', 'application/json')
                      .set('Authorization', 'Bearer ' + accessToken)
                      .expect(expectedStatus)

  // Wait request propagation
  await wait(1000)

  return res
}

function quitOneFriend (url: string, accessToken: string, friendId: number, expectedStatus = 204) {
  const path = '/api/v1/pods/' + friendId

  return request(url)
          .delete(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(expectedStatus)
}

// ---------------------------------------------------------------------------

export {
  getFriendsList,
  makeFriends,
  quitFriends,
  quitOneFriend,
  getPodsListPaginationAndSort
}
