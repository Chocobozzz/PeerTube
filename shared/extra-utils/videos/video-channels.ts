/* eslint-disable @typescript-eslint/no-floating-promises */

import * as request from 'supertest'
import { VideoChannelUpdate } from '../../models/videos/channel/video-channel-update.model'
import { VideoChannelCreate } from '../../models/videos/channel/video-channel-create.model'
import { makeDeleteRequest, makeGetRequest, updateImageRequest } from '../requests/requests'
import { ServerInfo } from '../server/servers'
import { MyUser, User } from '../../models/users/user.model'
import { getMyUserInformation } from '../users/users'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

function getVideoChannelsList (url: string, start: number, count: number, sort?: string, withStats?: boolean) {
  const path = '/api/v1/video-channels'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })
  if (withStats) req.query({ withStats })

  return req.set('Accept', 'application/json')
            .expect(HttpStatusCode.OK_200)
            .expect('Content-Type', /json/)
}

function getAccountVideoChannelsList (parameters: {
  url: string
  accountName: string
  start?: number
  count?: number
  sort?: string
  specialStatus?: HttpStatusCode
  withStats?: boolean
  search?: string
}) {
  const {
    url,
    accountName,
    start,
    count,
    sort = 'createdAt',
    specialStatus = HttpStatusCode.OK_200,
    withStats = false,
    search
  } = parameters

  const path = '/api/v1/accounts/' + accountName + '/video-channels'

  return makeGetRequest({
    url,
    path,
    query: {
      start,
      count,
      sort,
      withStats,
      search
    },
    statusCodeExpected: specialStatus
  })
}

function addVideoChannel (
  url: string,
  token: string,
  videoChannelAttributesArg: VideoChannelCreate,
  expectedStatus = HttpStatusCode.OK_200
) {
  const path = '/api/v1/video-channels/'

  // Default attributes
  let attributes = {
    displayName: 'my super video channel',
    description: 'my super channel description',
    support: 'my super channel support'
  }
  attributes = Object.assign(attributes, videoChannelAttributesArg)

  return request(url)
    .post(path)
    .send(attributes)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function updateVideoChannel (
  url: string,
  token: string,
  channelName: string,
  attributes: VideoChannelUpdate,
  expectedStatus = HttpStatusCode.NO_CONTENT_204
) {
  const body: any = {}
  const path = '/api/v1/video-channels/' + channelName

  if (attributes.displayName) body.displayName = attributes.displayName
  if (attributes.description) body.description = attributes.description
  if (attributes.support) body.support = attributes.support
  if (attributes.bulkVideosSupportUpdate) body.bulkVideosSupportUpdate = attributes.bulkVideosSupportUpdate

  return request(url)
    .put(path)
    .send(body)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function deleteVideoChannel (url: string, token: string, channelName: string, expectedStatus = HttpStatusCode.NO_CONTENT_204) {
  const path = '/api/v1/video-channels/' + channelName

  return request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function getVideoChannel (url: string, channelName: string) {
  const path = '/api/v1/video-channels/' + channelName

  return request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(HttpStatusCode.OK_200)
    .expect('Content-Type', /json/)
}

function updateVideoChannelImage (options: {
  url: string
  accessToken: string
  fixture: string
  videoChannelName: string | number
  type: 'avatar' | 'banner'
}) {
  const path = `/api/v1/video-channels/${options.videoChannelName}/${options.type}/pick`

  return updateImageRequest({ ...options, path, fieldname: options.type + 'file' })
}

function deleteVideoChannelImage (options: {
  url: string
  accessToken: string
  videoChannelName: string | number
  type: 'avatar' | 'banner'
}) {
  const path = `/api/v1/video-channels/${options.videoChannelName}/${options.type}`

  return makeDeleteRequest({
    url: options.url,
    token: options.accessToken,
    path,
    statusCodeExpected: 204
  })
}

function setDefaultVideoChannel (servers: ServerInfo[]) {
  const tasks: Promise<any>[] = []

  for (const server of servers) {
    const p = getMyUserInformation(server.url, server.accessToken)
      .then(res => { server.videoChannel = (res.body as User).videoChannels[0] })

    tasks.push(p)
  }

  return Promise.all(tasks)
}

async function getDefaultVideoChannel (url: string, token: string) {
  const res = await getMyUserInformation(url, token)

  return (res.body as MyUser).videoChannels[0].id
}

// ---------------------------------------------------------------------------

export {
  updateVideoChannelImage,
  getVideoChannelsList,
  getAccountVideoChannelsList,
  addVideoChannel,
  updateVideoChannel,
  deleteVideoChannel,
  getVideoChannel,
  setDefaultVideoChannel,
  deleteVideoChannelImage,
  getDefaultVideoChannel
}
