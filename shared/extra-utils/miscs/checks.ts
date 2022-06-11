/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/no-floating-promises */

import { expect } from 'chai'
import { pathExists, readFile } from 'fs-extra'
import { join } from 'path'
import { root } from '@server/helpers/core-utils'
import { HttpStatusCode } from '@shared/models'
import { makeGetRequest } from '../requests'
import { PeerTubeServer } from '../server'

// Default interval -> 5 minutes
function dateIsValid (dateString: string, interval = 300000) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  return Math.abs(now.getTime() - dateToCheck.getTime()) <= interval
}

function expectStartWith (str: string, start: string) {
  expect(str.startsWith(start), `${str} does not start with ${start}`).to.be.true
}

async function expectLogDoesNotContain (server: PeerTubeServer, str: string) {
  const content = await server.servers.getLogContent()

  expect(content.toString()).to.not.contain(str)
}

async function testImage (url: string, imageName: string, imagePath: string, extension = '.jpg') {
  const res = await makeGetRequest({
    url,
    path: imagePath,
    expectedStatus: HttpStatusCode.OK_200
  })

  const body = res.body

  const data = await readFile(join(root(), 'server', 'tests', 'fixtures', imageName + extension))
  const minLength = body.length - ((30 * body.length) / 100)
  const maxLength = body.length + ((30 * body.length) / 100)

  expect(data.length).to.be.above(minLength, 'the generated image is way smaller than the recorded fixture')
  expect(data.length).to.be.below(maxLength, 'the generated image is way larger than the recorded fixture')
}

async function testFileExistsOrNot (server: PeerTubeServer, directory: string, filePath: string, exist: boolean) {
  const base = server.servers.buildDirectory(directory)

  expect(await pathExists(join(base, filePath))).to.equal(exist)
}

export {
  dateIsValid,
  testImage,
  expectLogDoesNotContain,
  testFileExistsOrNot,
  expectStartWith
}
