/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createSingleServer,
  PeerTubeServer,
  SearchCommand,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'

describe('Test video caption segments search', function () {
  let server: PeerTubeServer
  let command: SearchCommand

  let videoUUID: string

  before(async function () {
    this.timeout(60000)

    server = await createSingleServer(1, { search: { caption_search: { enabled: true } } })

    await setAccessTokensToServers([ server ])
    await setDefaultVideoChannel([ server ])

    command = server.search

    const { uuid } = await server.videos.upload({ attributes: { name: 'my video name' } })
    videoUUID = uuid

    await waitJobs([ server ])
  })

  it('Should not find caption segments of a video that has no caption', async function () {
    const body = await command.searchVideoCaptionSegments({ search: { search: 'stomach' } })

    expect(body.total).to.equal(0)
    expect(body.data).to.have.lengthOf(0)
  })

  it('Should find the captions of a video in the caption search', async function () {
    await server.captions.add({ videoId: videoUUID, language: 'ar', fixture: 'subtitle-good1.vtt' })
    await waitJobs([ server ])

    const body = await command.searchVideoCaptionSegments({ search: { search: 'perforate' } })

    expect(body.total).to.equal(1)
    expect(body.data).to.have.lengthOf(1)

    const segment = body.data[0]
    expect(segment.videoUUID).to.equal(videoUUID)
    expect(segment.videoName).to.equal('my video name')
    expect(segment.language).to.equal('ar')
    expect(segment.automaticallyGenerated).to.be.false
    expect(segment.startMs).to.equal(5000)
    expect(segment.endMs).to.equal(9000)
    expect(segment.text).to.contain('It will perforate your stomach')
  })

  it('Should find a caption segment with a partial word', async function () {
    const body = await command.searchVideoCaptionSegments({ search: { search: 'perfor' } })

    expect(body.total).to.equal(1)
    expect(body.data[0].startMs).to.equal(5000)
  })

  it('Should filter caption segments by language', async function () {
    const body = await command.searchVideoCaptionSegments({ search: { search: 'perforate', languageOneOf: [ 'en' ] } })
    expect(body.total).to.equal(0)

    const otherBody = await command.searchVideoCaptionSegments({ search: { search: 'perforate', languageOneOf: [ 'ar' ] } })
    expect(otherBody.total).to.equal(1)
  })

  it('Should not find caption segments of a private video', async function () {
    await server.videos.update({ id: videoUUID, attributes: { privacy: VideoPrivacy.PRIVATE } })

    const body = await command.searchVideoCaptionSegments({ search: { search: 'perforate' } })
    expect(body.total).to.equal(0)

    await server.videos.update({ id: videoUUID, attributes: { privacy: VideoPrivacy.PUBLIC } })
  })

  it('Should update the caption segments when the caption is replaced', async function () {
    await server.captions.add({ videoId: videoUUID, language: 'ar', fixture: 'subtitle-good2.vtt' })
    await waitJobs([ server ])

    const body = await command.searchVideoCaptionSegments({ search: { search: 'subtitle' } })

    expect(body.total).to.equal(1)
    expect(body.data[0].text).to.equal('Subtitle good 2.')
    expect(body.data[0].startMs).to.equal(1000)
    expect(body.data[0].endMs).to.equal(4000)
  })

  it('Should not index the captions of a deleted video', async function () {
    await server.videos.remove({ id: videoUUID })
    await waitJobs([ server ])

    const body = await command.searchVideoCaptionSegments({ search: { search: 'subtitle' } })
    expect(body.total).to.equal(0)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

describe('Test video caption segments search when the feature is disabled', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
  })

  it('Should not be able to search in the captions of an instance that did not enable the feature', async function () {
    await server.search.searchVideoCaptionSegments({
      search: { search: 'toto' },
      expectedStatus: HttpStatusCode.CONFLICT_409
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
