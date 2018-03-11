import * as request from 'supertest'

type VideoChannelAttributes = {
  name?: string
  description?: string
  support?: string
}

function getVideoChannelsList (url: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos/channels'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
            .expect(200)
            .expect('Content-Type', /json/)
}

function getAccountVideoChannelsList (url: string, accountId: number | string, specialStatus = 200) {
  const path = '/api/v1/videos/accounts/' + accountId + '/channels'

  return request(url)
    .get(path)
    .set('Accept', 'application/json')
    .expect(specialStatus)
    .expect('Content-Type', /json/)
}

function addVideoChannel (url: string, token: string, videoChannelAttributesArg: VideoChannelAttributes, expectedStatus = 200) {
  const path = '/api/v1/videos/channels'

  // Default attributes
  let attributes = {
    name: 'my super video channel',
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

function updateVideoChannel (url: string, token: string, channelId: number, attributes: VideoChannelAttributes, expectedStatus = 204) {
  const body = {}
  const path = '/api/v1/videos/channels/' + channelId

  if (attributes.name) body['name'] = attributes.name
  if (attributes.description) body['description'] = attributes.description
  if (attributes.support) body['support'] = attributes.support

  return request(url)
    .put(path)
    .send(body)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function deleteVideoChannel (url: string, token: string, channelId: number, expectedStatus = 204) {
  const path = '/api/v1/videos/channels/'

  return request(url)
    .delete(path + channelId)
    .set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + token)
    .expect(expectedStatus)
}

function getVideoChannel (url: string, channelId: number) {
  const path = '/api/v1/videos/channels/' + channelId

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
