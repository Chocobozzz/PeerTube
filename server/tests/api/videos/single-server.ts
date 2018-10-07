/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import { keyBy } from 'lodash'
import 'mocha'
import { VideoPrivacy } from '../../../../shared/models/videos'
import {
  checkVideoFilesWereRemoved,
  completeVideoCheck,
  flushTests,
  getVideo,
  getVideoCategories,
  getVideoLanguages,
  getVideoLicences,
  getVideoPrivacies,
  getVideosList,
  getVideosListPagination,
  getVideosListSort,
  getVideosWithFilters,
  killallServers,
  rateVideo,
  removeVideo,
  runServer,
  ServerInfo,
  setAccessTokensToServers,
  testImage,
  updateVideo,
  uploadVideo,
  viewVideo,
  wait
} from '../../utils'

const expect = chai.expect

describe('Test a single server', function () {
  let server: ServerInfo = null
  let videoId = -1
  let videoUUID = ''
  let videosListBase: any[] = null

  const getCheckAttributes = {
    name: 'my super name',
    category: 2,
    licence: 6,
    language: 'zh',
    nsfw: true,
    description: 'my super description',
    support: 'my super support text',
    account: {
      name: 'root',
      host: 'localhost:9001'
    },
    isLocal: true,
    duration: 5,
    tags: [ 'tag1', 'tag2', 'tag3' ],
    privacy: VideoPrivacy.PUBLIC,
    commentsEnabled: true,
    channel: {
      displayName: 'Main root channel',
      name: 'root_channel',
      description: '',
      isLocal: true
    },
    fixture: 'video_short.webm',
    files: [
      {
        resolution: 720,
        size: 218910
      }
    ]
  }

  const updateCheckAttributes = {
    name: 'my super video updated',
    category: 4,
    licence: 2,
    language: 'ar',
    nsfw: false,
    description: 'my super description updated',
    support: 'my super support text updated',
    account: {
      name: 'root',
      host: 'localhost:9001'
    },
    isLocal: true,
    tags: [ 'tagup1', 'tagup2' ],
    privacy: VideoPrivacy.PUBLIC,
    duration: 5,
    commentsEnabled: false,
    channel: {
      name: 'root_channel',
      displayName: 'Main root channel',
      description: '',
      isLocal: true
    },
    fixture: 'video_short3.webm',
    files: [
      {
        resolution: 720,
        size: 292677
      }
    ]
  }

  before(async function () {
    this.timeout(30000)

    await flushTests()

    server = await runServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should list video categories', async function () {
    const res = await getVideoCategories(server.url)

    const categories = res.body
    expect(Object.keys(categories)).to.have.length.above(10)

    expect(categories[11]).to.equal('News')
  })

  it('Should list video licences', async function () {
    const res = await getVideoLicences(server.url)

    const licences = res.body
    expect(Object.keys(licences)).to.have.length.above(5)

    expect(licences[3]).to.equal('Attribution - No Derivatives')
  })

  it('Should list video languages', async function () {
    const res = await getVideoLanguages(server.url)

    const languages = res.body
    expect(Object.keys(languages)).to.have.length.above(5)

    expect(languages['ru']).to.equal('Russian')
  })

  it('Should list video privacies', async function () {
    const res = await getVideoPrivacies(server.url)

    const privacies = res.body
    expect(Object.keys(privacies)).to.have.length.at.least(3)

    expect(privacies[3]).to.equal('Private')
  })

  it('Should not have videos', async function () {
    const res = await getVideosList(server.url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  it('Should upload the video', async function () {
    const videoAttributes = {
      name: 'my super name',
      category: 2,
      nsfw: true,
      licence: 6,
      tags: [ 'tag1', 'tag2', 'tag3' ]
    }
    const res = await uploadVideo(server.url, server.accessToken, videoAttributes)
    expect(res.body.video).to.not.be.undefined
    expect(res.body.video.id).to.equal(1)
    expect(res.body.video.uuid).to.have.length.above(5)

    videoId = res.body.video.id
    videoUUID = res.body.video.uuid
  })

  it('Should get and seed the uploaded video', async function () {
    this.timeout(5000)

    const res = await getVideosList(server.url)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)

    const video = res.body.data[0]
    await completeVideoCheck(server.url, video, getCheckAttributes)
  })

  it('Should get the video by UUID', async function () {
    this.timeout(5000)

    const res = await getVideo(server.url, videoUUID)

    const video = res.body
    await completeVideoCheck(server.url, video, getCheckAttributes)
  })

  it('Should have the views updated', async function () {
    this.timeout(20000)

    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)

    await wait(1500)

    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)

    await wait(1500)

    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)

    // Wait the repeatable job
    await wait(8000)

    const res = await getVideo(server.url, videoId)

    const video = res.body
    expect(video.views).to.equal(3)
  })

  it('Should remove the video', async function () {
    await removeVideo(server.url, server.accessToken, videoId)

    await checkVideoFilesWereRemoved(videoUUID, 1)
  })

  it('Should not have videos', async function () {
    const res = await getVideosList(server.url)

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data).to.have.lengthOf(0)
  })

  it('Should upload 6 videos', async function () {
    this.timeout(25000)

    const videos = [
      'video_short.mp4', 'video_short.ogv', 'video_short.webm',
      'video_short1.webm', 'video_short2.webm', 'video_short3.webm'
    ]

    const tasks: Promise<any>[] = []
    for (const video of videos) {
      const videoAttributes = {
        name: video + ' name',
        description: video + ' description',
        category: 2,
        licence: 1,
        language: 'en',
        nsfw: true,
        tags: [ 'tag1', 'tag2', 'tag3' ],
        fixture: video
      }

      const p = uploadVideo(server.url, server.accessToken, videoAttributes)
      tasks.push(p)
    }

    await Promise.all(tasks)
  })

  it('Should have the correct durations', async function () {
    const res = await getVideosList(server.url)

    expect(res.body.total).to.equal(6)
    const videos = res.body.data
    expect(videos).to.be.an('array')
    expect(videos).to.have.lengthOf(6)

    const videosByName = keyBy<{ duration: number }>(videos, 'name')
    expect(videosByName['video_short.mp4 name'].duration).to.equal(5)
    expect(videosByName['video_short.ogv name'].duration).to.equal(5)
    expect(videosByName['video_short.webm name'].duration).to.equal(5)
    expect(videosByName['video_short1.webm name'].duration).to.equal(10)
    expect(videosByName['video_short2.webm name'].duration).to.equal(5)
    expect(videosByName['video_short3.webm name'].duration).to.equal(5)
  })

  it('Should have the correct thumbnails', async function () {
    const res = await getVideosList(server.url)

    const videos = res.body.data
    // For the next test
    videosListBase = videos

    for (const video of videos) {
      const videoName = video.name.replace(' name', '')
      await testImage(server.url, videoName, video.thumbnailPath)
    }
  })

  it('Should list only the two first videos', async function () {
    const res = await getVideosListPagination(server.url, 0, 2, 'name')

    const videos = res.body.data
    expect(res.body.total).to.equal(6)
    expect(videos.length).to.equal(2)
    expect(videos[0].name).to.equal(videosListBase[0].name)
    expect(videos[1].name).to.equal(videosListBase[1].name)
  })

  it('Should list only the next three videos', async function () {
    const res = await getVideosListPagination(server.url, 2, 3, 'name')

    const videos = res.body.data
    expect(res.body.total).to.equal(6)
    expect(videos.length).to.equal(3)
    expect(videos[0].name).to.equal(videosListBase[2].name)
    expect(videos[1].name).to.equal(videosListBase[3].name)
    expect(videos[2].name).to.equal(videosListBase[4].name)
  })

  it('Should list the last video', async function () {
    const res = await getVideosListPagination(server.url, 5, 6, 'name')

    const videos = res.body.data
    expect(res.body.total).to.equal(6)
    expect(videos.length).to.equal(1)
    expect(videos[0].name).to.equal(videosListBase[5].name)
  })

  it('Should list and sort by name in descending order', async function () {
    const res = await getVideosListSort(server.url, '-name')

    const videos = res.body.data
    expect(res.body.total).to.equal(6)
    expect(videos.length).to.equal(6)
    expect(videos[0].name).to.equal('video_short.webm name')
    expect(videos[1].name).to.equal('video_short.ogv name')
    expect(videos[2].name).to.equal('video_short.mp4 name')
    expect(videos[3].name).to.equal('video_short3.webm name')
    expect(videos[4].name).to.equal('video_short2.webm name')
    expect(videos[5].name).to.equal('video_short1.webm name')

    videoId = videos[3].uuid
  })

  it('Should list and sort by trending in descending order', async function () {
    const res = await getVideosListPagination(server.url, 0, 2, '-trending')

    const videos = res.body.data
    expect(res.body.total).to.equal(6)
    expect(videos.length).to.equal(2)
  })

  it('Should update a video', async function () {
    const attributes = {
      name: 'my super video updated',
      category: 4,
      licence: 2,
      language: 'ar',
      nsfw: false,
      description: 'my super description updated',
      commentsEnabled: false,
      tags: [ 'tagup1', 'tagup2' ]
    }
    await updateVideo(server.url, server.accessToken, videoId, attributes)
  })

  it('Should filter by tags and category', async function () {
    const res1 = await getVideosWithFilters(server.url, { tagsAllOf: [ 'tagup1', 'tagup2' ], categoryOneOf: 4 })
    expect(res1.body.total).to.equal(1)
    expect(res1.body.data[0].name).to.equal('my super video updated')

    const res2 = await getVideosWithFilters(server.url, { tagsAllOf: [ 'tagup1', 'tagup2' ], categoryOneOf: 3 })
    expect(res2.body.total).to.equal(0)
  })

  it('Should have the video updated', async function () {
    this.timeout(60000)

    const res = await getVideo(server.url, videoId)
    const video = res.body

    await completeVideoCheck(server.url, video, updateCheckAttributes)
  })

  it('Should update only the tags of a video', async function () {
    const attributes = {
      tags: [ 'supertag', 'tag1', 'tag2' ]
    }
    await updateVideo(server.url, server.accessToken, videoId, attributes)

    const res = await getVideo(server.url, videoId)
    const video = res.body

    await completeVideoCheck(server.url, video, Object.assign(updateCheckAttributes, attributes))
  })

  it('Should update only the description of a video', async function () {
    const attributes = {
      description: 'hello everybody'
    }
    await updateVideo(server.url, server.accessToken, videoId, attributes)

    const res = await getVideo(server.url, videoId)
    const video = res.body

    await completeVideoCheck(server.url, video, Object.assign(updateCheckAttributes, attributes))
  })

  it('Should like a video', async function () {
    await rateVideo(server.url, server.accessToken, videoId, 'like')

    const res = await getVideo(server.url, videoId)
    const video = res.body

    expect(video.likes).to.equal(1)
    expect(video.dislikes).to.equal(0)
  })

  it('Should dislike the same video', async function () {
    await rateVideo(server.url, server.accessToken, videoId, 'dislike')

    const res = await getVideo(server.url, videoId)
    const video = res.body

    expect(video.likes).to.equal(0)
    expect(video.dislikes).to.equal(1)
  })

  after(async function () {
    killallServers([ server ])

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
