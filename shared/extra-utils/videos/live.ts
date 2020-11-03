import * as ffmpeg from 'fluent-ffmpeg'
import { omit } from 'lodash'
import { LiveVideo, LiveVideoCreate, LiveVideoUpdate, VideoDetails, VideoState } from '@shared/models'
import { buildAbsoluteFixturePath, wait } from '../miscs/miscs'
import { makeGetRequest, makePutBodyRequest, makeUploadRequest } from '../requests/requests'
import { getVideoWithToken } from './videos'

function getLive (url: string, token: string, videoId: number | string, statusCodeExpected = 200) {
  const path = '/api/v1/videos/live'

  return makeGetRequest({
    url,
    token,
    path: path + '/' + videoId,
    statusCodeExpected
  })
}

function updateLive (url: string, token: string, videoId: number | string, fields: LiveVideoUpdate, statusCodeExpected = 204) {
  const path = '/api/v1/videos/live'

  return makePutBodyRequest({
    url,
    token,
    path: path + '/' + videoId,
    fields,
    statusCodeExpected
  })
}

function createLive (url: string, token: string, fields: LiveVideoCreate, statusCodeExpected = 200) {
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

async function sendRTMPStreamInVideo (url: string, token: string, videoId: number | string, onErrorCb?: Function) {
  const res = await getLive(url, token, videoId)
  const videoLive = res.body as LiveVideo

  return sendRTMPStream(videoLive.rtmpUrl, videoLive.streamKey, onErrorCb)
}

function sendRTMPStream (rtmpBaseUrl: string, streamKey: string, onErrorCb?: Function) {
  const fixture = buildAbsoluteFixturePath('video_short.mp4')

  const command = ffmpeg(fixture)
  command.inputOption('-stream_loop -1')
  command.inputOption('-re')

  command.outputOption('-c copy')
  command.outputOption('-f flv')

  const rtmpUrl = rtmpBaseUrl + '/' + streamKey
  command.output(rtmpUrl)

  command.on('error', err => {
    if (err?.message?.includes('Exiting normally')) return

    if (onErrorCb) onErrorCb(err)
  })

  if (process.env.DEBUG) {
    command.on('stderr', data => console.log(data))
  }

  command.run()

  return command
}

function waitFfmpegUntilError (command: ffmpeg.FfmpegCommand, successAfterMS = 10000) {
  return new Promise((res, rej) => {
    command.on('error', err => {
      return rej(err)
    })

    setTimeout(() => {
      res()
    }, successAfterMS)
  })
}

async function testFfmpegStreamError (url: string, token: string, videoId: number | string, shouldHaveError: boolean) {
  const command = await sendRTMPStreamInVideo(url, token, videoId)
  let error: Error

  try {
    await waitFfmpegUntilError(command, 10000)
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

async function waitUntilLiveStarts (url: string, token: string, videoId: number | string) {
  let video: VideoDetails

  do {
    const res = await getVideoWithToken(url, token, videoId)
    video = res.body

    await wait(500)
  } while (video.state.id === VideoState.WAITING_FOR_LIVE)
}

// ---------------------------------------------------------------------------

export {
  getLive,
  updateLive,
  waitUntilLiveStarts,
  createLive,
  testFfmpegStreamError,
  stopFfmpeg,
  sendRTMPStreamInVideo,
  waitFfmpegUntilError,
  sendRTMPStream
}
