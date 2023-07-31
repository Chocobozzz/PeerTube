/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { wait } from '@peertube/peertube-core-utils'
import { VideosOverview } from '@peertube/peertube-models'
import { cleanupTests, createSingleServer, PeerTubeServer, setAccessTokensToServers } from '@peertube/peertube-server-commands'

describe('Test a videos overview', function () {
  let server: PeerTubeServer = null

  function testOverviewCount (overview: VideosOverview, expected: number) {
    expect(overview.tags).to.have.lengthOf(expected)
    expect(overview.categories).to.have.lengthOf(expected)
    expect(overview.channels).to.have.lengthOf(expected)
  }

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])
  })

  it('Should send empty overview', async function () {
    const body = await server.overviews.getVideos({ page: 1 })

    testOverviewCount(body, 0)
  })

  it('Should upload 5 videos in a specific category, tag and channel but not include them in overview', async function () {
    this.timeout(60000)

    await wait(3000)

    await server.videos.upload({
      attributes: {
        name: 'video 0',
        category: 3,
        tags: [ 'coucou1', 'coucou2' ]
      }
    })

    const body = await server.overviews.getVideos({ page: 1 })

    testOverviewCount(body, 0)
  })

  it('Should upload another video and include all videos in the overview', async function () {
    this.timeout(120000)

    {
      for (let i = 1; i < 6; i++) {
        await server.videos.upload({
          attributes: {
            name: 'video ' + i,
            category: 3,
            tags: [ 'coucou1', 'coucou2' ]
          }
        })
      }

      await wait(3000)
    }

    {
      const body = await server.overviews.getVideos({ page: 1 })

      testOverviewCount(body, 1)
    }

    {
      const overview = await server.overviews.getVideos({ page: 2 })

      expect(overview.tags).to.have.lengthOf(1)
      expect(overview.categories).to.have.lengthOf(0)
      expect(overview.channels).to.have.lengthOf(0)
    }
  })

  it('Should have the correct overview', async function () {
    const overview1 = await server.overviews.getVideos({ page: 1 })
    const overview2 = await server.overviews.getVideos({ page: 2 })

    for (const arr of [ overview1.tags, overview1.categories, overview1.channels, overview2.tags ]) {
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

  it('Should hide muted accounts', async function () {
    const token = await server.users.generateUserAndToken('choco')

    await server.blocklist.addToMyBlocklist({ token, account: 'root@' + server.host })

    {
      const body = await server.overviews.getVideos({ page: 1 })

      testOverviewCount(body, 1)
    }

    {
      const body = await server.overviews.getVideos({ page: 1, token })

      testOverviewCount(body, 0)
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
