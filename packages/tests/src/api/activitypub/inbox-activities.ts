/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { ContextType, HttpStatusCode, VideoPlaylistPrivacy } from '@peertube/peertube-models'
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
  getAPPublicValue,
  signAndContextify
} from '@peertube/peertube-server/core/helpers/activity-pub-utils.js'
import { buildDigest } from '@peertube/peertube-server/core/helpers/peertube-crypto.js'
import { signJsonLDObject } from '@peertube/peertube-server/core/helpers/peertube-jsonld.js'
import { HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { fakeContextFilter, makePOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

describe('Test the checks on incoming ActivityPub activities', function () {
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[]

  let videoUUID: string
  let videoUrl: string

  async function sendActivity (options: {
    fromServerIndex: number
    actorUrl: string
    activity: any
    contextType: ContextType
    ldSigned?: boolean
  }) {
    const { fromServerIndex, actorUrl, activity, contextType, ldSigned = false } = options

    const privateKey = await sqlCommands[fromServerIndex].getActorPrivateKey(actorUrl)

    const body = ldSigned
      ? await signAndContextify({
        byActor: { url: actorUrl, privateKey } as any,
        data: activity,
        contextType,
        contextFilter: fakeContextFilter(),
        signerFunction: (o: Parameters<typeof signJsonLDObject>[0]) => signJsonLDObject({ ...o, disableWorkerThreadAssertion: true })
      })
      : await activityPubContextify(activity, contextType, fakeContextFilter())

    const httpSignature = { keyId: actorUrl, key: privateKey, headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD }

    await makePOSTAPRequest(servers[0].url + '/inbox', body, httpSignature, buildGlobalHTTPHeaders(body, buildDigest))
    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(3)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    sqlCommands = servers.map(s => new SQLCommand(s))

    await servers[1].follows.follow({ hosts: [ servers[0].host ] })
    await servers[2].follows.follow({ hosts: [ servers[0].host ] })
    await servers[0].follows.follow({ hosts: [ servers[2].host ] })

    await servers[0].config.enableTranscoding({ hls: true, webVideo: false })

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoUUID = uuid
    videoUrl = servers[0].url + '/videos/watch/' + uuid

    await waitJobs(servers)
  })

  describe('Rates', function () {
    let victimRateUrl: string
    let victimAccountId: number

    function buildLike (id: string, actor: string) {
      return { type: 'Like', id, actor, object: videoUrl, to: [ getAPPublicValue() ] }
    }

    async function expectVictimRateUntouched () {
      const rates = await sqlCommands[0].listVideoRates()

      expect(rates).to.have.lengthOf(1)
      expect(rates[0].url).to.equal(victimRateUrl)
      expect(rates[0].accountId).to.equal(victimAccountId)

      const video = await servers[0].videos.get({ id: videoUUID })
      expect(video.likes).to.equal(1)
    }

    before(async function () {
      this.timeout(60000)

      await servers[1].videos.rate({ id: videoUUID, rating: 'like' })
      await waitJobs(servers)

      const rates = await sqlCommands[0].listVideoRates()
      expect(rates).to.have.lengthOf(1)

      victimRateUrl = rates[0].url
      victimAccountId = rates[0].accountId
    })

    it('Should not undo the like of another account from another host', async function () {
      this.timeout(30000)

      const actor = servers[2].url + '/accounts/peertube'

      await sendActivity({
        fromServerIndex: 2,
        actorUrl: actor,
        contextType: 'Rate',
        activity: { type: 'Undo', id: actor + '/undo/1', actor, to: [ getAPPublicValue() ], object: buildLike(victimRateUrl, actor) }
      })

      await expectVictimRateUntouched()
    })

    it('Should not take over the like of another account from another host', async function () {
      this.timeout(30000)

      const actor = servers[2].url + '/accounts/peertube'

      await sendActivity({ fromServerIndex: 2, actorUrl: actor, contextType: 'Rate', activity: buildLike(victimRateUrl, actor) })

      await expectVictimRateUntouched()
    })

    it('Should not undo the like of another account of the same host', async function () {
      this.timeout(30000)

      await servers[1].users.generate('attacker')
      const actor = servers[1].url + '/accounts/attacker'

      await sendActivity({
        fromServerIndex: 1,
        actorUrl: actor,
        contextType: 'Rate',
        activity: { type: 'Undo', id: actor + '/undo/1', actor, to: [ getAPPublicValue() ], object: buildLike(victimRateUrl, actor) }
      })

      await expectVictimRateUntouched()
    })

    it('Should undo its own like', async function () {
      this.timeout(30000)

      await servers[1].videos.rate({ id: videoUUID, rating: 'none' })
      await waitJobs(servers)

      expect(await sqlCommands[0].listVideoRates()).to.have.lengthOf(0)
    })
  })

  describe('Follows of a channel whose owner muted the follower', function () {
    const channelName = 'owner_channel'
    let ownerToken: string

    before(async function () {
      this.timeout(30000)

      // Also creates the default channel of the user
      ownerToken = await servers[0].users.generateUserAndToken('owner')

      await servers[0].blocklist.addToMyBlocklist({ token: ownerToken, account: 'root@' + servers[1].host })
    })

    it('Should reject the follow of a muted account and accept the others', async function () {
      this.timeout(30000)

      await servers[1].subscriptions.add({ targetUri: channelName + '@' + servers[0].host })
      await servers[2].subscriptions.add({ targetUri: channelName + '@' + servers[0].host })
      await waitJobs(servers)

      const { data } = await servers[0].channels.listFollowers({ token: ownerToken, channelName })

      expect(data).to.have.lengthOf(1)
      expect(data[0].follower.host).to.equal(servers[2].host)
    })
  })

  describe('Cache files', function () {
    function buildCreate (id: string, actor: string) {
      return {
        type: 'Create',
        id: actor + '/create/' + encodeURIComponent(id),
        actor,
        to: [ getAPPublicValue() ],
        object: {
          type: 'CacheFile',
          id,
          object: videoUrl,
          expires: new Date(new Date().getTime() + 3600000).toISOString(),
          url: { type: 'Link', mediaType: 'application/x-mpegURL', href: servers[2].url + '/redundancy/master.m3u8' }
        }
      }
    }

    it('Should not create a cache file whose id is on another host than the actor', async function () {
      this.timeout(30000)

      const actor = servers[2].url + '/accounts/peertube'

      await sendActivity({
        fromServerIndex: 2,
        actorUrl: actor,
        contextType: 'CacheFile',
        activity: buildCreate(servers[1].url + '/redundancy/spoofed', actor)
      })

      expect(await sqlCommands[0].listVideoRedundancyUrls()).to.have.lengthOf(0)
    })

    it('Should create a cache file whose id is on the host of the actor', async function () {
      this.timeout(30000)

      const actor = servers[2].url + '/accounts/peertube'
      const id = servers[2].url + '/redundancy/legit'

      await sendActivity({ fromServerIndex: 2, actorUrl: actor, contextType: 'CacheFile', activity: buildCreate(id, actor) })

      expect(await sqlCommands[0].listVideoRedundancyUrls()).to.deep.equal([ id ])
    })
  })

  describe('Undo announce', function () {
    it('Should forward the undo to the followers of the video', async function () {
      this.timeout(60000)

      const actor = servers[1].url + '/accounts/peertube'
      const announce = { type: 'Announce', id: actor + '/announces/1', actor, object: videoUrl, to: [ getAPPublicValue() ] }

      const sharesBefore = await sqlCommands[2].getVideoShareCount()

      await sendActivity({ fromServerIndex: 1, actorUrl: actor, contextType: 'Announce', activity: announce, ldSigned: true })
      expect(await sqlCommands[2].getVideoShareCount()).to.equal(sharesBefore + 1)

      await sendActivity({
        fromServerIndex: 1,
        actorUrl: actor,
        contextType: 'Announce',
        ldSigned: true,
        activity: { type: 'Undo', id: actor + '/undo/announces/1', actor, to: [ getAPPublicValue() ], object: announce }
      })

      expect(await sqlCommands[2].getVideoShareCount()).to.equal(sharesBefore)
    })
  })

  describe('Create with an object URL', function () {
    let playlistUUID: string
    let playlistUrl: string

    function buildCreate (objectUrl: string, actor: string) {
      return {
        type: 'Create',
        id: actor + '/create/' + encodeURIComponent(objectUrl),
        actor,
        to: [ getAPPublicValue() ],
        object: objectUrl
      }
    }

    before(async function () {
      this.timeout(60000)

      const playlist = await servers[1].playlists.create({
        attributes: {
          displayName: 'playlist by URL',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: servers[1].store.channel.id
        }
      })
      playlistUUID = playlist.uuid
      playlistUrl = servers[1].url + '/video-playlists/' + playlistUUID

      await waitJobs(servers)

      // Server 1 does not follow server 2
      await servers[0].playlists.get({ playlistId: playlistUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should not create a fetched playlist that is not on the host of the actor', async function () {
      this.timeout(30000)

      const actor = servers[2].url + '/accounts/peertube'

      await sendActivity({ fromServerIndex: 2, actorUrl: actor, contextType: 'Playlist', activity: buildCreate(playlistUrl, actor) })

      await servers[0].playlists.get({ playlistId: playlistUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should fetch and create the playlist', async function () {
      this.timeout(30000)

      const actor = servers[1].url + '/accounts/peertube'

      await sendActivity({ fromServerIndex: 1, actorUrl: actor, contextType: 'Playlist', activity: buildCreate(playlistUrl, actor) })

      const playlist = await servers[0].playlists.get({ playlistId: playlistUUID })
      expect(playlist.displayName).to.equal('playlist by URL')
    })

    it('Should fetch and create the video', async function () {
      this.timeout(60000)

      const { uuid } = await servers[1].videos.quickUpload({ name: 'video by URL' })
      await waitJobs(servers)

      await servers[0].videos.getWithToken({ id: uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      const actor = servers[1].url + '/accounts/peertube'

      await sendActivity({
        fromServerIndex: 1,
        actorUrl: actor,
        contextType: 'Video',
        activity: buildCreate(servers[1].url + '/videos/watch/' + uuid, actor)
      })

      const video = await servers[0].videos.getWithToken({ id: uuid })
      expect(video.name).to.equal('video by URL')
    })
  })

  describe('Remote video icons', function () {
    it('Should truncate the icons of a remote video', async function () {
      this.timeout(60000)

      // Server 1 follows server 3
      const { uuid } = await servers[2].videos.quickUpload({ name: 'video with many icons' })
      await waitJobs(servers)

      const { body } = await makeActivityPubGetRequest(servers[2].url, '/videos/watch/' + uuid)
      const videoObject = { ...body }
      delete videoObject['@context']

      const icon = Array.from({ length: 50 }, (_, i) => ({
        type: 'Image',
        url: `${servers[2].url}/lazy-static/thumbnails/fake-${i}.jpg`,
        mediaType: 'image/jpeg',
        width: 100 + i,
        height: 100 + i
      }))

      const actor = servers[2].url + '/accounts/peertube'

      await sendActivity({
        fromServerIndex: 2,
        actorUrl: actor,
        contextType: 'Video',
        activity: { type: 'Update', id: actor + '/updates/icons', actor, to: [ getAPPublicValue() ], object: { ...videoObject, icon } }
      })

      const video = await servers[0].videos.get({ id: uuid })
      expect(video.thumbnails).to.have.lengthOf(20)
      expect(video.thumbnails.map(t => t.width)).to.include.members([ 100, 119 ])
    })
  })

  after(async function () {
    for (const sql of sqlCommands) {
      await sql.cleanup()
    }

    await cleanupTests(servers)
  })
})
