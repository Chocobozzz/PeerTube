/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import * as ffmpeg from 'fluent-ffmpeg'
import { pathExists, readdir } from 'fs-extra'
import { omit } from 'lodash'
import { join } from 'path'
import { LiveVideo, LiveVideoCreate, LiveVideoUpdate, VideoDetails, VideoState } from '@shared/models'
import { HttpStatusCode } from '../../../shared/core-utils/miscs/http-error-codes'
import { buildAbsoluteFixturePath, buildServerDirectory, wait } from '../miscs/miscs'
import { makeGetRequest, makePutBodyRequest, makeUploadRequest } from '../requests/requests'
import { ServerInfo, waitUntilLog } from '../server/servers'
import { getVideoWithToken } from './videos'

function getLive (url: string, token: string, videoId: number | string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/videos/live'

  return makeGetRequest({
    url,
    token,
    path: path + '/' + videoId,
    statusCodeExpected
  })
}

function updateLive (
  url: string,
  token: string,
  videoId: number | string,
  fields: LiveVideoUpdate,
  statusCodeExpected = HttpStatusCode.NO_CONTENT_204
) {
  const path = '/api/v1/videos/live'

  return makePutBodyRequest({
    url,
    token,
    path: path + '/' + videoId,
    fields,
    statusCodeExpected
  })
}

function createLive (url: string, token: string, fields: LiveVideoCreate, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/videos/live'

  const attaches: any = {}
  if (fields.thumbnailfile) attaches.thumbnailfile = fields.thumbnailfile
  if (fields.previewfile) attaches.previewfile = fields.previewfile

  const updatedFields = omit(fields, 'thumbnailfile', 'previewfile')

  return makeUploadRequest({
    url,
    path,
    token,
    attaches,
    fields: updatedFields,
    statusCodeExpected
  })
}

async function sendRTMPStreamInVideo (url: string, token: string, videoId: number | string, fixtureName?: string) {
  const res = await getLive(url, token, videoId)
  const videoLive = res.body as LiveVideo

  return sendRTMPStream(videoLive.rtmpUrl, videoLive.streamKey, fixtureName)
}

function sendRTMPStream (rtmpBaseUrl: string, streamKey: string, fixtureName = 'video_short.mp4') {
  const fixture = buildAbsoluteFixturePath(fixtureName)

  const command = ffmpeg(fixture)
  command.inputOption('-stream_loop -1')
  command.inputOption('-re')
  command.outputOption('-c:v libx264')
  command.outputOption('-g 50')
  command.outputOption('-keyint_min 2')
  command.outputOption('-r 60')
  command.outputOption('-f flv')

  const rtmpUrl = rtmpBaseUrl + '/' + streamKey
  command.output(rtmpUrl)

  command.on('error', err => {
    if (err?.message?.includes('Exiting normally')) return

    if (process.env.DEBUG) console.error(err)
  })

  if (process.env.DEBUG) {
    command.on('stderr', data => console.log(data))
  }

  command.run()

  return command
}

function waitFfmpegUntilError (command: ffmpeg.FfmpegCommand, successAfterMS = 10000) {
  return new Promise<void>((res, rej) => {
    command.on('error', err => {
      return rej(err)
    })

    setTimeout(() => {
      res()
    }, successAfterMS)
  })
}

async function runAndTestFfmpegStreamError (url: string, token: string, videoId: number | string, shouldHaveError: boolean) {
  const command = await sendRTMPStreamInVideo(url, token, videoId)

  return testFfmpegStreamError(command, shouldHaveError)
}

async function testFfmpegStreamError (command: ffmpeg.FfmpegCommand, shouldHaveError: boolean) {
  let error: Error

  try {
    await waitFfmpegUntilError(command, 25000)
  } catch (err) {
    error = err
  }

  await stopFfmpeg(command)

  if (shouldHaveError && !error) throw new Error('Ffmpeg did not have an error')
  if (!shouldHaveError && error) throw error
}

async function stopFfmpeg (command: ffmpeg.FfmpegCommand) {
  command.kill('SIGINT')

  await wait(500)
}

function waitUntilLivePublished (url: string, token: string, videoId: number | string) {
  return waitUntilLiveState(url, token, videoId, VideoState.PUBLISHED)
}

function waitUntilLiveWaiting (url: string, token: string, videoId: number | string) {
  return waitUntilLiveState(url, token, videoId, VideoState.WAITING_FOR_LIVE)
}

function waitUntilLiveEnded (url: string, token: string, videoId: number | string) {
  return waitUntilLiveState(url, token, videoId, VideoState.LIVE_ENDED)
}

function waitUntilLiveSegmentGeneration (server: ServerInfo, videoUUID: string, resolutionNum: number, segmentNum: number) {
  const segmentName = `${resolutionNum}-00000${segmentNum}.ts`
  return waitUntilLog(server, `${videoUUID}/${segmentName}`, 2, false)
}

async function waitUntilLiveState (url: string, token: string, videoId: number | string, state: VideoState) {
  let video: VideoDetails

  do {
    const res = await getVideoWithToken(url, token, videoId)
    video = res.body

    await wait(500)
  } while (video.state.id !== state)
}

async function checkLiveCleanup (server: ServerInfo, videoUUID: string, resolutions: number[] = []) {
  const basePath = buildServerDirectory(server, 'streaming-playlists')
  const hlsPath = join(basePath, 'hls', videoUUID)

  if (resolutions.length === 0) {
    const result = await pathExists(hlsPath)
    expect(result).to.be.false

    return
  }

  const files = await readdir(hlsPath)

  // fragmented file and playlist per resolution + master playlist + segments sha256 json file
  expect(files).to.have.lengthOf(resolutions.length * 2 + 2)

  for (const resolution of resolutions) {
    expect(files).to.contain(`${videoUUID}-${resolution}-fragmented.mp4`)
    expect(files).to.contain(`${resolution}.m3u8`)
  }

  expect(files).to.contain('master.m3u8')
  expect(files).to.contain('segments-sha256.json')
}

async function getPlaylistsCount (server: ServerInfo, videoUUID: string) {
  const basePath = buildServerDirectory(server, 'streaming-playlists')
  const hlsPath = join(basePath, 'hls', videoUUID)

  const files = await readdir(hlsPath)

  return files.filter(f => f.endsWith('.m3u8')).length
}

// ---------------------------------------------------------------------------

export {
  getLive,
  getPlaylistsCount,
  waitUntilLivePublished,
  updateLive,
  createLive,
  runAndTestFfmpegStreamError,
  checkLiveCleanup,
  waitUntilLiveSegmentGeneration,
  stopFfmpeg,
  waitUntilLiveWaiting,
  sendRTMPStreamInVideo,
  waitUntilLiveEnded,
  waitFfmpegUntilError,
  sendRTMPStream,
  testFfmpegStreamError
}
