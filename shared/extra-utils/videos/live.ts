/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import * as ffmpeg from 'fluent-ffmpeg'
import { pathExists, readdir } from 'fs-extra'
import { join } from 'path'
import { buildAbsoluteFixturePath, wait } from '../miscs'
import { PeerTubeServer } from '../server/server'

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

async function testFfmpegStreamError (command: ffmpeg.FfmpegCommand, shouldHaveError: boolean) {
  let error: Error

  try {
    await waitFfmpegUntilError(command, 35000)
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

async function waitUntilLivePublishedOnAllServers (servers: PeerTubeServer[], videoId: string) {
  for (const server of servers) {
    await server.live.waitUntilPublished({ videoId })
  }
}

async function checkLiveCleanup (server: PeerTubeServer, videoUUID: string, resolutions: number[] = []) {
  const basePath = server.servers.buildDirectory('streaming-playlists')
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

export {
  sendRTMPStream,
  waitFfmpegUntilError,
  testFfmpegStreamError,
  stopFfmpeg,
  waitUntilLivePublishedOnAllServers,
  checkLiveCleanup
}
