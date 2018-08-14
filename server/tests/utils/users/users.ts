import * as request from 'supertest'
import { makePostBodyRequest, makePutBodyRequest, updateAvatarRequest } from '../'

import { UserRole } from '../../../../shared/index'
import { NSFWPolicyType } from '../../../../shared/models/videos/nsfw-policy.type'

function createUser (
  url: string,
  accessToken: string,
  username: string,
  password: string,
  videoQuota = 1000000,
  role: UserRole = UserRole.USER,
  specialStatus = 200
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

function getMyUserInformation (url: string, accessToken: string, specialStatus = 200) {
  const path = '/api/v1/users/me'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(specialStatus)
          .expect('Content-Type', /json/)
}

function deleteMe (url: string, accessToken: string, specialStatus = 204) {
  const path = '/api/v1/users/me'

  return request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(specialStatus)
}

function getMyUserVideoQuotaUsed (url: string, accessToken: string, specialStatus = 200) {
  const path = '/api/v1/users/me/video-quota-used'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(specialStatus)
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

function getMyUserVideoRating (url: string, accessToken: string, videoId: number | string, specialStatus = 200) {
  const path = '/api/v1/users/me/videos/' + videoId + '/rating'

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(specialStatus)
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

function removeUser (url: string, userId: number | string, accessToken: string, expectedStatus = 204) {
  const path = '/api/v1/users'

  return request(url)
          .delete(path + '/' + userId)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(expectedStatus)
}

function blockUser (url: string, userId: number | string, accessToken: string, expectedStatus = 204, reason?: string) {
  const path = '/api/v1/users'
  let body: any
  if (reason) body = { reason }

  return request(url)
    .post(path + '/' + userId + '/block')
    .send(body)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
}

function unblockUser (url: string, userId: number | string, accessToken: string, expectedStatus = 204) {
  const path = '/api/v1/users'

  return request(url)
    .post(path + '/' + userId + '/unblock')
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(expectedStatus)
}

function updateMyUser (options: {
  url: string
  accessToken: string,
  newPassword?: string,
  nsfwPolicy?: NSFWPolicyType,
  email?: string,
  autoPlayVideo?: boolean
  displayName?: string,
  description?: string
}) {
  const path = '/api/v1/users/me'

  const toSend = {}
  if (options.newPassword !== undefined && options.newPassword !== null) toSend['password'] = options.newPassword
  if (options.nsfwPolicy !== undefined && options.nsfwPolicy !== null) toSend['nsfwPolicy'] = options.nsfwPolicy
  if (options.autoPlayVideo !== undefined && options.autoPlayVideo !== null) toSend['autoPlayVideo'] = options.autoPlayVideo
  if (options.email !== undefined && options.email !== null) toSend['email'] = options.email
  if (options.description !== undefined && options.description !== null) toSend['description'] = options.description
  if (options.displayName !== undefined && options.displayName !== null) toSend['displayName'] = options.displayName

  return makePutBodyRequest({
    url: options.url,
    path,
    token: options.accessToken,
    fields: toSend,
    statusCodeExpected: 204
  })
}

function updateMyAvatar (options: {
  url: string,
  accessToken: string,
  fixture: string
}) {
  const path = '/api/v1/users/me/avatar/pick'

  return updateAvatarRequest(Object.assign(options, { path }))
}

function updateUser (options: {
  url: string
  userId: number,
  accessToken: string,
  email?: string,
  videoQuota?: number,
  role?: UserRole
}) {
  const path = '/api/v1/users/' + options.userId

  const toSend = {}
  if (options.email !== undefined && options.email !== null) toSend['email'] = options.email
  if (options.videoQuota !== undefined && options.videoQuota !== null) toSend['videoQuota'] = options.videoQuota
  if (options.role !== undefined && options.role !== null) toSend['role'] = options.role

  return makePutBodyRequest({
    url: options.url,
    path,
    token: options.accessToken,
    fields: toSend,
    statusCodeExpected: 204
  })
}

function askResetPassword (url: string, email: string) {
  const path = '/api/v1/users/ask-reset-password'

  return makePostBodyRequest({
    url,
    path,
    fields: { email },
    statusCodeExpected: 204
  })
}

function resetPassword (url: string, userId: number, verificationString: string, password: string, statusCodeExpected = 204) {
  const path = '/api/v1/users/' + userId + '/reset-password'

  return makePostBodyRequest({
    url,
    path,
    fields: { password, verificationString },
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  createUser,
  registerUser,
  getMyUserInformation,
  getMyUserVideoRating,
  deleteMe,
  getMyUserVideoQuotaUsed,
  getUsersList,
  getUsersListPaginationAndSort,
  removeUser,
  updateUser,
  updateMyUser,
  getUserInformation,
  blockUser,
  unblockUser,
  askResetPassword,
  resetPassword,
  updateMyAvatar
}
