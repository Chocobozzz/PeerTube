/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import { keyBy } from 'lodash'
import 'mocha'
import { join } from 'path'
import {
  dateIsValid,
  flushTests,
  getVideo,
  getVideoCategories,
  getVideoLanguages,
  getVideoLicences,
  getVideoPrivacies,
  getVideosList,
  getVideosListPagination,
  getVideosListSort,
  killallServers,
  rateVideo,
  readdirPromise,
  removeVideo,
  runServer,
  searchVideo,
  searchVideoWithPagination,
  searchVideoWithSort,
  ServerInfo,
  setAccessTokensToServers,
  testVideoImage,
  updateVideo,
  uploadVideo,
  wait,
  webtorrentAdd
} from '../../utils/index'
import { viewVideo } from '../../utils/videos/videos'

const expect = chai.expect

describe('Test a single server', function () {
  let server: ServerInfo = null
  let videoId = -1
  let videoUUID = ''
  let videosListBase: any[] = null

  before(async function () {
    this.timeout(10000)

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

    expect(languages[3]).to.equal('Mandarin')
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
  })

  it('Should seed the uploaded video', async function () {
    // Yes, this could be long
    this.timeout(60000)

    const res = await getVideosList(server.url)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)

    const video = res.body.data[0]
    expect(video.name).to.equal('my super name')
    expect(video.category).to.equal(2)
    expect(video.categoryLabel).to.equal('Films')
    expect(video.licence).to.equal(6)
    expect(video.licenceLabel).to.equal('Attribution - Non Commercial - No Derivatives')
    expect(video.language).to.equal(3)
    expect(video.languageLabel).to.equal('Mandarin')
    expect(video.nsfw).to.be.ok
    expect(video.description).to.equal('my super description')
    expect(video.serverHost).to.equal('localhost:9001')
    expect(video.accountName).to.equal('root')
    expect(video.isLocal).to.be.true
    expect(dateIsValid(video.createdAt)).to.be.true
    expect(dateIsValid(video.updatedAt)).to.be.true

    const res2 = await getVideo(server.url, res.body.data[0].id)
    const videoDetails = res2.body

    expect(videoDetails.files).to.have.lengthOf(1)

    const file = videoDetails.files[0]
    const magnetUri = file.magnetUri
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.torrentUrl).to.equal(`${server.url}/static/torrents/${videoDetails.uuid}-${file.resolution}.torrent`)
    expect(file.fileUrl).to.equal(`${server.url}/static/webseed/${videoDetails.uuid}-${file.resolution}.webm`)
    expect(file.resolution).to.equal(720)
    expect(file.resolutionLabel).to.equal('720p')
    expect(file.size).to.equal(218910)

    const test = await testVideoImage(server.url, 'video_short.webm', videoDetails.thumbnailPath)
    expect(test).to.equal(true)

    videoId = videoDetails.id
    videoUUID = videoDetails.uuid

    const torrent = await webtorrentAdd(magnetUri)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).to.exist.and.to.not.equal('')
  })

  it('Should get the video', async function () {
    // Yes, this could be long
    this.timeout(60000)

    const res = await getVideo(server.url, videoId)

    const video = res.body
    expect(video.name).to.equal('my super name')
    expect(video.category).to.equal(2)
    expect(video.categoryLabel).to.equal('Films')
    expect(video.licence).to.equal(6)
    expect(video.licenceLabel).to.equal('Attribution - Non Commercial - No Derivatives')
    expect(video.language).to.equal(3)
    expect(video.languageLabel).to.equal('Mandarin')
    expect(video.nsfw).to.be.ok
    expect(video.description).to.equal('my super description')
    expect(video.serverHost).to.equal('localhost:9001')
    expect(video.accountName).to.equal('root')
    expect(video.isLocal).to.be.true
    expect(dateIsValid(video.createdAt)).to.be.true
    expect(dateIsValid(video.updatedAt)).to.be.true
    expect(video.channel.name).to.equal('Default root channel')
    expect(video.channel.isLocal).to.be.true
    expect(dateIsValid(video.channel.createdAt)).to.be.true
    expect(dateIsValid(video.channel.updatedAt)).to.be.true

    expect(video.files).to.have.lengthOf(1)

    const file = video.files[0]
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.resolution).to.equal(720)
    expect(file.resolutionLabel).to.equal('720p')
    expect(file.size).to.equal(218910)

    const test = await testVideoImage(server.url, 'video_short.webm', video.thumbnailPath)
    expect(test).to.equal(true)

    // Wait the async views increment
    await wait(500)
  })

  it('Should get the video by UUID', async function () {
    // Yes, this could be long
    this.timeout(60000)

    const res = await getVideo(server.url, videoUUID)

    const video = res.body
    expect(video.name).to.equal('my super name')

    // Wait the async views increment
    await wait(500)
  })

  it('Should have the views updated', async function () {
    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)
    await viewVideo(server.url, videoId)

    const res = await getVideo(server.url, videoId)

    const video = res.body
    expect(video.views).to.equal(3)
  })

  it('Should search the video by name', async function () {
    const res = await searchVideo(server.url, 'my')

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(1)

    const video = res.body.data[0]
    expect(video.name).to.equal('my super name')
    expect(video.category).to.equal(2)
    expect(video.categoryLabel).to.equal('Films')
    expect(video.licence).to.equal(6)
    expect(video.licenceLabel).to.equal('Attribution - Non Commercial - No Derivatives')
    expect(video.language).to.equal(3)
    expect(video.languageLabel).to.equal('Mandarin')
    expect(video.nsfw).to.be.ok
    expect(video.description).to.equal('my super description')
    expect(video.serverHost).to.equal('localhost:9001')
    expect(video.accountName).to.equal('root')
    expect(video.isLocal).to.be.true
    expect(dateIsValid(video.createdAt)).to.be.true
    expect(dateIsValid(video.updatedAt)).to.be.true

    const test = await testVideoImage(server.url, 'video_short.webm', video.thumbnailPath)
    expect(test).to.equal(true)
  })

  // Not implemented yet
  // it('Should search the video by serverHost', async function () {
  //     const res = await   videosUtils.searchVideo(server.url, '9001', 'host')

  //     expect(res.body.total).to.equal(1)
  //     expect(res.body.data).to.be.an('array')
  //     expect(res.body.data.length).to.equal(1)

  //     const video = res.body.data[0]
  //     expect(video.name).to.equal('my super name')
  //     expect(video.description).to.equal('my super description')
  //     expect(video.serverHost).to.equal('localhost:9001')
  //     expect(video.author).to.equal('root')
  //     expect(video.isLocal).to.be.true
  //     expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
  //     expect(dateIsValid(video.createdAt)).to.be.true
  //     expect(dateIsValid(video.updatedAt)).to.be.true

  //     const test = await testVideoImage(server.url, 'video_short.webm', video.thumbnailPath)
  //       expect(test).to.equal(true)

  //       done()
  //     })
  //   })
  // })

  // Not implemented yet
  // it('Should search the video by tag', async function () {
  //   const res = await searchVideo(server.url, 'tag1')
  //
  //   expect(res.body.total).to.equal(1)
  //   expect(res.body.data).to.be.an('array')
  //   expect(res.body.data.length).to.equal(1)
  //
  //   const video = res.body.data[0]
  //   expect(video.name).to.equal('my super name')
  //   expect(video.category).to.equal(2)
  //   expect(video.categoryLabel).to.equal('Films')
  //   expect(video.licence).to.equal(6)
  //   expect(video.licenceLabel).to.equal('Attribution - Non Commercial - No Derivatives')
  //   expect(video.language).to.equal(3)
  //   expect(video.languageLabel).to.equal('Mandarin')
  //   expect(video.nsfw).to.be.ok
  //   expect(video.description).to.equal('my super description')
  //   expect(video.serverHost).to.equal('localhost:9001')
  //   expect(video.accountName).to.equal('root')
  //   expect(video.isLocal).to.be.true
  //   expect(video.tags).to.deep.equal([ 'tag1', 'tag2', 'tag3' ])
  //   expect(dateIsValid(video.createdAt)).to.be.true
  //   expect(dateIsValid(video.updatedAt)).to.be.true
  //
  //   const test = await testVideoImage(server.url, 'video_short.webm', video.thumbnailPath)
  //   expect(test).to.equal(true)
  // })

  it('Should not find a search by name', async function () {
    const res = await searchVideo(server.url, 'hello')

    expect(res.body.total).to.equal(0)
    expect(res.body.data).to.be.an('array')
    expect(res.body.data.length).to.equal(0)
  })

  // Not implemented yet
  // it('Should not find a search by author', async function () {
  //   const res = await searchVideo(server.url, 'hello')
  //
  //   expect(res.body.total).to.equal(0)
  //   expect(res.body.data).to.be.an('array')
  //   expect(res.body.data.length).to.equal(0)
  // })
  //
  // Not implemented yet
  // it('Should not find a search by tag', async function () {
  //   const res = await searchVideo(server.url, 'hello')
  //
  //   expect(res.body.total).to.equal(0)
  //   expect(res.body.data).to.be.an('array')
  //   expect(res.body.data.length).to.equal(0)
  // })

  it('Should remove the video', async function () {
    await removeVideo(server.url, server.accessToken, videoId)

    const files1 = await readdirPromise(join(__dirname, '..', '..', '..', 'test1/videos/'))
    expect(files1).to.have.lengthOf(0)

    const files2 = await readdirPromise(join(__dirname, '..', '..', '..', 'test1/thumbnails/'))
    expect(files2).to.have.lengthOf(0)
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
        language: 1,
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
      const test = await testVideoImage(server.url, videoName, video.thumbnailPath)

      expect(test).to.equal(true)
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

  it('Should search the first video', async function () {
    const res = await searchVideoWithPagination(server.url, 'webm', 0, 1, 'name')

    const videos = res.body.data
    expect(res.body.total).to.equal(4)
    expect(videos.length).to.equal(1)
    expect(videos[0].name).to.equal('video_short1.webm name')
  })

  it('Should search the last two videos', async function () {
    const res = await searchVideoWithPagination(server.url, 'webm', 2, 2, 'name')

    const videos = res.body.data
    expect(res.body.total).to.equal(4)
    expect(videos.length).to.equal(2)
    expect(videos[0].name).to.equal('video_short3.webm name')
    expect(videos[1].name).to.equal('video_short.webm name')
  })

  it('Should search all the webm videos', async function () {
    const res = await searchVideoWithPagination(server.url, 'webm', 0, 15)

    const videos = res.body.data
    expect(res.body.total).to.equal(4)
    expect(videos.length).to.equal(4)
  })

  // Not implemented yet
  // it('Should search all the root author videos', async function () {
  //   const res = await searchVideoWithPagination(server.url, 'root', 0, 15)
  //
  //   const videos = res.body.data
  //   expect(res.body.total).to.equal(6)
  //   expect(videos.length).to.equal(6)
  // })

  // Not implemented yet
  // it('Should search all the 9001 port videos', async function () {
  // const res = await   videosUtils.searchVideoWithPagination(server.url, '9001', 'host', 0, 15)

  //     const videos = res.body.data
  //     expect(res.body.total).to.equal(6)
  //     expect(videos.length).to.equal(6)

  //     done()
  //   })
  // })

  // it('Should search all the localhost videos', async function () {
  // const res = await   videosUtils.searchVideoWithPagination(server.url, 'localhost', 'host', 0, 15)

  //     const videos = res.body.data
  //     expect(res.body.total).to.equal(6)
  //     expect(videos.length).to.equal(6)

  //     done()
  //   })
  // })

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
  })

  it('Should search and sort by name in ascending order', async function () {
    const res = await searchVideoWithSort(server.url, 'webm', 'name')

    const videos = res.body.data
    expect(res.body.total).to.equal(4)
    expect(videos.length).to.equal(4)

    expect(videos[0].name).to.equal('video_short1.webm name')
    expect(videos[1].name).to.equal('video_short2.webm name')
    expect(videos[2].name).to.equal('video_short3.webm name')
    expect(videos[3].name).to.equal('video_short.webm name')

    videoId = videos[2].id
  })

  it('Should update a video', async function () {
    const attributes = {
      name: 'my super video updated',
      category: 4,
      licence: 2,
      language: 5,
      nsfw: false,
      description: 'my super description updated',
      tags: [ 'tagup1', 'tagup2' ]
    }
    await updateVideo(server.url, server.accessToken, videoId, attributes)
  })

  it('Should have the video updated', async function () {
    this.timeout(60000)

    const res = await getVideo(server.url, videoId)

    const video = res.body

    expect(video.name).to.equal('my super video updated')
    expect(video.category).to.equal(4)
    expect(video.categoryLabel).to.equal('Art')
    expect(video.licence).to.equal(2)
    expect(video.licenceLabel).to.equal('Attribution - Share Alike')
    expect(video.language).to.equal(5)
    expect(video.languageLabel).to.equal('Arabic')
    expect(video.nsfw).to.be.ok
    expect(video.description).to.equal('my super description updated')
    expect(video.serverHost).to.equal('localhost:9001')
    expect(video.accountName).to.equal('root')
    expect(video.account.name).to.equal('root')
    expect(video.isLocal).to.be.true
    expect(video.tags).to.deep.equal([ 'tagup1', 'tagup2' ])
    expect(dateIsValid(video.createdAt)).to.be.true
    expect(dateIsValid(video.updatedAt)).to.be.true

    expect(video.channel.name).to.equal('Default root channel')
    expect(video.channel.isLocal).to.be.true
    expect(dateIsValid(video.channel.createdAt)).to.be.true
    expect(dateIsValid(video.channel.updatedAt)).to.be.true

    expect(video.files).to.have.lengthOf(1)

    const file = video.files[0]
    const magnetUri = file.magnetUri
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.resolution).to.equal(720)
    expect(file.resolutionLabel).to.equal('720p')
    expect(file.size).to.equal(292677)

    const test = await testVideoImage(server.url, 'video_short3.webm', video.thumbnailPath)
    expect(test).to.equal(true)

    const torrent = await webtorrentAdd(magnetUri)
    expect(torrent.files).to.be.an('array')
    expect(torrent.files.length).to.equal(1)
    expect(torrent.files[0].path).to.exist.and.to.not.equal('')
  })

  it('Should update only the tags of a video', async function () {
    const attributes = {
      tags: [ 'tag1', 'tag2', 'supertag' ]
    }

    await updateVideo(server.url, server.accessToken, videoId, attributes)

    const res = await getVideo(server.url, videoId)
    const video = res.body

    expect(video.name).to.equal('my super video updated')
    expect(video.category).to.equal(4)
    expect(video.categoryLabel).to.equal('Art')
    expect(video.licence).to.equal(2)
    expect(video.licenceLabel).to.equal('Attribution - Share Alike')
    expect(video.language).to.equal(5)
    expect(video.languageLabel).to.equal('Arabic')
    expect(video.nsfw).to.be.ok
    expect(video.description).to.equal('my super description updated')
    expect(video.serverHost).to.equal('localhost:9001')
    expect(video.accountName).to.equal('root')
    expect(video.isLocal).to.be.true
    expect(video.tags).to.deep.equal([ 'supertag', 'tag1', 'tag2' ])
    expect(dateIsValid(video.createdAt)).to.be.true
    expect(dateIsValid(video.updatedAt)).to.be.true

    expect(video.channel.name).to.equal('Default root channel')
    expect(video.channel.isLocal).to.be.true
    expect(dateIsValid(video.channel.createdAt)).to.be.true
    expect(dateIsValid(video.channel.updatedAt)).to.be.true

    expect(video.files).to.have.lengthOf(1)

    const file = video.files[0]
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.resolution).to.equal(720)
    expect(file.resolutionLabel).to.equal('720p')
    expect(file.size).to.equal(292677)
  })

  it('Should update only the description of a video', async function () {
    const attributes = {
      description: 'hello everybody'
    }

    await updateVideo(server.url, server.accessToken, videoId, attributes)

    const res = await getVideo(server.url, videoId)
    const video = res.body

    expect(video.name).to.equal('my super video updated')
    expect(video.category).to.equal(4)
    expect(video.categoryLabel).to.equal('Art')
    expect(video.licence).to.equal(2)
    expect(video.licenceLabel).to.equal('Attribution - Share Alike')
    expect(video.language).to.equal(5)
    expect(video.languageLabel).to.equal('Arabic')
    expect(video.nsfw).to.be.ok
    expect(video.description).to.equal('hello everybody')
    expect(video.serverHost).to.equal('localhost:9001')
    expect(video.accountName).to.equal('root')
    expect(video.isLocal).to.be.true
    expect(video.tags).to.deep.equal([ 'supertag', 'tag1', 'tag2' ])
    expect(dateIsValid(video.createdAt)).to.be.true
    expect(dateIsValid(video.updatedAt)).to.be.true

    expect(video.channel.name).to.equal('Default root channel')
    expect(video.channel.isLocal).to.be.true
    expect(dateIsValid(video.channel.createdAt)).to.be.true
    expect(dateIsValid(video.channel.updatedAt)).to.be.true

    expect(video.files).to.have.lengthOf(1)

    const file = video.files[0]
    expect(file.magnetUri).to.have.lengthOf.above(2)
    expect(file.resolution).to.equal(720)
    expect(file.resolutionLabel).to.equal('720p')
    expect(file.size).to.equal(292677)
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
