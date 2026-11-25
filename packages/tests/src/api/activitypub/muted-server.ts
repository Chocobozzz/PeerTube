/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { HttpStatusCode } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
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
import { HTTP_SIGNATURE } from '@peertube/peertube-server/core/initializers/constants.js'
import { fakeContextFilter, makePOSTAPRequest } from '@tests/shared/requests.js'
import { SQLCommand } from '@tests/shared/sql-command.js'
import { expect } from 'chai'

describe('Test ActivityPub activities of a server muted by the instance', function () {
  // Server 1 mutes server 2, server 3 is not muted
  let servers: PeerTubeServer[]
  let sqlCommands: SQLCommand[]

  let localVideoUUID: string
  let videoBeforeMuteUUID: string
  let videoToDeleteUUID: string
  let videoWhileMutedUUID: string
  let videoServer3UUID: string

  async function announceFromServer3 (videoUrl: string, id: string) {
    const actorUrl = servers[2].url + '/accounts/peertube'
    const privateKey = await sqlCommands[2].getActorPrivateKey(actorUrl)

    const activity = { type: 'Announce', id: actorUrl + '/announces/' + id, actor: actorUrl, object: videoUrl, to: [ getAPPublicValue() ] }
    const body = await activityPubContextify(activity, 'Announce', fakeContextFilter())

    const httpSignature = { keyId: actorUrl, key: privateKey, headers: HTTP_SIGNATURE.HEADERS_TO_SIGN_WITH_PAYLOAD }
    await makePOSTAPRequest(servers[0].url + '/inbox', body, httpSignature, buildGlobalHTTPHeaders(body, buildDigest))

    await waitJobs(servers)
  }

  // Make the video outdated, so getting it triggers a refresh
  async function forceRefresh (uuid: string) {
    await sqlCommands[0].setVideoField(uuid, 'updatedAt', '2020-01-01')

    await servers[0].videos.getWithToken({ id: uuid })
    await waitJobs(servers)
  }

  before(async function () {
    this.timeout(240000)

    servers = await createMultipleServers(3)
    sqlCommands = servers.map(s => new SQLCommand(s))

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])
    await doubleFollow(servers[0], servers[2])
    await doubleFollow(servers[1], servers[2])

    localVideoUUID = (await servers[0].videos.quickUpload({ name: 'local video' })).uuid
    videoBeforeMuteUUID = (await servers[1].videos.quickUpload({ name: 'video before mute' })).uuid
    videoToDeleteUUID = (await servers[1].videos.quickUpload({ name: 'video to delete' })).uuid
    videoServer3UUID = (await servers[2].videos.quickUpload({ name: 'video server 3' })).uuid

    await waitJobs(servers)

    for (const id of [ videoBeforeMuteUUID, videoToDeleteUUID, videoServer3UUID ]) {
      await servers[0].videos.getWithToken({ id })
    }

    await servers[0].blocklist.addToServerBlocklist({ server: servers[1].host })
  })

  it('Should not federate new videos of the muted server', async function () {
    videoWhileMutedUUID = (await servers[1].videos.quickUpload({ name: 'video while muted' })).uuid
    const otherUUID = (await servers[2].videos.quickUpload({ name: 'other video server 3' })).uuid

    await waitJobs(servers)

    await servers[0].videos.getWithToken({ id: otherUUID })
    await servers[0].videos.getWithToken({ id: videoWhileMutedUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not fetch a video of the muted server announced by another server', async function () {
    await announceFromServer3(servers[1].url + '/videos/watch/' + videoWhileMutedUUID, 'muted')

    await servers[0].videos.getWithToken({ id: videoWhileMutedUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should not federate video updates of the muted server', async function () {
    await servers[1].videos.update({ id: videoBeforeMuteUUID, attributes: { name: 'video before mute updated' } })
    await waitJobs(servers)

    expect(await sqlCommands[0].getVideoField(videoBeforeMuteUUID, 'name')).to.equal('video before mute')
  })

  it('Should not refresh videos of the muted server', async function () {
    this.timeout(60000)

    await forceRefresh(videoBeforeMuteUUID)
    expect(await sqlCommands[0].getVideoField(videoBeforeMuteUUID, 'name')).to.equal('video before mute')
  })

  it('Should not federate comments of the muted server', async function () {
    // On a local video
    await servers[1].comments.createThread({ videoId: localVideoUUID, text: 'muted comment on local video' })
    // On a video of server 3, forwarded by server 3
    await servers[1].comments.createThread({ videoId: videoServer3UUID, text: 'muted comment on remote video' })
    // Control
    await servers[2].comments.createThread({ videoId: localVideoUUID, text: 'comment of server 3' })

    await waitJobs(servers)

    expect(await sqlCommands[0].countVideoCommentsByText('muted comment on local video')).to.equal(0)
    expect(await sqlCommands[0].countVideoCommentsByText('muted comment on remote video')).to.equal(0)
    expect(await sqlCommands[0].countVideoCommentsByText('comment of server 3')).to.equal(1)

    // Server 3 received the comment
    expect(await sqlCommands[2].countVideoCommentsByText('muted comment on remote video')).to.equal(1)
  })

  it('Should not fetch unknown actors of the muted server', async function () {
    // The comment is sent to our inbox, signed by an actor we don't know yet
    const token = await servers[1].users.generateUserAndToken('new_user')
    await servers[1].comments.createThread({ videoId: localVideoUUID, text: 'comment of a new user of the muted server', token })

    await waitJobs(servers)

    expect(await sqlCommands[0].countVideoCommentsByText('comment of a new user of the muted server')).to.equal(0)
    expect(await sqlCommands[0].countActorsByUrl(servers[1].url + '/accounts/new_user')).to.equal(0)
  })

  it('Should process deletions of the muted server', async function () {
    await servers[1].videos.remove({ id: videoToDeleteUUID })
    await waitJobs(servers)

    await servers[0].videos.getWithToken({ id: videoToDeleteUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  })

  it('Should federate again after unmute', async function () {
    this.timeout(60000)

    await servers[0].blocklist.removeFromServerBlocklist({ server: servers[1].host })

    // Activities received while muted have been dropped
    await servers[0].videos.getWithToken({ id: videoWhileMutedUUID, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    expect(await sqlCommands[0].countVideoCommentsByText('muted comment on local video')).to.equal(0)

    const { uuid } = await servers[1].videos.quickUpload({ name: 'video after unmute' })
    await servers[1].comments.createThread({ videoId: localVideoUUID, text: 'comment after unmute' })
    await waitJobs(servers)

    await servers[0].videos.getWithToken({ id: uuid })
    expect(await sqlCommands[0].countVideoCommentsByText('comment after unmute')).to.equal(1)

    // Videos are refreshed again
    await forceRefresh(videoBeforeMuteUUID)
    expect(await sqlCommands[0].getVideoField(videoBeforeMuteUUID, 'name')).to.equal('video before mute updated')

    // The announced video can be fetched again
    await announceFromServer3(servers[1].url + '/videos/watch/' + videoWhileMutedUUID, 'unmuted')
    await servers[0].videos.getWithToken({ id: videoWhileMutedUUID })
  })

  after(async function () {
    for (const sqlCommand of sqlCommands) {
      await sqlCommand.cleanup()
    }

    await cleanupTests(servers)
  })
})
