/* tslint:disable:no-unused-expression */

import { expect } from 'chai'
import { existsSync, readFile } from 'fs'
import * as parseTorrent from 'parse-torrent'
import { extname, isAbsolute, join } from 'path'
import * as request from 'supertest'
import { getMyUserInformation, makeGetRequest, root, ServerInfo, testImage } from '../'
import { VideoPrivacy } from '../../../../shared/models/videos'
import { readdirPromise } from '../../../helpers/core-utils'
import { VIDEO_CATEGORIES, VIDEO_LANGUAGES, VIDEO_LICENCES, VIDEO_PRIVACIES } from '../../../initializers'
import { dateIsValid, webtorrentAdd } from '../index'

type VideoAttributes = {
  name?: string
  category?: number
  licence?: number
  language?: number
  nsfw?: boolean
  commentsEnabled?: boolean
  description?: string
  tags?: string[]
  channelId?: number
  privacy?: VideoPrivacy
  fixture?: string
}

function getVideoCategories (url: string) {
  const path = '/api/v1/videos/categories'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideoLicences (url: string) {
  const path = '/api/v1/videos/licences'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideoLanguages (url: string) {
  const path = '/api/v1/videos/languages'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideoPrivacies (url: string) {
  const path = '/api/v1/videos/privacies'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getVideo (url: string, id: number | string, expectedStatus = 200) {
  const path = '/api/v1/videos/' + id

  return request(url)
          .get(path)
          .set('Accept', 'application/json')
          .expect(expectedStatus)
}

function viewVideo (url: string, id: number | string, expectedStatus = 204) {
  const path = '/api/v1/videos/' + id + '/views'

  return request(url)
    .post(path)
    .set('Accept', 'application/json')
    .expect(expectedStatus)
}

function getVideoWithToken (url: string, token: string, id: number | string, expectedStatus = 200) {
  const path = '/api/v1/videos/' + id

  return request(url)
    .get(path)
    .set('Authorization', 'Bearer ' + token)
    .set('Accept', 'application/json')
    .expect(expectedStatus)
}

function getVideoDescription (url: string, descriptionPath: string) {
  return request(url)
    .get(descriptionPath)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function getVideosList (url: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: 'name' })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function getMyVideos (url: string, accessToken: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/users/me/videos'

  const req = request(url)
    .get(path)
    .query({ start: start })
    .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
    .set('Authorization', 'Bearer ' + accessToken)
    .expect(200)
    .expect('Content-Type', /json/)
}

function getVideosListPagination (url: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos'

  const req = request(url)
              .get(path)
              .query({ start: start })
              .query({ count: count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
           .expect(200)
           .expect('Content-Type', /json/)
}

function getVideosListSort (url: string, sort: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path)
          .query({ sort: sort })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

function removeVideo (url: string, token: string, id: number | string, expectedStatus = 204) {
  const path = '/api/v1/videos'

  return request(url)
          .delete(path + '/' + id)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + token)
          .expect(expectedStatus)
}

function searchVideo (url: string, search: string) {
  const path = '/api/v1/videos'
  const req = request(url)
    .get(path + '/search')
    .query({ search })
    .set('Accept', 'application/json')

  return req.expect(200)
    .expect('Content-Type', /json/)
}

function searchVideoWithPagination (url: string, search: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/videos'

  const req = request(url)
                .get(path + '/search')
                .query({ start })
                .query({ search })
                .query({ count })

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
            .expect(200)
            .expect('Content-Type', /json/)
}

function searchVideoWithSort (url: string, search: string, sort: string) {
  const path = '/api/v1/videos'

  return request(url)
          .get(path + '/search')
          .query({ search })
          .query({ sort })
          .set('Accept', 'application/json')
          .expect(200)
          .expect('Content-Type', /json/)
}

async function checkVideoFilesWereRemoved (videoUUID: string, serverNumber: number) {
  const testDirectory = 'test' + serverNumber

  for (const directory of [ 'videos', 'thumbnails', 'torrents', 'previews' ]) {
    const directoryPath = join(root(), testDirectory, directory)

    const directoryExists = existsSync(directoryPath)
    expect(directoryExists).to.be.true

    const files = await readdirPromise(directoryPath)
    for (const file of files) {
      expect(file).to.not.contain(videoUUID)
    }
  }
}

async function uploadVideo (url: string, accessToken: string, videoAttributesArg: VideoAttributes, specialStatus = 200) {
  const path = '/api/v1/videos/upload'
  let defaultChannelId = '1'

  try {
    const res = await getMyUserInformation(url, accessToken)
    defaultChannelId = res.body.videoChannels[0].id
  } catch (e) { /* empty */ }

  // Default attributes
  let attributes = {
    name: 'my super video',
    category: 5,
    licence: 4,
    language: 3,
    channelId: defaultChannelId,
    nsfw: true,
    description: 'my super description',
    tags: [ 'tag' ],
    privacy: VideoPrivacy.PUBLIC,
    commentsEnabled: true,
    fixture: 'video_short.webm'
  }
  attributes = Object.assign(attributes, videoAttributesArg)

  const req = request(url)
              .post(path)
              .set('Accept', 'application/json')
              .set('Authorization', 'Bearer ' + accessToken)
              .field('name', attributes.name)
              .field('category', attributes.category.toString())
              .field('licence', attributes.licence.toString())
              .field('nsfw', JSON.stringify(attributes.nsfw))
              .field('commentsEnabled', JSON.stringify(attributes.commentsEnabled))
              .field('description', attributes.description)
              .field('privacy', attributes.privacy.toString())
              .field('channelId', attributes.channelId)

  if (attributes.language !== undefined) {
    req.field('language', attributes.language.toString())
  }

  for (let i = 0; i < attributes.tags.length; i++) {
    req.field('tags[' + i + ']', attributes.tags[i])
  }

  let filePath = ''
  if (isAbsolute(attributes.fixture)) {
    filePath = attributes.fixture
  } else {
    filePath = join(__dirname, '..', '..', 'api', 'fixtures', attributes.fixture)
  }

  return req.attach('videofile', filePath)
            .expect(specialStatus)
}

function updateVideo (url: string, accessToken: string, id: number | string, attributes: VideoAttributes, specialStatus = 204) {
  const path = '/api/v1/videos/' + id
  const body = {}

  if (attributes.name) body['name'] = attributes.name
  if (attributes.category) body['category'] = attributes.category
  if (attributes.licence) body['licence'] = attributes.licence
  if (attributes.language) body['language'] = attributes.language
  if (attributes.nsfw !== undefined) body['nsfw'] = JSON.stringify(attributes.nsfw)
  if (attributes.commentsEnabled !== undefined) body['commentsEnabled'] = JSON.stringify(attributes.commentsEnabled)
  if (attributes.description) body['description'] = attributes.description
  if (attributes.tags) body['tags'] = attributes.tags
  if (attributes.privacy) body['privacy'] = attributes.privacy

  return request(url)
          .put(path)
          .send(body)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .expect(specialStatus)
}

function rateVideo (url: string, accessToken: string, id: number, rating: string, specialStatus = 204) {
  const path = '/api/v1/videos/' + id + '/rate'

  return request(url)
          .put(path)
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer ' + accessToken)
          .send({ rating })
          .expect(specialStatus)
}

function parseTorrentVideo (server: ServerInfo, videoUUID: string, resolution: number) {
  return new Promise<any>((res, rej) => {
    const torrentName = videoUUID + '-' + resolution + '.torrent'
    const torrentPath = join(__dirname, '..', '..', '..', '..', 'test' + server.serverNumber, 'torrents', torrentName)
    readFile(torrentPath, (err, data) => {
      if (err) return rej(err)

      return res(parseTorrent(data))
    })
  })
}

async function completeVideoCheck (
  url: string,
  video: any,
  attributes: {
    name: string
    category: number
    licence: number
    language: number
    nsfw: boolean
    commentsEnabled: boolean
    description: string
    host: string
    account: string
    isLocal: boolean,
    tags: string[],
    privacy: number,
    likes?: number,
    dislikes?: number,
    duration: number,
    channel: {
      name: string,
      description
      isLocal: boolean
    }
    fixture: string,
    files: {
      resolution: number
      size: number
    }[]
  }
) {
  if (!attributes.likes) attributes.likes = 0
  if (!attributes.dislikes) attributes.dislikes = 0

  expect(video.name).to.equal(attributes.name)
  expect(video.category).to.equal(attributes.category)
  expect(video.categoryLabel).to.equal(VIDEO_CATEGORIES[attributes.category] || 'Misc')
  expect(video.licence).to.equal(attributes.licence)
  expect(video.licenceLabel).to.equal(VIDEO_LICENCES[attributes.licence] || 'Unknown')
  expect(video.language).to.equal(attributes.language)
  expect(video.languageLabel).to.equal(VIDEO_LANGUAGES[attributes.language] || 'Unknown')
  expect(video.nsfw).to.equal(attributes.nsfw)
  expect(video.description).to.equal(attributes.description)
  expect(video.serverHost).to.equal(attributes.host)
  expect(video.accountName).to.equal(attributes.account)
  expect(video.likes).to.equal(attributes.likes)
  expect(video.dislikes).to.equal(attributes.dislikes)
  expect(video.isLocal).to.equal(attributes.isLocal)
  expect(video.duration).to.equal(attributes.duration)
  expect(dateIsValid(video.createdAt)).to.be.true
  expect(dateIsValid(video.updatedAt)).to.be.true

  const res = await getVideo(url, video.uuid)
  const videoDetails = res.body

  expect(videoDetails.files).to.have.lengthOf(attributes.files.length)
  expect(videoDetails.tags).to.deep.equal(attributes.tags)
  expect(videoDetails.privacy).to.deep.equal(attributes.privacy)
  expect(videoDetails.privacyLabel).to.deep.equal(VIDEO_PRIVACIES[attributes.privacy])
  expect(videoDetails.account.name).to.equal(attributes.account)
  expect(videoDetails.commentsEnabled).to.equal(attributes.commentsEnabled)

  expect(videoDetails.channel.displayName).to.equal(attributes.channel.name)
  expect(videoDetails.channel.name).to.have.lengthOf(36)
  expect(videoDetails.channel.isLocal).to.equal(attributes.channel.isLocal)
  expect(dateIsValid(videoDetails.channel.createdAt)).to.be.true
  expect(dateIsValid(videoDetails.channel.updatedAt)).to.be.true

  for (const attributeFile of attributes.files) {
    const file = videoDetails.files.find(f => f.resolution === attributeFile.resolution)
    expect(file).not.to.be.undefined

    let extension = extname(attributes.fixture)
    // Transcoding enabled on server 2, extension will always be .mp4
    if (attributes.host === 'localhost:9002') extension = '.mp4'

    const magnetUri = file.magnetUri
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.torrentUrl).to.equal(`http://${attributes.host}/static/torrents/${videoDetails.uuid}-${file.resolution}.torrent`)
    expect(file.fileUrl).to.equal(`http://${attributes.host}/static/webseed/${videoDetails.uuid}-${file.resolution}${extension}`)
    expect(file.resolution).to.equal(attributeFile.resolution)
    expect(file.resolutionLabel).to.equal(attributeFile.resolution + 'p')

    const minSize = attributeFile.size - ((10 * attributeFile.size) / 100)
    const maxSize = attributeFile.size + ((10 * attributeFile.size) / 100)
    expect(file.size).to.be.above(minSize).and.below(maxSize)

    const test = await testImage(url, attributes.fixture, videoDetails.thumbnailPath)
    expect(test).to.equal(true)

    const torrent = await webtorrentAdd(magnetUri, true)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).to.exist.and.to.not.equal('')
  }
}

// ---------------------------------------------------------------------------

export {
  getVideoDescription,
  getVideoCategories,
  getVideoLicences,
  getVideoPrivacies,
  getVideoLanguages,
  getMyVideos,
  getVideo,
  getVideoWithToken,
  getVideosList,
  getVideosListPagination,
  getVideosListSort,
  removeVideo,
  searchVideo,
  searchVideoWithPagination,
  searchVideoWithSort,
  uploadVideo,
  updateVideo,
  rateVideo,
  viewVideo,
  parseTorrentVideo,
  completeVideoCheck,
  checkVideoFilesWereRemoved
}
