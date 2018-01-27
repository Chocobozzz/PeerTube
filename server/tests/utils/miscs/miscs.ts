/* tslint:disable:no-unused-expression */

import { join } from 'path'
import * as request from 'supertest'
import * as WebTorrent from 'webtorrent'
import { readFileBufferPromise } from '../../../helpers/core-utils'

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
  // Don't test images if the node env is not set
  // Because we need a special ffmpeg version for this test
  if (process.env[ 'NODE_TEST_IMAGE' ]) {
    const res = await request(url)
      .get(imagePath)
      .expect(200)

    const body = res.body

    const data = await readFileBufferPromise(join(__dirname, '..', '..', 'api', 'fixtures', imageName + extension))
    const minLength = body.length - ((50 * body.length) / 100)
    const maxLength = body.length + ((50 * body.length) / 100)

    return data.length > minLength && data.length < maxLength
  } else {
    console.log('Do not test images. Enable it by setting NODE_TEST_IMAGE env variable.')
    return true
  }
}

// ---------------------------------------------------------------------------

export {
  dateIsValid,
  wait,
  webtorrentAdd,
  immutableAssign,
  testImage,
  root
}
