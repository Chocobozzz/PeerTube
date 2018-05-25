import * as request from 'supertest'
import { VideoChannelCreate, VideoChannelUpdate } from '../../../../shared/models/videos'

function getVideoChannelsList (url: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/video-channels'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
            .expect(200)
            .expect('Content-Type', /json/)
}

function getAccountVideoChannelsList (url: string, accountName: string, specialStatus = 200) {
  const path = '/api/v1/accounts/' + accountName + '/video-channels'

  return request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(specialStatus)
    .expect('Content-Type', /json/)
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
  channelId: number | string,
  attributes: VideoChannelUpdate,
  expectedStatus = 204
) {
  const body = {}
  const path = '/api/v1/video-channels/' + channelId

  if (attributes.displayName) body['displayName'] = attributes.displayName
  if (attributes.description) body['description'] = attributes.description
  if (attributes.support) body['support'] = attributes.support

  return request(url)
    .put(path)
    .send(body)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function deleteVideoChannel (url: string, token: string, channelId: number | string, expectedStatus = 204) {
  const path = '/api/v1/video-channels/' + channelId

  return request(url)
    .delete(path)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function getVideoChannel (url: string, channelId: number | string) {
  const path = '/api/v1/video-channels/' + channelId

  return request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  getVideoChannelsList,
  getAccountVideoChannelsList,
  addVideoChannel,
  updateVideoChannel,
  deleteVideoChannel,
  getVideoChannel
}
