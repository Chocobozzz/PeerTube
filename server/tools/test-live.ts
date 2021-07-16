import { program } from 'commander'
import { LiveVideoCreate, VideoPrivacy } from '@shared/models'
import {
  createSingleServer,
  killallServers,
  sendRTMPStream,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel
} from '../../shared/extra-utils'
import { registerTSPaths } from '../helpers/register-ts-paths'

registerTSPaths()

type CommandType = 'live-mux' | 'live-transcoding'

registerTSPaths()

const command = program
  .name('test-live')
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

  const server = await createSingleServer(1, {}, [], { hideLogs: false, execArgv: [ '--inspect' ] })

  const cleanup = async () => {
    console.log('Killing server')
    await killallServers([ server ])
  }

  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)

  await setAccessTokensToServers([ server ])
  await setDefaultVideoChannel([ server ])

  await buildConfig(server, commandType)

  const attributes: LiveVideoCreate = {
    name: 'live',
    saveReplay: true,
    channelId: server.store.channel.id,
    privacy: VideoPrivacy.PUBLIC
  }

  console.log('Creating live.')

  const { uuid: liveVideoUUID } = await server.live.create({ fields: attributes })

  const live = await server.live.get({ videoId: liveVideoUUID })

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

async function buildConfig (server: PeerTubeServer, commandType: CommandType) {
  await server.config.updateCustomSubConfig({
    newConfig: {
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
    }
  })
}
