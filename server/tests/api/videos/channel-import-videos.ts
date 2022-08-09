import { expect } from 'chai'
import { FIXTURE_URLS } from '@server/tests/shared'
import { areHttpImportTestsDisabled } from '@shared/core-utils'
import {
  createSingleServer,
  getServerImportConfig,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@shared/server-commands'

describe('Test videos import in a channel', function () {
  if (areHttpImportTestsDisabled()) return

  function runSuite (mode: 'youtube-dl' | 'yt-dlp') {

    describe('Import using ' + mode, function () {
      let server: PeerTubeServer

      before(async function () {
        this.timeout(120_000)

        server = await createSingleServer(1, getServerImportConfig(mode))

        await setAccessTokensToServers([ server ])
        await setDefaultVideoChannel([ server ])

        await server.config.enableChannelSync()
      })

      it('Should import a whole channel', async function () {
        this.timeout(240_000)

        await server.channels.importVideos({ channelName: server.store.channel.name, externalChannelUrl: FIXTURE_URLS.youtubeChannel })
        await waitJobs(server)

        const videos = await server.videos.listByChannel({ handle: server.store.channel.name })
        expect(videos.total).to.equal(2)
      })

      after(async function () {
        await server?.kill()
      })
    })
  }

  runSuite('yt-dlp')
  runSuite('youtube-dl')
})
