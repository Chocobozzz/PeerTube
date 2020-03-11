/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import * as chai from 'chai'
import 'mocha'
import { cleanupTests, flushAndRunServer, ServerInfo, setAccessTokensToServers, uploadVideo, wait } from '../../../../shared/extra-utils'
import { getVideosOverview } from '../../../../shared/extra-utils/overviews/overviews'
import { VideosOverview } from '../../../../shared/models/overviews'

const expect = chai.expect

describe('Test a videos overview', function () {
  let server: ServerInfo = null

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should send empty overview', async function () {
    const res = await getVideosOverview(server.url, 1)

    const overview: VideosOverview = res.body
    expect(overview.tags).to.have.lengthOf(0)
    expect(overview.categories).to.have.lengthOf(0)
    expect(overview.channels).to.have.lengthOf(0)
  })

  it('Should upload 5 videos in a specific category, tag and channel but not include them in overview', async function () {
    this.timeout(15000)

    await wait(3000)

    await uploadVideo(server.url, server.accessToken, {
      name: 'video 0',
      category: 3,
      tags: [ 'coucou1', 'coucou2' ]
    })

    const res = await getVideosOverview(server.url, 1)

    const overview: VideosOverview = res.body
    expect(overview.tags).to.have.lengthOf(0)
    expect(overview.categories).to.have.lengthOf(0)
    expect(overview.channels).to.have.lengthOf(0)
  })

  it('Should upload another video and include all videos in the overview', async function () {
    this.timeout(15000)

    for (let i = 1; i < 6; i++) {
      await uploadVideo(server.url, server.accessToken, {
        name: 'video ' + i,
        category: 3,
        tags: [ 'coucou1', 'coucou2' ]
      })
    }

    await wait(3000)

    {
      const res = await getVideosOverview(server.url, 1)

      const overview: VideosOverview = res.body
      expect(overview.tags).to.have.lengthOf(1)
      expect(overview.categories).to.have.lengthOf(1)
      expect(overview.channels).to.have.lengthOf(1)
    }

    {
      const res = await getVideosOverview(server.url, 2)

      const overview: VideosOverview = res.body
      expect(overview.tags).to.have.lengthOf(1)
      expect(overview.categories).to.have.lengthOf(0)
      expect(overview.channels).to.have.lengthOf(0)
    }
  })

  it('Should have the correct overview', async function () {
    const res1 = await getVideosOverview(server.url, 1)
    const res2 = await getVideosOverview(server.url, 2)

    const overview1: VideosOverview = res1.body
    const overview2: VideosOverview = res2.body

    const tmp = [
      overview1.tags,
      overview1.categories,
      overview1.channels,
      overview2.tags
    ]

    for (const arr of tmp) {
      expect(arr).to.have.lengthOf(1)

      const obj = arr[0]

      expect(obj.videos).to.have.lengthOf(6)
      expect(obj.videos[0].name).to.equal('video 5')
      expect(obj.videos[1].name).to.equal('video 4')
      expect(obj.videos[2].name).to.equal('video 3')
      expect(obj.videos[3].name).to.equal('video 2')
      expect(obj.videos[4].name).to.equal('video 1')
      expect(obj.videos[5].name).to.equal('video 0')
    }

    const tags = [ overview1.tags[0].tag, overview2.tags[0].tag ]
    expect(tags.find(t => t === 'coucou1')).to.not.be.undefined
    expect(tags.find(t => t === 'coucou2')).to.not.be.undefined

    expect(overview1.categories[0].category.id).to.equal(3)

    expect(overview1.channels[0].channel.name).to.equal('root_channel')
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
