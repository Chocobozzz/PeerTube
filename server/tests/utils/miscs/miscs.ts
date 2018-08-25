/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import { isAbsolute, join } from 'path'
import * as request from 'supertest'
import * as WebTorrent from 'webtorrent'
import { readFileBufferPromise } from '../../../helpers/core-utils'

const expect = chai.expect
let webtorrent = new WebTorrent()

function immutableAssign <T, U> (target: T, source: U) {
  return Object.assign<{}, T, U>({}, target, source)
}

  // Default interval -> 5 minutes
function dateIsValid (dateString: string, interval = 300000) {
  const dateToCheck = new Date(dateString)
  const now = new Date()

  return Math.abs(now.getTime() - dateToCheck.getTime()) <= interval
}

function wait (milliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function webtorrentAdd (torrent: string, refreshWebTorrent = false) {
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

function root () {
  // We are in server/tests/utils/miscs
  return join(__dirname, '..', '..', '..', '..')
}

async function testImage (url: string, imageName: string, imagePath: string, extension = '.jpg') {
  const res = await request(url)
    .get(imagePath)
    .expect(200)

  const body = res.body

  const data = await readFileBufferPromise(join(__dirname, '..', '..', 'fixtures', imageName + extension))
  const minLength = body.length - ((20 * body.length) / 100)
  const maxLength = body.length + ((20 * body.length) / 100)

  expect(data.length).to.be.above(minLength)
  expect(data.length).to.be.below(maxLength)
}

function buildAbsoluteFixturePath (path: string) {
  if (isAbsolute(path)) {
    return path
  }

  return join(__dirname, '..', '..', 'fixtures', path)
}

// ---------------------------------------------------------------------------

export {
  dateIsValid,
  wait,
  webtorrentAdd,
  immutableAssign,
  testImage,
  buildAbsoluteFixturePath,
  root
}
