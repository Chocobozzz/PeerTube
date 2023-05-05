/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { pathExists, readFile } from 'fs-extra'
import JPEG from 'jpeg-js'
import { join } from 'path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { root } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { makeGetRequest, PeerTubeServer } from '@shared/server-commands'

// Default interval -> 5 minutes
function dateIsValid (dateString: string | Date, interval = 300000) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  return Math.abs(now.getTime() - dateToCheck.getTime()) <= interval
}

function expectStartWith (str: string, start: string) {
  expect(str.startsWith(start), `${str} does not start with ${start}`).to.be.true
}

function expectNotStartWith (str: string, start: string) {
  expect(str.startsWith(start), `${str} does not start with ${start}`).to.be.false
}

function expectEndWith (str: string, end: string) {
  expect(str.endsWith(end), `${str} does not end with ${end}`).to.be.true
}

// ---------------------------------------------------------------------------

async function expectLogDoesNotContain (server: PeerTubeServer, str: string) {
  const content = await server.servers.getLogContent()

  expect(content.toString()).to.not.contain(str)
}

async function expectLogContain (server: PeerTubeServer, str: string) {
  const content = await server.servers.getLogContent()

  expect(content.toString()).to.contain(str)
}

async function testImageSize (url: string, imageName: string, imageHTTPPath: string, extension = '.jpg') {
  const res = await makeGetRequest({
    url,
    path: imageHTTPPath,
    expectedStatus: HttpStatusCode.OK_200
  })

  const body = res.body

  const data = await readFile(join(root(), 'server', 'tests', 'fixtures', imageName + extension))
  const minLength = data.length - ((40 * data.length) / 100)
  const maxLength = data.length + ((40 * data.length) / 100)

  expect(body.length).to.be.above(minLength, 'the generated image is way smaller than the recorded fixture')
  expect(body.length).to.be.below(maxLength, 'the generated image is way larger than the recorded fixture')
}

async function testImage (url: string, imageName: string, imageHTTPPath: string, extension = '.jpg') {
  const res = await makeGetRequest({
    url,
    path: imageHTTPPath,
    expectedStatus: HttpStatusCode.OK_200
  })

  const body = res.body
  const data = await readFile(join(root(), 'server', 'tests', 'fixtures', imageName + extension))

  const img1 = imageHTTPPath.endsWith('.png')
    ? PNG.sync.read(body)
    : JPEG.decode(body)

  const img2 = extension === '.png'
    ? PNG.sync.read(data)
    : JPEG.decode(data)

  const result = pixelmatch(img1.data, img2.data, null, img1.width, img1.height, { threshold: 0.1 })

  expect(result).to.equal(0, `${imageHTTPPath} image is not the same as ${imageName}${extension}`)
}

async function testFileExistsOrNot (server: PeerTubeServer, directory: string, filePath: string, exist: boolean) {
  const base = server.servers.buildDirectory(directory)

  expect(await pathExists(join(base, filePath))).to.equal(exist)
}

// ---------------------------------------------------------------------------

function checkBadStartPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { ...query, start: 'hello' },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })
}

async function checkBadCountPagination (url: string, path: string, token?: string, query = {}) {
  await makeGetRequest({
    url,
    path,
    token,
    query: { ...query, count: 'hello' },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })

  await makeGetRequest({
    url,
    path,
    token,
    query: { ...query, count: 2000 },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })
}

function checkBadSortPagination (url: string, path: string, token?: string, query = {}) {
  return makeGetRequest({
    url,
    path,
    token,
    query: { ...query, sort: 'hello' },
    expectedStatus: HttpStatusCode.BAD_REQUEST_400
  })
}

// ---------------------------------------------------------------------------

async function checkVideoDuration (server: PeerTubeServer, videoUUID: string, duration: number) {
  const video = await server.videos.get({ id: videoUUID })

  expect(video.duration).to.be.approximately(duration, 1)

  for (const file of video.files) {
    const metadata = await server.videos.getFileMetadata({ url: file.metadataUrl })

    for (const stream of metadata.streams) {
      expect(Math.round(stream.duration)).to.be.approximately(duration, 1)
    }
  }
}

export {
  dateIsValid,
  testImageSize,
  testImage,
  expectLogDoesNotContain,
  testFileExistsOrNot,
  expectStartWith,
  expectNotStartWith,
  expectEndWith,
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination,
  checkVideoDuration,
  expectLogContain
}
