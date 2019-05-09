/* tslint:disable:no-unused-expression */

import * as magnetUtil from 'magnet-uri'
import 'mocha'
import {
  cleanupTests,
  flushAndRunServer,
  getVideo,
  killallServers,
  reRunServer,
  ServerInfo,
  uploadVideo
} from '../../../../shared/extra-utils'
import { setAccessTokensToServers } from '../../../../shared/extra-utils/index'
import { VideoDetails } from '../../../../shared/models/videos'
import * as WebTorrent from 'webtorrent'

describe('Test tracker', function () {
  let server: ServerInfo
  let badMagnet: string
  let goodMagnet: string

  before(async function () {
    this.timeout(60000)
    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    {
      const res = await uploadVideo(server.url, server.accessToken, {})
      const videoUUID = res.body.video.uuid

      const resGet = await getVideo(server.url, videoUUID)
      const video: VideoDetails = resGet.body
      goodMagnet = video.files[0].magnetUri

      const parsed = magnetUtil.decode(goodMagnet)
      parsed.infoHash = '010597bb88b1968a5693a4fa8267c592ca65f2e9'

      badMagnet = magnetUtil.encode(parsed)
    }
  })

  it('Should return an error when adding an incorrect infohash', function (done) {
    this.timeout(10000)
    const webtorrent = new WebTorrent()

    const torrent = webtorrent.add(badMagnet)

    torrent.on('error', done)
    torrent.on('warning', warn => {
      const message = typeof warn === 'string' ? warn : warn.message
      if (message.indexOf('Unknown infoHash ') !== -1) return done()
    })

    torrent.on('done', () => done(new Error('No error on infohash')))
  })

  it('Should succeed with the correct infohash', function (done) {
    this.timeout(10000)
    const webtorrent = new WebTorrent()

    const torrent = webtorrent.add(goodMagnet)

    torrent.on('error', done)
    torrent.on('warning', warn => {
      const message = typeof warn === 'string' ? warn : warn.message
      if (message.indexOf('Unknown infoHash ') !== -1) return done(new Error('Error on infohash'))
    })

    torrent.on('done', done)
  })

  it('Should disable the tracker', function (done) {
    this.timeout(20000)

    killallServers([ server ])
    reRunServer(server, { tracker: { enabled: false } })
      .then(() => {
        const webtorrent = new WebTorrent()

        const torrent = webtorrent.add(goodMagnet)

        torrent.on('error', done)
        torrent.on('warning', warn => {
          const message = typeof warn === 'string' ? warn : warn.message
          if (message.indexOf('disabled ') !== -1) return done()
        })

        torrent.on('done', () => done(new Error('Tracker is enabled')))
      })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
