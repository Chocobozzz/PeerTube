/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { getAllFiles } from '@peertube/peertube-core-utils'
import {
  HttpStatusCode,
  UserNotificationType,
  VideoAIUsage,
  VideoBlacklistType,
  VideoDetails,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { checkWebTorrentWorks, fetchTorrent, getTorrentInfoHash } from '@tests/shared/p2p.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'

describe('Test video duplicate', function () {
  let servers: PeerTubeServer[] = []
  let subscriberToken: string

  async function uploadSource (name = 'source') {
    const { uuid } = await servers[0].videos.quickUpload({ name })
    await waitJobs(servers)

    return servers[0].videos.getWithToken({ id: uuid })
  }

  async function duplicate (sourceUUID: string, name?: string) {
    const { uuid } = await servers[0].videos.duplicate({ id: sourceUUID, name })
    await waitJobs(servers)

    return servers[0].videos.getWithToken({ id: uuid })
  }

  async function makePublic (uuid: string) {
    await servers[0].videos.update({ id: uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
    await waitJobs(servers)

    return servers[0].videos.get({ id: uuid })
  }

  function getFileUrls (video: VideoDetails) {
    return getAllFiles(video).map(f => f.fileUrl)
  }

  async function checkFilesAreNew (source: VideoDetails, copy: VideoDetails) {
    const sourceUrls = getFileUrls(source)
    const copyUrls = getFileUrls(copy)

    expect(copyUrls).to.have.length.above(0)

    // Public files may be served by object storage that rejects requests with an unknown authorization header
    const token = copy.privacy.id === VideoPrivacy.PUBLIC
      ? undefined
      : servers[0].accessToken

    for (const url of copyUrls) {
      expect(sourceUrls).to.not.include(url)

      await makeRawRequest({ url, token, expectedStatus: HttpStatusCode.OK_200 })
    }
  }

  before(async function () {
    this.timeout(120_000)

    servers = await createMultipleServers(2)

    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    await doubleFollow(servers[0], servers[1])

    subscriberToken = await servers[0].users.generateUserAndToken('subscriber')
    await servers[0].subscriptions.add({ token: subscriberToken, targetUri: 'root_channel@' + servers[0].host })
  })

  describe('With transcoding', function () {
    let source: VideoDetails

    before(async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding({ keepOriginal: true })

      source = await uploadSource()

      await servers[0].videos.update({
        id: source.uuid,
        attributes: { tags: [ 'tag1', 'tag2' ], description: 'my description', aiUsage: VideoAIUsage.CONTAINS_AI }
      })
      await servers[0].captions.add({ videoId: source.uuid, language: 'fr' })
      await servers[0].chapters.update({ videoId: source.uuid, chapters: [ { timecode: 1, title: 'Chapter' } ] })
      await waitJobs(servers)

      source = await servers[0].videos.getWithToken({ id: source.uuid })
    })

    it('Should create a private copy waiting for its files', async function () {
      this.timeout(120_000)

      await servers[0].jobs.pauseJobQueue()

      try {
        const { uuid } = await servers[0].videos.duplicate({ id: source.uuid })

        const copy = await servers[0].videos.getWithToken({ id: uuid })
        expect(copy.state.id).to.equal(VideoState.TO_DUPLICATE)
        expect(copy.privacy.id).to.equal(VideoPrivacy.PRIVATE)
        expect(copy.name).to.equal('source (Copy)')
        expect(copy.channel.id).to.equal(source.channel.id)
        expect(getAllFiles(copy)).to.have.lengthOf(0)
        expect(copy.thumbnails).to.have.lengthOf(source.thumbnails.length)
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }

      await waitJobs(servers)
    })

    it('Should copy all the files without transcoding them', async function () {
      this.timeout(120_000)

      const { total: transcodingJobsBefore } = await servers[0].jobs.list({ jobType: 'video-transcoding' })

      const copy = await duplicate(source.uuid)

      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.privacy.id).to.equal(VideoPrivacy.PRIVATE)
      expect(copy.duration).to.equal(source.duration)

      const { total: transcodingJobsAfter } = await servers[0].jobs.list({ jobType: 'video-transcoding' })
      expect(transcodingJobsAfter).to.equal(transcodingJobsBefore)

      const toSizes = (video: VideoDetails) => getAllFiles(video).map(f => f.resolution.id + '-' + f.size).sort()
      expect(toSizes(copy)).to.deep.equal(toSizes(source))

      await checkFilesAreNew(source, copy)

      const { data: captions } = await servers[0].captions.list({ videoId: copy.uuid, token: servers[0].accessToken })

      await completeCheckHlsPlaylist({
        servers: [ servers[0] ],
        videoUUID: copy.uuid,
        hlsOnly: false,
        resolutions: source.streamingPlaylists[0].files.map(f => f.resolution.id),
        captions
      })

      for (const file of getAllFiles(copy)) {
        const torrent = await fetchTorrent(file.torrentUrl)
        expect(torrent.infoHash).to.equal(getTorrentInfoHash(file.magnetUri))

        expect(getAllFiles(source).map(f => getTorrentInfoHash(f.magnetUri))).to.not.include(torrent.infoHash)
      }

      const sourceAfter = await servers[0].videos.getWithToken({ id: source.uuid })
      expect(sourceAfter.state.id).to.equal(VideoState.PUBLISHED)
      expect(getFileUrls(sourceAfter)).to.deep.equal(getFileUrls(source))
    })

    it('Should copy the metadata, captions, chapters and original file', async function () {
      this.timeout(120_000)

      const copy = await duplicate(source.uuid)

      expect(copy.tags).to.deep.equal(source.tags)
      expect(copy.description).to.equal(source.description)
      expect(copy.aiUsage.id).to.equal(source.aiUsage.id)

      const { chapters } = await servers[0].chapters.list({ videoId: copy.uuid })
      expect(chapters).to.deep.equal([ { timecode: 1, title: 'Chapter' } ])

      const { data: captions } = await servers[0].captions.list({ videoId: copy.uuid, token: servers[0].accessToken })
      expect(captions.map(c => c.language.id)).to.deep.equal([ 'fr' ])

      const sourceOriginal = await servers[0].videos.getSource({ id: source.uuid })
      const copyOriginal = await servers[0].videos.getSource({ id: copy.uuid })

      expect(copyOriginal.inputFilename).to.equal(sourceOriginal.inputFilename)
      expect(copyOriginal.fileDownloadUrl).to.not.equal(sourceOriginal.fileDownloadUrl)
    })

    it('Should use a custom name', async function () {
      this.timeout(120_000)

      const copy = await duplicate(source.uuid, 'my copy')
      expect(copy.name).to.equal('my copy')
    })

    it('Should federate the copy once it is public', async function () {
      this.timeout(120_000)

      const copy = await duplicate(source.uuid)

      await servers[1].videos.get({ id: copy.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })

      await makePublic(copy.uuid)

      const remote = await servers[1].videos.get({ id: copy.uuid })
      expect(remote.name).to.equal('source (Copy)')
      expect(remote.duration).to.equal(source.duration)
    })

    it('Should block the copy of a blocked video for the same reason', async function () {
      this.timeout(120_000)

      const blockedSource = await uploadSource('blocked source')
      await servers[0].blacklist.add({ videoId: blockedSource.uuid, reason: 'my reason', internalNote: 'my note', unfederate: true })
      await waitJobs(servers)

      const copy = await duplicate(blockedSource.uuid)
      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.blacklisted).to.be.true
      expect(copy.blacklistedReason).to.equal('my reason')

      const { data } = await servers[0].blacklist.list()
      const block = data.find(b => b.video.uuid === copy.uuid)
      expect(block.type).to.equal(VideoBlacklistType.MANUAL)
      expect(block.internalNote).to.equal('my note')
      expect(block.unfederated).to.be.true

      await servers[0].videos.update({ id: copy.uuid, attributes: { privacy: VideoPrivacy.PUBLIC } })
      await waitJobs(servers)

      await servers[1].videos.get({ id: copy.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    })

    it('Should copy an HLS video with separated audio', async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding({ webVideo: false, hls: true, splitAudioAndVideo: true })

      const splitSource = await uploadSource('split source')
      const copy = await duplicate(splitSource.uuid)

      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.files).to.have.lengthOf(0)

      await checkFilesAreNew(splitSource, copy)

      await completeCheckHlsPlaylist({
        servers: [ servers[0] ],
        videoUUID: copy.uuid,
        hlsOnly: true,
        splittedAudio: true,
        resolutions: splitSource.streamingPlaylists[0].files.map(f => f.resolution.id)
      })

      await servers[0].config.enableMinimumTranscoding({ keepOriginal: true })
    })

    it('Should notify subscribers when the copy is made public after its publication', async function () {
      this.timeout(120_000)

      const copy = await duplicate(source.uuid)
      expect(copy.state.id).to.equal(VideoState.PUBLISHED)

      const listNotifications = async () => {
        const { data } = await servers[0].notifications.list({
          token: subscriberToken,
          typeOneOf: [ UserNotificationType.NEW_VIDEO_FROM_SUBSCRIPTION ]
        })

        return data.filter(n => n.video.uuid === copy.uuid)
      }

      expect(await listNotifications()).to.have.lengthOf(0)

      await makePublic(copy.uuid)

      expect(await listNotifications()).to.have.lengthOf(1)
    })

    it('Should notify the owner when the duplication fails', async function () {
      this.timeout(120_000)

      const otherSource = await uploadSource('deleted source')

      await servers[0].jobs.pauseJobQueue()

      let uuid: string

      try {
        uuid = (await servers[0].videos.duplicate({ id: otherSource.uuid })).uuid

        await servers[0].videos.remove({ id: otherSource.uuid })
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }

      await waitJobs(servers)

      const copy = await servers[0].videos.getWithToken({ id: uuid })
      expect(copy.state.id).to.equal(VideoState.TO_DUPLICATE_FAILED)

      const { data } = await servers[0].notifications.list({ typeOneOf: [ UserNotificationType.MY_VIDEO_DUPLICATION_ERROR ] })
      expect(data.filter(n => n.video.uuid === uuid)).to.have.lengthOf(1)
    })

    it('Should not fail when the copy is deleted before its files are copied', async function () {
      this.timeout(120_000)

      const { total: failedBefore } = await servers[0].jobs.list({ state: 'failed' })

      await servers[0].jobs.pauseJobQueue()

      try {
        const { uuid } = await servers[0].videos.duplicate({ id: source.uuid })
        await servers[0].videos.remove({ id: uuid })
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }

      await waitJobs(servers)

      const { total: failedAfter } = await servers[0].jobs.list({ state: 'failed' })
      expect(failedAfter).to.equal(failedBefore)
    })
  })

  describe('Without transcoding', function () {
    let source: VideoDetails

    before(async function () {
      this.timeout(120_000)

      await servers[0].config.disableTranscoding()

      source = await uploadSource()
    })

    it('Should publish the copy with a working torrent', async function () {
      this.timeout(120_000)

      const copy = await duplicate(source.uuid)

      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.duration).to.equal(source.duration)
      expect(copy.files).to.have.lengthOf(1)
      expect(copy.streamingPlaylists).to.have.lengthOf(0)

      await checkFilesAreNew(source, copy)

      const publicCopy = await makePublic(copy.uuid)
      const file = publicCopy.files[0]

      const torrent = await fetchTorrent(file.torrentUrl)
      expect(torrent.infoHash).to.equal(getTorrentInfoHash(file.magnetUri))
      expect(getTorrentInfoHash(file.magnetUri)).to.not.equal(getTorrentInfoHash(source.files[0].magnetUri))

      await checkWebTorrentWorks(file.magnetUri)
    })

    it('Should publish the copy if transcoding is enabled before its files are copied', async function () {
      this.timeout(120_000)

      await servers[0].jobs.pauseJobQueue()

      let uuid: string

      try {
        uuid = (await servers[0].videos.duplicate({ id: source.uuid })).uuid

        await servers[0].config.enableMinimumTranscoding()
      } finally {
        await servers[0].jobs.resumeJobQueue()
      }

      await waitJobs(servers)

      const copy = await servers[0].videos.getWithToken({ id: uuid })
      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.files).to.have.lengthOf(1)
      expect(copy.streamingPlaylists).to.have.lengthOf(0)

      await servers[0].config.disableTranscoding()
    })
  })

  describe('With object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    const objectStorage = new ObjectStorageCommand()

    before(async function () {
      this.timeout(120_000)

      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig())
    })

    it('Should duplicate a video in object storage', async function () {
      this.timeout(120_000)

      await servers[0].config.enableMinimumTranscoding()

      const source = await uploadSource('source object storage')
      const copy = await makePublic((await duplicate(source.uuid)).uuid)

      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      await checkFilesAreNew(source, copy)

      await completeCheckHlsPlaylist({
        servers,
        videoUUID: copy.uuid,
        hlsOnly: false,
        resolutions: source.streamingPlaylists[0].files.map(f => f.resolution.id),
        objectStorageBaseUrl: objectStorage.getMockPlaylistBaseUrl()
      })

      for (const file of copy.files) {
        expectStartWith(file.fileUrl, objectStorage.getMockWebVideosBaseUrl())
      }

      for (const file of copy.streamingPlaylists[0].files) {
        expectStartWith(file.fileUrl, objectStorage.getMockPlaylistBaseUrl())
      }
    })

    it('Should duplicate a video in object storage without transcoding', async function () {
      this.timeout(120_000)

      await servers[0].config.disableTranscoding()

      const source = await uploadSource('source object storage without transcoding')
      const copy = await makePublic((await duplicate(source.uuid)).uuid)

      expect(copy.state.id).to.equal(VideoState.PUBLISHED)
      expect(copy.files).to.have.lengthOf(1)
      await checkFilesAreNew(source, copy)

      expectStartWith(copy.files[0].fileUrl, objectStorage.getMockWebVideosBaseUrl())

      const torrent = await fetchTorrent(copy.files[0].torrentUrl)
      expect(torrent.infoHash).to.equal(getTorrentInfoHash(copy.files[0].magnetUri))
    })

    after(async function () {
      await objectStorage.cleanupMock()
    })
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
