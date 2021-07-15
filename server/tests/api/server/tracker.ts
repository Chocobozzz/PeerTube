/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await,@typescript-eslint/no-floating-promises */

import 'mocha'
import * as magnetUtil from 'magnet-uri'
import * as WebTorrent from 'webtorrent'
import { cleanupTests, flushAndRunServer, killallServers, reRunServer, ServerInfo, setAccessTokensToServers } from '@shared/extra-utils'

describe('Test tracker', function () {
  let server: ServerInfo
  let badMagnet: string
  let goodMagnet: string

  before(async function () {
    this.timeout(60000)
    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    {
      const { uuid } = await server.videosCommand.upload()
      const video = await server.videosCommand.get({ id: uuid })
      goodMagnet = video.files[0].magnetUri

      const parsed = magnetUtil.decode(goodMagnet)
      parsed.infoHash = '010597bb88b1968a5693a4fa8267c592ca65f2e9'

      badMagnet = magnetUtil.encode(parsed)
    }
  })

  it('Should succeed with the correct infohash', function (done) {
    this.timeout(10000)
    const webtorrent = new WebTorrent()

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
      .then(() => reRunServer(server, { tracker: { enabled: false } }))
      .then(() => {
        const webtorrent = new WebTorrent()

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
      .then(() => reRunServer(server))
      .then(() => {
        const webtorrent = new WebTorrent()

        const torrent = webtorrent.add(badMagnet)

        torrent.on('error', done)
        torrent.on('warning', warn => {
          const message = typeof warn === 'string' ? warn : warn.message
          if (message.includes('Unknown infoHash ')) return done()
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
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
