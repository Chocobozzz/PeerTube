import * as request from 'supertest'

function createUser (url: string, accessToken: string, username: string, password: string, specialStatus = 204) {
  const path = '/api/v1/users'
  const body = {
    username,
    password,
    email: username + '@example.com'
  }

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .send(body)
          .expect(specialStatus)
}

function registerUser (url: string, username: string, password: string, specialStatus = 204) {
  const path = '/api/v1/users/register'
  const body = {
    username,
    password,
    email: username + '@example.com'
  }

  return request(url)
          .post(path)
          .set('Accept', 'application/json')
          .send(body)
          .expect(specialStatus)
}

function getUserInformation (url: string, accessToken: string) {
  const path = '/api/v1/users/me'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getUserVideoRating (url: string, accessToken: string, videoId: number) {
  const path = '/api/v1/users/me/videos/' + videoId + '/rating'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getUsersList (url: string) {
  const path = '/api/v1/users'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getUsersListPaginationAndSort (url: string, start: number, count: number, sort: string) {
  const path = '/api/v1/users'

  return request(url)
          .get(path)
          .query({ start })
          .query({ count })
          .query({ sort })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function removeUser (url: string, userId: number, accessToken: string, expectedStatus = 204) {
  const path = '/api/v1/users'

  return request(url)
          .delete(path + '/' + userId)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(expectedStatus)
}

function updateUser (url: string, userId: number, accessToken: string, newPassword: string, displayNSFW: boolean) {
  const path = '/api/v1/users/' + userId

  const toSend = {}
  if (newPassword !== undefined && newPassword !== null) toSend['password'] = newPassword
  if (displayNSFW !== undefined && displayNSFW !== null) toSend['displayNSFW'] = displayNSFW

  return request(url)
          .put(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .send(toSend)
          .expect(204)
}

// ---------------------------------------------------------------------------

export {
  createUser,
  registerUser,
  getUserInformation,
  getUserVideoRating,
  getUsersList,
  getUsersListPaginationAndSort,
  removeUser,
  updateUser
}
