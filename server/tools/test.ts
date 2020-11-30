import { registerTSPaths } from '../helpers/register-ts-paths'
registerTSPaths()

import { LiveVideo, LiveVideoCreate, VideoPrivacy } from '@shared/models'
import * as program from 'commander'
import {
  createLive,
  flushAndRunServer,
  getLive,
  killallServers,
  sendRTMPStream,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  updateCustomSubConfig
} from '../../shared/extra-utils'

type CommandType = 'live-mux' | 'live-transcoding'

registerTSPaths()

const command = program
  .name('test')
  .option('-t, --type <type>', 'live-muxing|live-transcoding')
  .parse(process.argv)

run()
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  const commandType: CommandType = command['type']
  if (!commandType) {
    console.error('Miss command type')
    process.exit(-1)
  }

  console.log('Starting server.')

  const server = await flushAndRunServer(1, {}, [], { hideLogs: false, execArgv: [ '--inspect' ] })

  const cleanup = () => {
    console.log('Killing server')
    killallServers([ server ])
  }

  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)

  await setAccessTokensToServers([ server ])
  await setDefaultVideoChannel([ server ])

  await buildConfig(server, commandType)

  const attributes: LiveVideoCreate = {
    name: 'live',
    saveReplay: true,
    channelId: server.videoChannel.id,
    privacy: VideoPrivacy.PUBLIC
  }

  console.log('Creating live.')

  const res = await createLive(server.url, server.accessToken, attributes)
  const liveVideoUUID = res.body.video.uuid

  const resLive = await getLive(server.url, server.accessToken, liveVideoUUID)
  const live: LiveVideo = resLive.body

  console.log('Sending RTMP stream.')

  const ffmpegCommand = sendRTMPStream(live.rtmpUrl, live.streamKey)

  ffmpegCommand.on('error', err => {
    console.error(err)
    process.exit(-1)
  })

  ffmpegCommand.on('end', () => {
    console.log('ffmpeg ended')
    process.exit(0)
  })
}

// ----------------------------------------------------------------------------

async function buildConfig (server: ServerInfo, commandType: CommandType) {
  await updateCustomSubConfig(server.url, server.accessToken, {
    instance: {
      customizations: {
        javascript: '',
        css: ''
      }
    },
    live: {
      enabled: true,
      allowReplay: true,
      transcoding: {
        enabled: commandType === 'live-transcoding'
      }
    }
  })
}
