/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import * as ffmpeg from 'fluent-ffmpeg'
import { ensureDir, pathExists, readFile, stat } from 'fs-extra'
import { basename, dirname, isAbsolute, join, resolve } from 'path'
import * as request from 'supertest'
import * as WebTorrent from 'webtorrent'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'

const expect = chai.expect
let webtorrent: WebTorrent.Instance

function immutableAssign<T, U> (target: T, source: U) {
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
  const WebTorrent = require('webtorrent')

  if (!webtorrent) webtorrent = new WebTorrent()
  if (refreshWebTorrent === true) webtorrent = new WebTorrent()

  return new Promise<WebTorrent.Torrent>(res => webtorrent.add(torrent, res))
}

function root () {
  // We are in /miscs
  let root = join(__dirname, '..', '..', '..')

  if (basename(root) === 'dist') root = resolve(root, '..')

  return root
}

function buildServerDirectory (server: { internalServerNumber: number }, directory: string) {
  return join(root(), 'test' + server.internalServerNumber, directory)
}

async function testImage (url: string, imageName: string, imagePath: string, extension = '.jpg') {
  const res = await request(url)
    .get(imagePath)
    .expect(HttpStatusCode.OK_200)

  const body = res.body

  const data = await readFile(join(root(), 'server', 'tests', 'fixtures', imageName + extension))
  const minLength = body.length - ((30 * body.length) / 100)
  const maxLength = body.length + ((30 * body.length) / 100)

  expect(data.length).to.be.above(minLength, 'the generated image is way smaller than the recorded fixture')
  expect(data.length).to.be.below(maxLength, 'the generated image is way larger than the recorded fixture')
}

async function testFileExistsOrNot (server: { internalServerNumber: number }, directory: string, filePath: string, exist: boolean) {
  const base = buildServerDirectory(server, directory)

  expect(await pathExists(join(base, filePath))).to.equal(exist)
}

function isGithubCI () {
  return !!process.env.GITHUB_WORKSPACE
}

function buildAbsoluteFixturePath (path: string, customCIPath = false) {
  if (isAbsolute(path)) return path

  if (customCIPath && process.env.GITHUB_WORKSPACE) {
    return join(process.env.GITHUB_WORKSPACE, 'fixtures', path)
  }

  return join(root(), 'server', 'tests', 'fixtures', path)
}

function areHttpImportTestsDisabled () {
  const disabled = process.env.DISABLE_HTTP_IMPORT_TESTS === 'true'

  if (disabled) console.log('Import tests are disabled')

  return disabled
}

async function generateHighBitrateVideo () {
  const tempFixturePath = buildAbsoluteFixturePath('video_high_bitrate_1080p.mp4', true)

  await ensureDir(dirname(tempFixturePath))

  const exists = await pathExists(tempFixturePath)
  if (!exists) {
    console.log('Generating high bitrate video.')

    // Generate a random, high bitrate video on the fly, so we don't have to include
    // a large file in the repo. The video needs to have a certain minimum length so
    // that FFmpeg properly applies bitrate limits.
    // https://stackoverflow.com/a/15795112
    return new Promise<string>((res, rej) => {
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

async function generateVideoWithFramerate (fps = 60) {
  const tempFixturePath = buildAbsoluteFixturePath(`video_${fps}fps.mp4`, true)

  await ensureDir(dirname(tempFixturePath))

  const exists = await pathExists(tempFixturePath)
  if (!exists) {
    console.log('Generating video with framerate %d.', fps)

    return new Promise<string>((res, rej) => {
      ffmpeg()
        .outputOptions([ '-f rawvideo', '-video_size 1280x720', '-i /dev/urandom' ])
        .outputOptions([ '-ac 2', '-f s16le', '-i /dev/urandom', '-t 10' ])
        .outputOptions([ `-r ${fps}` ])
        .output(tempFixturePath)
        .on('error', rej)
        .on('end', () => res(tempFixturePath))
        .run()
    })
  }

  return tempFixturePath
}

async function getFileSize (path: string) {
  const stats = await stat(path)

  return stats.size
}

// ---------------------------------------------------------------------------

export {
  dateIsValid,
  wait,
  areHttpImportTestsDisabled,
  buildServerDirectory,
  webtorrentAdd,
  getFileSize,
  immutableAssign,
  testImage,
  isGithubCI,
  buildAbsoluteFixturePath,
  testFileExistsOrNot,
  root,
  generateHighBitrateVideo,
  generateVideoWithFramerate
}
