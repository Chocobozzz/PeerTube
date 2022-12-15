/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { pathExists, readFile } from 'fs-extra'
import { join } from 'path'
import { root } from '@shared/core-utils'
import { HttpStatusCode } from '@shared/models'
import { makeGetRequest, PeerTubeServer } from '@shared/server-commands'

// Default interval -> 5 minutes
function dateIsValid (dateString: string, interval = 300000) {
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

async function testImage (url: string, imageName: string, imageHTTPPath: string, extension = '.jpg') {
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

async function testFileExistsOrNot (server: PeerTubeServer, directory: string, filePath: string, exist: boolean) {
  const base = server.servers.buildDirectory(directory)

  expect(await pathExists(join(base, filePath))).to.equal(exist)
}

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

export {
  dateIsValid,
  testImage,
  expectLogDoesNotContain,
  testFileExistsOrNot,
  expectStartWith,
  expectNotStartWith,
  expectEndWith,
  checkBadStartPagination,
  checkBadCountPagination,
  checkBadSortPagination,
  expectLogContain
}
