/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await,@typescript-eslint/no-floating-promises */

import {
  cleanupTests,
  createSingleServer,
  killallServers,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { magnetUriDecode, magnetUriEncode } from '@tests/shared/p2p.js'
import WebTorrent from 'webtorrent'

describe('Test tracker', function () {
  let server: PeerTubeServer
  let badMagnet: string
  let goodMagnet: string
  let webtorrent: WebTorrent.Instance

  before(async function () {
    this.timeout(60000)
    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    {
      const { uuid } = await server.videos.upload()
      const video = await server.videos.get({ id: uuid })
      goodMagnet = video.files[0].magnetUri

      const parsed = await magnetUriDecode(goodMagnet)
      parsed.infoHash = '010597bb88b1968a5693a4fa8267c592ca65f2e9'

      badMagnet = await magnetUriEncode(parsed)
    }
  })

  beforeEach(() => {
    webtorrent = new WebTorrent()
  })

  afterEach(() => {
    webtorrent.destroy()
  })

  it('Should succeed with the correct infohash', function (done) {
    const torrent = webtorrent.add(goodMagnet)

    torrent.on('error', done)
    torrent.on('warning', warn => {
      const message = typeof warn === 'string' ? warn : warn.message
      if (message.includes('Unknown infoHash ')) return done(new Error('Error on infohash'))
    })

    torrent.on('done', done)
  })

  it('Should disable the tracker', function (done) {
    this.timeout(20000)

    const errCb = () => done(new Error('Tracker is enabled'))

    killallServers([ server ])
      .then(() => server.run({ tracker: { enabled: false } }))
      .then(() => {
        const torrent = webtorrent.add(goodMagnet)

        torrent.on('error', done)
        torrent.on('warning', warn => {
          const message = typeof warn === 'string' ? warn : warn.message
          if (message.includes('disabled ')) {
            torrent.off('done', errCb)

            return done()
          }
        })

        torrent.on('done', errCb)
      })
  })

  it('Should return an error when adding an incorrect infohash', function (done) {
    this.timeout(20000)

    killallServers([ server ])
      .then(() => server.run())
      .then(() => {
        const torrent = webtorrent.add(badMagnet)

        torrent.on('error', done)
        torrent.on('warning', function onWarn (warn) {
          const message = typeof warn === 'string' ? warn : warn.message
          if (message.includes('Unknown infoHash ')) {
            torrent.off('warning', onWarn)

            return done()
          }
        })

        torrent.on('done', () => done(new Error('No error on infohash')))
      })
  })

  it('Should block the IP after the failed infohash', function (done) {
    const webtorrent = new WebTorrent()

    const torrent = webtorrent.add(goodMagnet)

    torrent.on('error', done)
    torrent.on('warning', warn => {
      const message = typeof warn === 'string' ? warn : warn.message
      if (message.includes('Unsupported tracker protocol')) return done()
      if (message.includes('Error connecting')) return done()
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
