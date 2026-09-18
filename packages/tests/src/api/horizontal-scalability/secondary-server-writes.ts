/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import { AbuseState, HttpStatusCode, LiveVideoError, VideoEmbedPrivacyPolicy, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makeDeleteRequest,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testFfmpegStreamError,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test the write endpoints of a secondary server process', function () {
  let primary: PeerTubeServer
  let secondary: PeerTubeServer

  let videoUUID: string
  let videoId: number

  let userToken: string

  before(async function () {
    this.timeout(120000)

    primary = await createSingleServer(1)

    await setAccessTokensToServers([ primary ])
    await setDefaultVideoChannel([ primary ])
    ;({ uuid: videoUUID, id: videoId } = await primary.videos.quickUpload({ name: 'video written by the secondary' }))

    userToken = await primary.users.generateUserAndToken('user_1')

    secondary = await createSecondaryServer(primary)
  })

  describe('Video interactions', function () {
    it('Should rate a video on the secondary', async function () {
      await secondary.videos.rate({ id: videoUUID, rating: 'like', token: userToken })

      const video = await primary.videos.get({ id: videoUUID })
      expect(video.likes).to.equal(1)
    })

    it('Should comment a video on the secondary', async function () {
      const thread = await secondary.comments.createThread({ videoId: videoUUID, text: 'thread from the secondary', token: userToken })
      const reply = await secondary.comments.addReply({
        videoId: videoUUID,
        toCommentId: thread.id,
        text: 'reply from the secondary',
        token: userToken
      })

      {
        const tree = await primary.comments.getThread({ videoId: videoUUID, threadId: thread.id })

        expect(tree.comment.text).to.equal('thread from the secondary')
        expect(tree.children).to.have.lengthOf(1)
        expect(tree.children[0].comment.text).to.equal('reply from the secondary')
      }

      await secondary.comments.delete({ videoId: videoUUID, commentId: reply.id, token: userToken })

      {
        const tree = await primary.comments.getThread({ videoId: videoUUID, threadId: thread.id })
        expect(tree.children[0].comment.isDeleted).to.be.true
      }
    })

    it('Should report and moderate an abuse on the secondary', async function () {
      const { abuse } = await secondary.abuses.report({ videoId, reason: 'reported on the secondary', token: userToken })

      await secondary.abuses.update({ abuseId: abuse.id, body: { state: AbuseState.ACCEPTED } })
      await secondary.abuses.addMessage({ abuseId: abuse.id, message: 'message from the secondary' })

      const { data } = await primary.abuses.getAdminList({ id: abuse.id })
      expect(data).to.have.lengthOf(1)
      expect(data[0].reason).to.equal('reported on the secondary')
      expect(data[0].state.id).to.equal(AbuseState.ACCEPTED)

      const messages = await primary.abuses.listMessages({ abuseId: abuse.id })
      expect(messages.data.map(m => m.message)).to.deep.equal([ 'message from the secondary' ])
    })

    it('Should update the chapters and the embed privacy of a video on the secondary', async function () {
      await secondary.chapters.update({ videoId: videoUUID, chapters: [ { timecode: 1, title: 'chapter from the secondary' } ] })
      await secondary.videoEmbedPrivacy.update({
        videoId: videoUUID,
        policy: VideoEmbedPrivacyPolicy.ALLOWLIST,
        domains: [ 'example.com' ]
      })

      const { chapters } = await primary.chapters.list({ videoId: videoUUID })
      expect(chapters.map(c => c.title)).to.deep.equal([ 'chapter from the secondary' ])

      const embedPrivacy = await primary.videoEmbedPrivacy.get({ videoId: videoUUID })
      expect(embedPrivacy.policy.id).to.equal(VideoEmbedPrivacyPolicy.ALLOWLIST)
      expect(embedPrivacy.domains).to.deep.equal([ 'example.com' ])
    })

    it('Should add a video password on the secondary', async function () {
      const { uuid } = await primary.videos.upload({
        attributes: { name: 'password protected', privacy: VideoPrivacy.PASSWORD_PROTECTED, videoPasswords: [ 'password1' ] }
      })

      await secondary.videoPasswords.addOne({ videoId: uuid, password: 'password2' })

      const { data } = await primary.videoPasswords.list({ videoId: uuid })
      expect(data.map(p => p.password)).to.have.members([ 'password1', 'password2' ])
    })

    it('Should request a video ownership change on the secondary', async function () {
      await secondary.changeOwnership.createVideo({ videoId: videoUUID, username: 'user_1' })

      const { data } = await primary.changeOwnership.listVideos({ token: userToken })
      expect(data).to.have.lengthOf(1)
      expect(data[0].video.uuid).to.equal(videoUUID)
    })

    it('Should update and remove a blacklist entry on the secondary', async function () {
      await primary.blacklist.add({ videoId: videoUUID })

      await secondary.blacklist.update({ videoId: videoUUID, reason: 'updated on the secondary' })

      {
        const { data } = await primary.blacklist.list()
        expect(data[0].reason).to.equal('updated on the secondary')
      }

      await secondary.blacklist.remove({ videoId: videoUUID })

      {
        const { total } = await primary.blacklist.list()
        expect(total).to.equal(0)
      }
    })
  })

  describe('Watched words', function () {
    it('Should use on the primary a watched words list updated on the secondary', async function () {
      this.timeout(60000)

      const { watchedWordsList } = await primary.watchedWordsLists.createList({ listName: 'fruits', words: [ 'apple' ] })

      // Put the watched words of the platform in the regex cache of the primary
      await primary.comments.createThread({ videoId: videoUUID, text: 'an apple' })
      await waitJobs([ primary ])

      await secondary.watchedWordsLists.updateList({ listId: watchedWordsList.id, words: [ 'banana' ] })
      await waitJobs([ primary ])

      await primary.comments.createThread({ videoId: videoUUID, text: 'a banana' })
      await waitJobs([ primary ])

      const { data } = await primary.comments.listForAdmin()
      expect(data.find(c => c.text === 'a banana').automaticTags).to.deep.equal([ 'fruits' ])
      expect(data.find(c => c.text === 'an apple').automaticTags).to.have.lengthOf(0)
    })
  })

  describe('Users', function () {
    it('Should create, update and block a user on the secondary', async function () {
      const { id } = await secondary.users.create({ username: 'created_on_secondary', password: 'super_password' })

      await secondary.users.update({ userId: id, videoQuota: 42 })

      {
        const user = await primary.users.get({ userId: id })
        expect(user.videoQuota).to.equal(42)
      }

      await primary.login.getAccessToken({ username: 'created_on_secondary', password: 'super_password' })

      await secondary.users.banUser({ userId: id })

      await primary.login.login({
        user: { username: 'created_on_secondary', password: 'super_password' },
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })

    it('Should update my information on the secondary', async function () {
      await secondary.users.updateMe({ token: userToken, displayName: 'updated on the secondary' })

      const me = await primary.users.getMyInfo({ token: userToken })
      expect(me.account.displayName).to.equal('updated on the secondary')
    })

    it('Should mark my notifications as read on the secondary', async function () {
      // The abuse and the ownership change of the previous tests notified the user
      {
        const { total } = await primary.notifications.list({ token: userToken, unread: true })
        expect(total).to.be.above(0)
      }

      await secondary.notifications.markAsReadAll({ token: userToken })

      {
        const { total } = await primary.notifications.list({ token: userToken, unread: true })
        expect(total).to.equal(0)
      }
    })

    it('Should mute an account on the secondary', async function () {
      await secondary.blocklist.addToMyBlocklist({ token: userToken, account: 'root' })

      const { data } = await primary.blocklist.listMyAccountBlocklist({ token: userToken, start: 0, count: 10 })
      expect(data.map(b => b.blockedAccount.name)).to.deep.equal([ 'root' ])

      await secondary.blocklist.removeFromMyBlocklist({ token: userToken, account: 'root' })
    })

    it('Should subscribe to a channel on the secondary', async function () {
      await secondary.subscriptions.add({ token: userToken, targetUri: 'root_channel@' + primary.host })
      await waitJobs([ primary ])

      const { data } = await primary.subscriptions.list({ token: userToken })
      expect(data.map(c => c.name)).to.deep.equal([ 'root_channel' ])
    })
  })

  describe('Channels', function () {
    it('Should create and update a channel on the secondary', async function () {
      await secondary.channels.create({ token: userToken, attributes: { name: 'channel_on_secondary' } })
      await secondary.channels.update({
        token: userToken,
        channelName: 'channel_on_secondary',
        attributes: { displayName: 'updated on the secondary' }
      })

      const channel = await primary.channels.get({ channelName: 'channel_on_secondary' })
      expect(channel.displayName).to.equal('updated on the secondary')
    })
  })

  describe('Instance moderation', function () {
    it('Should block an account for the platform on the secondary', async function () {
      await secondary.blocklist.addToServerBlocklist({ account: 'user_1' })

      const { data } = await primary.blocklist.listServerAccountBlocklist({ start: 0, count: 10 })
      expect(data.map(b => b.blockedAccount.name)).to.deep.equal([ 'user_1' ])

      await secondary.blocklist.removeFromServerBlocklist({ account: 'user_1' })
    })
  })

  describe('Instance homepage', function () {
    it('Should report on the secondary a homepage created on the primary', async function () {
      {
        const config = await secondary.config.getConfig()
        expect(config.homepage.enabled).to.be.false
      }

      await primary.customPage.updateInstanceHomepage({ content: '<h1>Homepage</h1>' })

      await expectHomepageEnabled(secondary, true)
    })

    it('Should report on the primary a homepage removed on the secondary', async function () {
      await secondary.customPage.updateInstanceHomepage({ content: '' })

      const { content } = await primary.customPage.getInstanceHomepage()
      expect(content).to.equal('')

      await expectHomepageEnabled(primary, false)
    })

    // The change is broadcasted asynchronously through Redis
    async function expectHomepageEnabled (server: PeerTubeServer, enabled: boolean) {
      for (let i = 0; i < 50; i++) {
        const config = await server.config.getConfig()
        if (config.homepage.enabled === enabled) return

        await wait(100)
      }

      const config = await server.config.getConfig()
      expect(config.homepage.enabled).to.equal(enabled)
    }
  })

  describe('Runners', function () {
    it('Should register a runner and request jobs on the secondary', async function () {
      await secondary.runnerRegistrationTokens.generate()

      const { data } = await secondary.runnerRegistrationTokens.list()
      const registrationToken = data[0].registrationToken

      const { runnerToken } = await secondary.runners.register({ name: 'runner on secondary', registrationToken })

      {
        const { data } = await primary.runners.list()
        expect(data.map(r => r.name)).to.contain('runner on secondary')
      }

      const { availableJobs } = await secondary.runnerJobs.request({ runnerToken })
      expect(availableJobs).to.be.an('array')
    })
  })

  describe('Lives', function () {
    it('Should stop on the primary the session of a live blacklisted on the secondary', async function () {
      this.timeout(120000)

      await primary.config.enableLive({ allowReplay: false, transcoding: false })

      const { video: { uuid } } = await primary.live.quickCreate({ saveReplay: false, permanentLive: true })

      const ffmpegCommand = await primary.live.sendRTMPStreamInVideo({ videoId: uuid })
      await primary.live.waitUntilPublished({ videoId: uuid })

      // The secondary does not run the live server: the primary stops the session when it receives the Redis signal
      await Promise.all([
        secondary.blacklist.add({ videoId: uuid, reason: 'blacklisted on the secondary' }),
        testFfmpegStreamError(ffmpegCommand, true)
      ])

      await waitJobs([ primary ])

      const session = await primary.live.findLatestSession({ videoId: uuid })
      expect(session.endDate).to.exist
      expect(session.error).to.equal(LiveVideoError.BLACKLISTED)
    })
  })

  describe('Endpoints owned by the primary', function () {
    it('Should not serve the endpoints writing process state', async function () {
      await makeDeleteRequest({
        url: secondary.url,
        path: '/api/v1/server/following/' + primary.host,
        token: primary.accessToken,
        expectedStatus: HttpStatusCode.BAD_REQUEST_400
      })
    })
  })

  after(async function () {
    await cleanupTests([ secondary, primary ])
  })
})
