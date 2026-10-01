/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { getAllFiles, getHLS } from '@peertube/peertube-core-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  killallServers,
  makeActivityPubGetRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { getTorrentInfoHash, parseTorrentVideo } from '@tests/shared/p2p.js'
import { checkTrackerInfohash } from '@tests/shared/tracker.js'
import { expect } from 'chai'

describe('Test tracker URLs', function () {
  let servers: PeerTubeServer[]
  let videoUUID: string

  // Video file id -> info hash, before the last restart
  // Changing the announce list must not change the info hash, so clients keep sharing the same swarm
  const infohashesBeforeRestart = new Map<number, string>()

  const externalWS = 'wss://tracker.example.com/announce'
  const externalHttp = 'https://tracker.example.com/announce'

  function getBuiltInUrls () {
    return {
      http: servers[0].url + '/tracker/announce',
      ws: 'ws://' + servers[0].host + '/tracker/socket'
    }
  }

  async function getFiles () {
    const video = await servers[0].videos.get({ id: videoUUID })

    return getAllFiles(video)
  }

  async function checkTorrents (expectedAnnounce: string[]) {
    const video = await servers[0].videos.get({ id: videoUUID })

    expect(video.files).to.not.have.lengthOf(0)
    expect(getHLS(video).files).to.not.have.lengthOf(0)

    for (const file of getAllFiles(video)) {
      const torrent = await parseTorrentVideo(servers[0], file)

      expect(torrent.announce).to.deep.equal(expectedAnnounce)
      expect(torrent.infoHash).to.equal(infohashesBeforeRestart.get(file.id))
    }
  }

  async function getTorrentUrls () {
    return (await getFiles()).map(f => f.torrentUrl)
  }

  async function saveInfohashes () {
    for (const file of await getFiles()) {
      infohashesBeforeRestart.set(file.id, getTorrentInfoHash(file.magnetUri))
    }
  }

  async function restart (config?: any) {
    await saveInfohashes()

    await killallServers([ servers[0] ])
    await servers[0].run(config)
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    await servers[0].config.enableMinimumTranscoding()

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    await waitJobs(servers)
    await saveInfohashes()
  })

  describe('Built-in tracker', function () {
    it('Should advertise the built-in tracker by default', async function () {
      const { http, ws } = getBuiltInUrls()

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.deep.equal([ http, ws ])

      await checkTorrents([ ws, http ])
    })

    it('Should not update torrents when restarting with the same tracker URLs', async function () {
      this.timeout(60000)

      const before = await getTorrentUrls()

      await restart({ tracker: { urls: [ 'local' ] } })
      await waitJobs(servers)

      expect(await getTorrentUrls()).to.deep.equal(before)
    })
  })

  describe('External trackers', function () {
    it('Should advertise external and built-in trackers', async function () {
      this.timeout(60000)

      const { http, ws } = getBuiltInUrls()

      await restart({ tracker: { urls: [ externalWS, 'local', externalHttp ] } })

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.deep.equal([ externalWS, http, ws, externalHttp ])

      for (const file of getAllFiles(video)) {
        expect(file.magnetUri).to.contain(encodeURIComponent(externalWS))
        expect(file.magnetUri).to.contain(encodeURIComponent(ws))
      }

      const { body } = await makeActivityPubGetRequest(servers[0].url, '/videos/watch/' + videoUUID)
      const apTrackers = body.url.filter(u => Array.isArray(u.rel) && u.rel.includes('tracker')).map(u => u.href)
      expect(apTrackers).to.deep.equal([ externalWS, http, ws, externalHttp ])
    })

    it('Should have updated the announce list of torrents in the background', async function () {
      this.timeout(60000)

      await waitJobs(servers)

      // Websocket trackers first, then the configuration order
      const { http, ws } = getBuiltInUrls()
      await checkTorrents([ externalWS, ws, http, externalHttp ])
    })

    it('Should federate the external trackers', async function () {
      this.timeout(60000)

      await servers[0].videos.update({ id: videoUUID, attributes: { name: 'video updated' } })
      await waitJobs(servers)

      const video = await servers[1].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.include(externalWS)
      expect(video.trackerUrls).to.include(externalHttp)
    })

    it('Should update torrents when only the order of tracker URLs changes', async function () {
      this.timeout(60000)

      const { http, ws } = getBuiltInUrls()

      await restart({ tracker: { urls: [ 'local', externalWS, externalHttp ] } })

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.deep.equal([ http, ws, externalWS, externalHttp ])

      await waitJobs(servers)

      // The first websocket tracker is also the `announce` field of the torrent
      await checkTorrents([ ws, externalWS, http, externalHttp ])
    })

    it('Should fallback on the built-in tracker of the origin if a remote video has no websocket tracker', async function () {
      this.timeout(60000)

      const { http, ws } = getBuiltInUrls()

      await restart({ tracker: { urls: [ externalHttp ] } })
      await waitJobs(servers)

      await servers[0].videos.update({ id: videoUUID, attributes: { name: 'video updated 2' } })
      await waitJobs(servers)

      const video = await servers[1].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.have.members([ ws, http ])
      expect(video.trackerUrls).to.not.include(externalHttp)
    })

    it('Should only advertise the external tracker and keep the built-in one answering', async function () {
      this.timeout(60000)

      await restart({ tracker: { urls: [ externalWS ] } })

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.deep.equal([ externalWS ])

      await waitJobs(servers)
      await checkTorrents([ externalWS ])

      const webVideoFile = video.files[0]
      await checkTrackerInfohash(servers[0].url, getTorrentInfoHash(webVideoFile.magnetUri))
    })
  })

  describe('Configuration checks', function () {
    const invalidConfigs = [
      { title: 'no tracker', config: { tracker: { urls: [] } } },
      { title: 'an unsupported protocol', config: { tracker: { urls: [ 'ftp://tracker.example.com' ] } } },
      { title: 'an invalid URL', config: { tracker: { urls: [ 'not an url' ] } } },
      {
        title: 'an insecure websocket tracker on an HTTPS instance',
        config: { webserver: { https: true }, tracker: { urls: [ 'ws://tracker.example.com' ] } },
        message: 'use wss://'
      }
    ]

    for (const { title, config, message } of invalidConfigs) {
      it(`Should not start with ${title}`, async function () {
        this.timeout(60000)

        await killallServers([ servers[0] ])

        let error: Error
        try {
          await servers[0].run(config)
        } catch (err) {
          error = err
        }

        expect(error, 'The server started').to.exist
        expect(error.message).to.contain('tracker.urls')
        if (message) expect(error.message).to.contain(message)
      })
    }

    it('Should accept an insecure websocket tracker on an HTTP instance', async function () {
      this.timeout(60000)

      await servers[0].run({ tracker: { urls: [ 'ws://tracker.example.com' ] } })

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.trackerUrls).to.deep.equal([ 'ws://tracker.example.com' ])
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
