import { getAllFiles } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { MockFiles } from '@tests/shared/mock-servers/mock-files.js'
import { buildPersonActor, loadAPKeys, trySignedPOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'
import { readFile } from 'fs/promises'

describe('Test ActivityPub content type confusion', function () {
  let servers: PeerTubeServer[]
  let remoteSQLCommand: SQLCommand
  let mock: MockFiles
  let mockUrl: string

  let videoUUID: string
  let videoUrl: string

  const keys = loadAPKeys()

  function buildActor (url: string) {
    return JSON.stringify({
      '@context': [ 'https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1' ],
      ...buildPersonActor({ id: url, inbox: mockUrl + '/inbox', publicKey: keys.publicKey })
    })
  }

  function sendLikeSignedBy (actorUrl: string) {
    return trySignedPOSTAPRequest({
      url: servers[0].url + '/inbox',
      activity: { type: 'Like', id: actorUrl + '/likes/' + new Date().getTime(), actor: actorUrl, object: videoUrl },
      contextType: 'Rate',
      keyId: actorUrl,
      privateKey: keys.privateKey
    })
  }

  before(async function () {
    this.timeout(120000)

    mock = new MockFiles()
    mockUrl = 'http://127.0.0.1:' + await mock.initialize()

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)
    await doubleFollow(servers[0], servers[1])

    remoteSQLCommand = new SQLCommand(servers[1])

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoUUID = uuid

    await servers[0].captions.add({ language: 'en', videoId: videoUUID, fixture: 'subtitle-good1.vtt' })
    await waitJobs(servers)

    videoUrl = servers[0].url + '/videos/watch/' + videoUUID
  })

  describe('When fetching a remote actor', function () {
    it('Should reject an actor served with a non ActivityPub content type', async function () {
      const actorUrl = mockUrl + '/captions/actor.vtt'
      mock.setFile('/captions/actor.vtt', 'text/vtt', buildActor(actorUrl))

      const statusCode = await sendLikeSignedBy(actorUrl)
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should reject an actor served with a JSON content type', async function () {
      const actorUrl = mockUrl + '/files/actor.json'
      mock.setFile('/files/actor.json', 'application/json', buildActor(actorUrl))

      const statusCode = await sendLikeSignedBy(actorUrl)
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should reject an actor served with a JSON-LD content type without the ActivityStreams profile', async function () {
      const actorUrl = mockUrl + '/files/actor.jsonld'
      mock.setFile('/files/actor.jsonld', 'application/ld+json', buildActor(actorUrl))

      const statusCode = await sendLikeSignedBy(actorUrl)
      expect(statusCode).to.equal(HttpStatusCode.FORBIDDEN_403)
    })

    it('Should accept an actor served with an ActivityPub content type', async function () {
      {
        const actorUrl = mockUrl + '/accounts/activity'
        mock.setFile('/accounts/activity', 'application/activity+json; charset=utf-8', buildActor(actorUrl))

        const statusCode = await sendLikeSignedBy(actorUrl)
        expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)
      }

      {
        const actorUrl = mockUrl + '/accounts/ld'
        mock.setFile('/accounts/ld', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"', buildActor(actorUrl))

        const statusCode = await sendLikeSignedBy(actorUrl)
        expect(statusCode).to.equal(HttpStatusCode.NO_CONTENT_204)
      }

      await waitJobs(servers)
    })
  })

  describe('When serving remote files', function () {
    it('Should not serve a remote caption that is not a VTT file', async function () {
      const { data } = await servers[1].captions.list({ videoId: videoUUID })
      const captionUrl = data[0].fileUrl
      expect(captionUrl).to.contain(servers[1].url + '/lazy-static/video-captions/')

      await remoteSQLCommand.setVideoCaptionFileUrlOf(videoUUID, mockUrl + '/remote/caption.vtt')

      mock.setFile('/remote/caption.vtt', 'text/vtt', buildActor(captionUrl))
      await makeRawRequest({ url: captionUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      mock.setFile('/remote/caption.vtt', 'text/vtt', await readFile(buildAbsoluteFixturePath('subtitle-good1.vtt')))
      const res = await makeRawRequest({ url: captionUrl, expectedStatus: HttpStatusCode.OK_200 })
      expect(res.text).to.contain('WEBVTT')
    })

    it('Should not proxify a remote torrent that is not a torrent file', async function () {
      const video = await servers[1].videos.get({ id: videoUUID })
      const torrentUrl = getAllFiles(video)[0].torrentUrl
      expect(torrentUrl).to.contain(servers[1].url + '/lazy-static/torrents/')

      await remoteSQLCommand.setVideoFileTorrentUrlOf(videoUUID, mockUrl + '/remote/file.torrent')

      mock.setFile('/remote/file.torrent', 'application/x-bittorrent', buildActor(torrentUrl))
      await makeRawRequest({ url: torrentUrl, expectedStatus: HttpStatusCode.BAD_GATEWAY_502 })

      mock.setFile('/remote/file.torrent', 'application/x-bittorrent', await readFile(buildAbsoluteFixturePath('video-720p.torrent')))
      await makeRawRequest({ url: torrentUrl, expectedStatus: HttpStatusCode.OK_200 })
    })
  })

  after(async function () {
    await mock.terminate()
    await remoteSQLCommand.cleanup()

    await cleanupTests(servers)
  })
})
