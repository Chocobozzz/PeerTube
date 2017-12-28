import * as request from 'supertest'

import { UserRole } from '../../../../shared/index'

function createUser (
  url: string,
  accessToken: string,
  username: string,
  password: string,
  videoQuota = 1000000,
  role: UserRole = UserRole.USER,
  specialStatus = 204
) {
  const path = '/api/v1/users'
  const body = {
    username,
    password,
    role,
    email: username + '@example.com',
    videoQuota
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

function getMyUserInformation (url: string, accessToken: string) {
  const path = '/api/v1/users/me'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getUserInformation (url: string, accessToken: string, userId: number) {
  const path = '/api/v1/users/' + userId

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

function getUsersList (url: string, accessToken: string) {
  const path = '/api/v1/users'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(200)
          .expect('Content-Type', /json/)
}

function getUsersListPaginationAndSort (url: string, accessToken: string, start: number, count: number, sort: string) {
  const path = '/api/v1/users'

  return request(url)
          .get(path)
          .query({ start })
          .query({ count })
          .query({ sort })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
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

function updateMyUser (url: string, accessToken: string, newPassword: string, displayNSFW?: boolean,
  email?: string, autoPlayVideo?: boolean) {
  const path = '/api/v1/users/me'

  const toSend = {}
  if (newPassword !== undefined && newPassword !== null) toSend['password'] = newPassword
  if (displayNSFW !== undefined && displayNSFW !== null) toSend['displayNSFW'] = displayNSFW
  if (autoPlayVideo !== undefined && autoPlayVideo !== null) toSend['autoPlayVideo'] = autoPlayVideo
  if (email !== undefined && email !== null) toSend['email'] = email

  return request(url)
    .put(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .send(toSend)
    .expect(204)
}

function updateUser (url: string, userId: number, accessToken: string, email: string, videoQuota: number, role: UserRole) {
  const path = '/api/v1/users/' + userId

  const toSend = {}
  if (email !== undefined && email !== null) toSend['email'] = email
  if (videoQuota !== undefined && videoQuota !== null) toSend['videoQuota'] = videoQuota
  if (role !== undefined && role !== null) toSend['role'] = role

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
  getMyUserInformation,
  getUserVideoRating,
  getUsersList,
  getUsersListPaginationAndSort,
  removeUser,
  updateUser,
  updateMyUser,
  getUserInformation
}
