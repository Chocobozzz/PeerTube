/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoPlaylistPrivacy } from '@peertube/peertube-models'
import {
  PeerTubeServer,
  cleanupTests,
  createMultipleServers,
  makeActivityPubGetRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import {
  activityPubContextify,
  buildGlobalHTTPHeaders,
  getAPPublicValue
} from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { ACTIVITY_PUB, HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { makePOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

function fakeFilter () {
  return (data: any) => Promise.resolve(data)
}

describe('Test ActivityPub activities processed out of order', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[] = []

  let remoteActorUrl: string
  let remoteActorPrivateKey: string

  // Send an Update of an object of server 2 to server 1
  async function sendUpdate (object: any, contextType: 'Video' | 'Playlist') {
    const activity = {
      type: 'Update',
      id: remoteActorUrl + '/updates/' + new Date().toISOString() + '-' + Math.random(),
      actor: remoteActorUrl,
      to: [ getAPPublicValue() ],
      object
    }

    const body = await activityPubContextify(activity, contextType, fakeFilter())
    const headers = {
      ...buildGlobalHTTPHeaders(body, buildDigest),

      'content-type': 'application/activity+json',
      'accept': ACTIVITY_PUB.ACCEPT_HEADER
    }

    const httpSignature = { keyId: remoteActorUrl, key: remoteActorPrivateKey, headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD }

    await makePOSTAPRequest(servers[0].url + '/inbox', body, httpSignature, headers)
  }

  async function getAPObject (path: string) {
    const { body } = await makeActivityPubGetRequest(servers[1].url, path)
    delete body['@context']

    return body
  }

  function shiftDate (date: string, ms: number) {
    return new Date(new Date(date).getTime() + ms).toISOString()
  }

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(3)
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    sqlCommands = servers.map(s => new SQLCommand(s))

    remoteActorUrl = servers[1].url + '/accounts/peertube'

    // Sign activities form server 2 instance actor
    const [ row ] = await sqlCommands[1].selectQuery<{ privateKey: string }>(
      'SELECT "privateKey" FROM "actor" WHERE "url" = :url',
      { url: remoteActorUrl }
    )
    remoteActorPrivateKey = row.privateKey

    await servers[0].follows.follow({ hosts: [ servers[1].url ] })
    await waitJobs(servers)
  })

  describe('Video updates', function () {
    let uuid: string
    let videoObject: any

    before(async function () {
      this.timeout(60000)

      uuid = (await servers[1].videos.quickUpload({ name: 'video' })).uuid
      await waitJobs(servers)

      videoObject = await getAPObject('/videos/watch/' + uuid)
    })

    it('Should apply the newest of concurrent updates', async function () {
      this.timeout(60000)

      const updates = [ 3, 0, 4, 1, 2 ].map(i => {
        return sendUpdate({ ...videoObject, name: 'name ' + i, updated: shiftDate(videoObject.updated, (i + 1) * 1000) }, 'Video')
      })
      await Promise.all(updates)

      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.name).to.equal('name 4')
    })

    it('Should skip an update older than the stored state', async function () {
      this.timeout(60000)

      await sendUpdate({ ...videoObject, name: 'stale name', updated: shiftDate(videoObject.updated, 500) }, 'Video')
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.name).to.equal('name 4')
    })

    it('Should apply an update with the same date than the stored state', async function () {
      this.timeout(60000)

      await sendUpdate({ ...videoObject, name: 'same date', updated: shiftDate(videoObject.updated, 5 * 1000) }, 'Video')
      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.name).to.equal('same date')
    })
  })

  describe('Playlist updates', function () {
    let uuid: string
    let playlistObject: any

    before(async function () {
      this.timeout(60000)

      const created = await servers[1].playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: servers[1].store.channel.id
        }
      })
      uuid = created.uuid

      await waitJobs(servers)

      playlistObject = await getAPObject('/video-playlists/' + uuid)
    })

    it('Should apply the newest of concurrent updates', async function () {
      this.timeout(60000)

      const updates = [ 2, 4, 0, 3, 1 ].map(i => {
        return sendUpdate({ ...playlistObject, name: 'name ' + i, updated: shiftDate(playlistObject.updated, (i + 1) * 1000) }, 'Playlist')
      })
      await Promise.all(updates)

      await waitJobs(servers)

      const playlist = await servers[0].playlists.get({ playlistId: uuid })
      expect(playlist.displayName).to.equal('name 4')
    })

    it('Should skip an update older than the stored state', async function () {
      this.timeout(60000)

      await sendUpdate({ ...playlistObject, name: 'stale name', updated: shiftDate(playlistObject.updated, 500) }, 'Playlist')
      await waitJobs(servers)

      const playlist = await servers[0].playlists.get({ playlistId: uuid })
      expect(playlist.displayName).to.equal('name 4')
    })

    it('Should apply an update with the same date than the stored state', async function () {
      this.timeout(60000)

      await sendUpdate({ ...playlistObject, name: 'same date', updated: shiftDate(playlistObject.updated, 5 * 1000) }, 'Playlist')
      await waitJobs(servers)

      const playlist = await servers[0].playlists.get({ playlistId: uuid })
      expect(playlist.displayName).to.equal('same date')
    })
  })

  describe('Local updates', function () {
    let uuid: string

    before(async function () {
      this.timeout(60000)

      uuid = (await servers[1].videos.quickUpload({ name: 'local video' })).uuid
      await waitJobs(servers)
    })

    it('Should federate updates made in quick succession with increasing dates', async function () {
      this.timeout(60000)

      const dates: string[] = []

      for (let i = 0; i < 5; i++) {
        await servers[1].videos.update({ id: uuid, attributes: { name: 'local name ' + i } })

        // AP endpoint is cached
        const [ row ] = await sqlCommands[1].selectQuery<{ updatedAt: string }>(
          'SELECT "updatedAt" FROM "video" WHERE "uuid" = :uuid',
          { uuid }
        )
        dates.push(row.updatedAt)
      }

      for (let i = 1; i < dates.length; i++) {
        expect(new Date(dates[i]).getTime()).to.be.above(new Date(dates[i - 1]).getTime())
      }

      await waitJobs(servers)

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.name).to.equal('local name 4')
    })
  })

  describe('Follow accepted after an unfollow', function () {
    before(async function () {
      this.timeout(60000)

      await servers[1].config.updateExistingConfig({ newConfig: { followers: { instance: { manualApproval: true } } } })

      await servers[2].follows.follow({ hosts: [ servers[1].url ] })
      await waitJobs(servers)
    })

    it('Should have a pending follower', async function () {
      const { data } = await servers[1].follows.getFollowers({ state: 'pending' })

      expect(data).to.have.lengthOf(1)
      expect(data[0].follower.host).to.equal(servers[2].host)
    })

    it('Should send an undo follow when the follow is accepted but does not exist anymore', async function () {
      this.timeout(60000)

      // Simulate an undo follow processed before the follow by the target
      await sqlCommands[2].deleteAll('actorFollow')

      await servers[1].follows.acceptFollower({ follower: 'peertube@' + servers[2].host })
      await waitJobs(servers)

      const { data } = await servers[1].follows.getFollowers()
      expect(data.map(f => f.follower.host)).to.not.include(servers[2].host)
    })
  })

  after(async function () {
    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
})
