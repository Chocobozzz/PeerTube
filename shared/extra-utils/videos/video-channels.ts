/* eslint-disable @typescript-eslint/no-floating-promises */

import * as request from 'supertest'
import { VideoChannelUpdate } from '../../models/videos/channel/video-channel-update.model'
import { VideoChannelCreate } from '../../models/videos/channel/video-channel-create.model'
import { makeGetRequest, updateAvatarRequest } from '../requests/requests'
import { ServerInfo } from '../server/servers'
import { User } from '../../models/users/user.model'
import { getMyUserInformation } from '../users/users'

function getVideoChannelsList (url: string, start: number, count: number, sort?: string, withStats?: boolean) {
  const path = '/api/v1/video-channels'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })
  if (withStats) req.query({ withStats })

  return req.set('Accept', 'application/json')
            .expect(200)
            .expect('Content-Type', /json/)
}

function getAccountVideoChannelsList (parameters: {
  url: string
  accountName: string
  start?: number
  count?: number
  sort?: string
  specialStatus?: number
  withStats?: boolean
  search?: string
}) {
  const { url, accountName, start, count, sort = 'createdAt', specialStatus = 200, withStats = false, search } = parameters

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
  expectedStatus = 200
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
  expectedStatus = 204
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

function deleteVideoChannel (url: string, token: string, channelName: string, expectedStatus = 204) {
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
    .expect(200)
    .expect('Content-Type', /json/)
}

function updateVideoChannelAvatar (options: {
  url: string
  accessToken: string
  fixture: string
  videoChannelName: string | number
}) {

  const path = '/api/v1/video-channels/' + options.videoChannelName + '/avatar/pick'

  return updateAvatarRequest(Object.assign(options, { path }))
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

// ---------------------------------------------------------------------------

export {
  updateVideoChannelAvatar,
  getVideoChannelsList,
  getAccountVideoChannelsList,
  addVideoChannel,
  updateVideoChannel,
  deleteVideoChannel,
  getVideoChannel,
  setDefaultVideoChannel
}
