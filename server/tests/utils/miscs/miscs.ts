/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import { isAbsolute, join } from 'path'
import * as request from 'supertest'
import * as WebTorrent from 'webtorrent'
import { pathExists, readFile } from 'fs-extra'
import * as ffmpeg from 'fluent-ffmpeg'

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

  const data = await readFile(join(__dirname, '..', '..', 'fixtures', imageName + extension))
  const minLength = body.length - ((20 * body.length) / 100)
  const maxLength = body.length + ((20 * body.length) / 100)

  expect(data.length).to.be.above(minLength)
  expect(data.length).to.be.below(maxLength)
}

function buildAbsoluteFixturePath (path: string, customTravisPath = false) {
  if (isAbsolute(path)) {
    return path
  }

  if (customTravisPath && process.env.TRAVIS) return join(process.env.HOME, 'fixtures', path)

  return join(__dirname, '..', '..', 'fixtures', path)
}

async function generateHighBitrateVideo () {
  const tempFixturePath = buildAbsoluteFixturePath('video_high_bitrate_1080p.mp4', true)

  const exists = await pathExists(tempFixturePath)
  if (!exists) {

    // Generate a random, high bitrate video on the fly, so we don't have to include
    // a large file in the repo. The video needs to have a certain minimum length so
    // that FFmpeg properly applies bitrate limits.
    // https://stackoverflow.com/a/15795112
    return new Promise<string>(async (res, rej) => {
      ffmpeg()
        .outputOptions([ '-f rawvideo', '-video_size 1920x1080', '-i /dev/urandom' ])
        .outputOptions([ '-ac 2', '-f s16le', '-i /dev/urandom', '-t 10' ])
        .outputOptions([ '-maxrate 10M', '-bufsize 10M' ])
        .output(tempFixturePath)
        .on('error', rej)
        .on('end', () => res(tempFixturePath))
        .run()
    })
  }

  return tempFixturePath
}

// ---------------------------------------------------------------------------

export {
  dateIsValid,
  wait,
  webtorrentAdd,
  immutableAssign,
  testImage,
  buildAbsoluteFixturePath,
  root,
  generateHighBitrateVideo
}
