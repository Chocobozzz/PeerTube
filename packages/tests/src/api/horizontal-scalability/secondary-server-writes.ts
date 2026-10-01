/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { wait } from '@peertube/peertube-core-utils'
import {
  AbuseState,
  CustomConfig,
  HttpStatusCode,
  Job,
  LiveVideoError,
  RunnerJobState,
  UserExportState,
  VideoEmbedPrivacyPolicy,
  VideoImportState,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSecondaryServer,
  createSingleServer,
  makeGetRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testFfmpegStreamError,
  waitJobs
} from '@peertube/peertube-server-commands'
import { FIXTURE_URLS } from '@tests/shared/fixture-urls.js'
import { generateHighBitrateVideo } from '@tests/shared/generate.js'
import { uploadForTranscription } from '@tests/shared/transcription.js'
import { expect } from 'chai'

describe('Test the write endpoints of a secondary server process', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  let primary: PeerTubeServer
  let secondary: PeerTubeServer

  let videoUUID: string
  let videoId: number

  let userToken: string

  before(async function () {
    this.timeout(120000)

    await objectStorage.prepareDefaultMockBuckets()

    primary = await createSingleServer(1, objectStorage.getDefaultMockConfig())

    await setAccessTokensToServers([ primary ])
    await setDefaultVideoChannel([ primary ])
    ;({ uuid: videoUUID, id: videoId } = await primary.videos.quickUpload({ name: 'video written by the secondary' }))

    userToken = await primary.users.generateUserAndToken('user_1')

    secondary = await createSecondaryServer(primary)
  })

  // The secondary applies the configuration published by the primary asynchronously
  async function waitUntilSecondaryConfig (check: (config: CustomConfig) => boolean) {
    for (let i = 0; i < 100; i++) {
      if (check(await secondary.config.getCustomConfig())) return

      await wait(100)
    }

    throw new Error('The secondary did not apply the configuration published by the primary')
  }

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

  describe('Video management', function () {
    it('Should update the player settings of a video and a channel on the secondary', async function () {
      await secondary.playerSettings.updateForVideo({ videoId: videoUUID, theme: 'galaxy' })
      await secondary.playerSettings.updateForChannel({ channelHandle: primary.store.channel.name, theme: 'lucide' })

      {
        const { theme } = await primary.playerSettings.getForVideo({ videoId: videoUUID, raw: true, token: primary.accessToken })
        expect(theme).to.equal('galaxy')
      }

      {
        const { theme } = await primary.playerSettings.getForChannel({
          channelHandle: primary.store.channel.name,
          raw: true,
          token: primary.accessToken
        })
        expect(theme).to.equal('lucide')
      }
    })

    it('Should get the stats of a video on the secondary', async function () {
      await primary.views.simulateView({ id: videoUUID })
      await waitJobs([ primary ])

      expect(await secondary.videoStats.getOverallStats({ videoId: videoUUID }))
        .to.deep.equal(await primary.videoStats.getOverallStats({ videoId: videoUUID }))

      expect(await secondary.videoStats.getUserAgentStats({ videoId: videoUUID }))
        .to.deep.equal(await primary.videoStats.getUserAgentStats({ videoId: videoUUID }))

      expect(await secondary.videoStats.getRetentionStats({ videoId: videoUUID }))
        .to.deep.equal(await primary.videoStats.getRetentionStats({ videoId: videoUUID }))

      expect(await secondary.videoStats.getTimeserieStats({ videoId: videoUUID, metric: 'viewers' }))
        .to.deep.equal(await primary.videoStats.getTimeserieStats({ videoId: videoUUID, metric: 'viewers' }))
    })

    it('Should get the source of a video on the secondary', async function () {
      const source = await secondary.videos.getSource({ id: videoUUID })

      expect(source.inputFilename).to.exist
      expect(source).to.deep.equal(await primary.videos.getSource({ id: videoUUID }))
    })

    it('Should run a transcoding job requested on the secondary', async function () {
      this.timeout(120000)

      await primary.config.enableMinimumTranscoding()
      await waitUntilSecondaryConfig(c => c.transcoding.enabled === true)

      await secondary.videos.runTranscoding({ videoId: videoUUID, transcodingType: 'hls', forceTranscoding: true })

      const { state } = await primary.videos.get({ id: videoUUID })
      expect(state.id).to.equal(VideoState.TO_TRANSCODE)

      await waitJobs([ primary ])

      const video = await primary.videos.get({ id: videoUUID })
      expect(video.state.id).to.equal(VideoState.PUBLISHED)
      expect(video.streamingPlaylists).to.have.lengthOf(1)
    })

    it('Should create a transcription task requested on the secondary', async function () {
      this.timeout(120000)

      const uuid = await uploadForTranscription(primary)
      await waitJobs([ primary ])

      await primary.config.enableTranscription({ remote: true })
      await waitUntilSecondaryConfig(c => c.videoTranscription.enabled === true)

      try {
        await secondary.captions.runGenerate({ videoId: uuid })

        const { data } = await primary.runnerJobs.list({ typeOneOf: [ 'video-transcription' ] })
        const videoUUIDs = data.map(j => j.privatePayload.videoUUID)

        expect(videoUUIDs).to.include(uuid)
      } finally {
        await primary.config.disableTranscription()
      }
    })
  })

  describe('Video imports', function () {
    it('Should cancel, retry and delete a video import on the secondary', async function () {
      this.timeout(120000)

      await primary.config.enableVideoImports()

      // Paused from the secondary: the import must not be processed by the primary
      await secondary.jobs.pauseJobQueue()
      await primary.servers.waitUntilLog('Job queue paused as requested by another process.')

      try {
        const { id: importId } = await primary.videoImports.importVideo({
          attributes: { name: 'import managed by the secondary', magnetUri: FIXTURE_URLS.magnet, privacy: VideoPrivacy.PUBLIC }
        })

        {
          const { data } = await secondary.jobs.list({ state: 'waiting', jobType: 'video-import' })
          expect(data.some(j => j.data.videoImportId === importId)).to.be.true
        }

        const getState = async () => {
          const { data } = await primary.videoImports.listMyVideoImports({ id: importId })
          return data[0]?.state.id
        }

        await secondary.videoImports.cancel({ importId })
        expect(await getState()).to.equal(VideoImportState.CANCELLED)

        await secondary.videoImports.retry({ importId })
        expect(await getState()).to.equal(VideoImportState.PENDING)

        await secondary.videoImports.cancel({ importId })
        await secondary.videoImports.delete({ importId })
        expect(await getState()).to.be.undefined
      } finally {
        await secondary.jobs.resumeJobQueue()
        await primary.servers.waitUntilLog('Job queue resumed as requested by another process.')
      }

      await waitJobs([ primary ])
    })
  })

  describe('User exports', function () {
    it('Should request, list and delete a user export on the secondary', async function () {
      this.timeout(120000)

      await primary.config.enableUserExport()
      await waitUntilSecondaryConfig(c => c.export.users.enabled === true)

      const { id: userId } = await primary.users.getMyInfo({ token: userToken })

      await secondary.userExports.request({ userId, withVideoFiles: false, token: userToken })
      await primary.userExports.waitForCreation({ userId, token: userToken })

      const { data } = await secondary.userExports.list({ userId, token: userToken })
      expect(data).to.have.lengthOf(1)
      expect(data[0].state.id).to.equal(UserExportState.COMPLETED)

      await secondary.userExports.delete({ userId, exportId: data[0].id, token: userToken })

      {
        const { total } = await primary.userExports.list({ userId, token: userToken })
        expect(total).to.equal(0)
      }
    })
  })

  describe('Administration', function () {
    it('Should get the custom configuration published by the primary on the secondary', async function () {
      await primary.config.updateExistingConfig({ newConfig: { instance: { name: 'name set on the primary' } } })
      await waitUntilSecondaryConfig(c => c.instance.name === 'name set on the primary')

      expect(await secondary.config.getCustomConfig()).to.deep.equal(await primary.config.getCustomConfig())
    })

    it('Should list video redundancies on the secondary', async function () {
      const { total } = await secondary.redundancy.listVideos({ target: 'remote-videos' })
      expect(total).to.equal(0)

      // The endpoint is served: the video is refused because it is local
      const res = await secondary.redundancy.addVideo({ videoId, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      expect(res.body.detail).to.equal('Cannot create a redundancy on a local video')
    })

    it('Should receive playback metrics on the secondary', async function () {
      // Observed by the OpenTelemetry exporter of the secondary
      await secondary.metrics.addPlaybackMetric({
        metrics: {
          playerMode: 'web-video',
          p2pEnabled: false,
          resolutionChanges: 0,
          errors: 0,
          bufferStalled: 0,
          downloadedBytesP2P: 0,
          downloadedBytesHTTP: 0,
          uploadedBytesP2P: 0,
          videoId
        }
      })
    })

    it('Should cancel on the secondary a job run by the primary', async function () {
      this.timeout(120000)

      await primary.config.enableTranscoding({ resolutions: 'max', hls: true, webVideo: true })

      try {
        const { uuid } = await primary.videos.upload({
          attributes: { name: 'transcoding cancelled on the secondary', fixture: await generateHighBitrateVideo() },
          waitTorrentGeneration: false
        })

        const findActiveJob = async () => {
          const { data } = await secondary.jobs.list({ state: 'active', jobType: 'video-transcoding' })

          return data.find(j => j.data?.videoUUID === uuid)
        }

        let job: Job
        while (!(job = await findActiveJob())) {
          await wait(300)
        }

        await secondary.jobs.cancel({ jobType: 'video-transcoding', jobId: job.id })

        // Only the primary runs transcoding jobs
        await primary.servers.waitUntilLog(`Job ${job.id} in queue video-transcoding cancelled`)

        while (await findActiveJob()) {
          await wait(300)
        }
      } finally {
        await primary.config.disableTranscoding()
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

    it('Should abort, error, cancel and delete a runner job on the secondary', async function () {
      this.timeout(120000)

      await primary.config.enableTranscoding({ resolutions: [ 240 ], hls: false, webVideo: true })
      await primary.config.enableRemoteTranscoding()
      const runnerToken = await primary.runners.autoRegisterRunner()

      try {
        const { uuid } = await primary.videos.quickUpload({ name: 'video of runner jobs managed by the secondary' })
        await waitJobs([ primary ])

        const { availableJobs } = await secondary.runnerJobs.requestVOD({ runnerToken })
        const jobUUID = availableJobs.find(j => JSON.stringify(j.payload).includes(uuid)).uuid

        {
          const { job } = await secondary.runnerJobs.accept({ runnerToken, jobUUID })
          await secondary.runnerJobs.abort({ runnerToken, jobUUID, jobToken: job.jobToken, reason: 'aborted on the secondary' })

          const aborted = await primary.runnerJobs.getJob({ uuid: jobUUID })
          expect(aborted.state.id).to.equal(RunnerJobState.PENDING)
        }

        {
          const { job } = await secondary.runnerJobs.accept({ runnerToken, jobUUID })
          await secondary.runnerJobs.error({ runnerToken, jobUUID, jobToken: job.jobToken, message: 'error on the secondary' })

          const errored = await primary.runnerJobs.getJob({ uuid: jobUUID })
          expect(errored.state.id).to.equal(RunnerJobState.PENDING)
          expect(errored.failures).to.equal(1)
        }

        await secondary.runnerJobs.cancelByAdmin({ jobUUID })
        expect((await primary.runnerJobs.getJob({ uuid: jobUUID })).state.id).to.equal(RunnerJobState.CANCELLED)

        await secondary.runnerJobs.deleteByAdmin({ jobUUID })
        expect(await primary.runnerJobs.getJob({ uuid: jobUUID })).to.not.exist
      } finally {
        await primary.runnerJobs.cancelAllJobs()
        await primary.config.updateExistingConfig({ newConfig: { transcoding: { remoteRunners: { enabled: false } } } })
        await primary.config.disableTranscoding()
      }
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

    it('Should create, update and get a live on the secondary', async function () {
      const { uuid } = await secondary.live.create({
        fields: { name: 'live created on the secondary', channelId: primary.store.channel.id, privacy: VideoPrivacy.PUBLIC }
      })

      await secondary.live.update({ videoId: uuid, fields: { permanentLive: true } })

      const live = await secondary.live.get({ videoId: uuid })
      expect(live.permanentLive).to.be.true
      expect(live).to.deep.equal(await primary.live.get({ videoId: uuid }))

      const { total } = await secondary.live.listSessions({ videoId: uuid })
      expect(total).to.equal(0)
    })
  })

  describe('Endpoints owned by the primary', function () {
    it('Should not serve the endpoints writing process state', async function () {
      await makeGetRequest({
        url: secondary.url,
        path: '/api/v1/server/logs',
        token: primary.accessToken,
        expectedStatus: HttpStatusCode.MISDIRECTED_REQUEST_421
      })
    })
  })

  after(async function () {
    await objectStorage.cleanupMock()

    await cleanupTests([ secondary, primary ])
  })
})
