import { FIXTURE_URLS } from '@server/tests/shared'
import { areHttpImportTestsDisabled } from '@shared/core-utils'
import {
  ChannelsCommand,
  createSingleServer,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'
import { expect } from 'chai'

describe('Test videos import on a channel', function () {
  if (areHttpImportTestsDisabled()) return
  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {
    describe('Import using ' + mode, function () {
      let server: PeerTubeServer
      let command: ChannelsCommand
      before(async function () {
        this.timeout(120_000)
        server = await createSingleServer(1, {
          import: {
            videos: {
              http: {
                youtube_dl_release: {
                  url: mode === 'youtube-dl'
                    ? 'https://yt-dl.org/downloads/latest/youtube-dl'
                    : 'https://api.github.com/repos/yt-dlp/yt-dlp/releases',

                  name: mode
                }
              }
            }
          }
        })
        await setAccessTokensToServers([ server ])
        await setDefaultVideoChannel([ server ])
        command = server.channels
      })

      after(async function () {
        await server?.kill()
      })

      it('Should import a whole channel (this test takes a while)', async function () {
        this.timeout(240_000)
        await command.importVideos({
          channelName: server.store.channel.name,
          externalChannelUrl: FIXTURE_URLS.youtubeChannel
        })
        await waitJobs(server, true)
        const videos = await server.videos.listByChannel({
          handle: server.store.channel.name
        })
        expect(videos.total).to.equal(2)
      })

    })
  }

  runSuite('yt-dlp')
  runSuite('youtube-dl')
})
