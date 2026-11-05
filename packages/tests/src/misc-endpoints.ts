/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import { HttpStatusCode, VideoPrivacy } from '@peertube/peertube-models'
import { uuidToShort } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import { writeJson } from 'fs-extra/esm'
import { join } from 'path'
import { expectLogDoesNotContain } from './shared/checks.js'

describe('Test misc endpoints', function () {
  let server: PeerTubeServer
  let wellKnownPath: string

  before(async function () {
    this.timeout(120000)

    server = await createSingleServer(1)

    await setAccessTokensToServers([ server ])

    wellKnownPath = server.getDirectoryPath('well-known')
  })

  describe('Test a well known endpoints', function () {
    it('Should get security.txt', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/security.txt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('SECURITY.md')
    })

    it('Should get nodeinfo', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/nodeinfo',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.links).to.be.an('array')
      expect(res.body.links).to.have.lengthOf(2)

      expect(res.body.links[0].rel).to.equal('http://nodeinfo.diaspora.software/ns/schema/2.0')

      expect(res.body.links[1].rel).to.equal('https://www.w3.org/ns/activitystreams#Application')
      expect(res.body.links[1].href).to.equal(server.url + '/accounts/peertube')
    })

    it('Should get dnt policy text', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/dnt-policy.txt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('http://www.w3.org/TR/tracking-dnt')
    })

    it('Should get dnt policy', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/dnt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.tracking).to.equal('N')
    })

    it('Should get change-password location', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/change-password',
        expectedStatus: HttpStatusCode.FOUND_302
      })

      expect(res.header.location).to.equal('/my-account/settings')
    })

    it('Should test webfinger', async function () {
      const resource = 'acct:peertube@' + server.host
      const accountUrl = server.url + '/accounts/peertube'

      const res = await makeGetRequest({
        url: server.url,
        path: '/.well-known/webfinger?resource=' + resource,
        expectedStatus: HttpStatusCode.OK_200
      })

      const data = res.body

      expect(data.subject).to.equal(resource)
      expect(data.aliases).to.contain(accountUrl)

      const self = data.links.find(l => l.rel === 'self')
      expect(self).to.exist
      expect(self.type).to.equal('application/activity+json')
      expect(self.href).to.equal(accountUrl)

      const remoteInteract = data.links.find(l => l.rel === 'http://ostatus.org/schema/1.0/subscribe')
      expect(remoteInteract).to.exist
      expect(remoteInteract.template).to.equal(server.url + '/remote-interaction?uri={uri}')
    })

    it('Should return 404 for non-existing files in /.well-known', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/.well-known/non-existing-file',
        expectedStatus: HttpStatusCode.NOT_FOUND_404
      })
    })

    it('Should return custom file from /.well-known', async function () {
      const filename = 'existing-file.json'

      await writeJson(join(wellKnownPath, filename), { iThink: 'therefore I am' })

      const { body } = await makeGetRequest({
        url: server.url,
        path: '/.well-known/' + filename,
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(body.iThink).to.equal('therefore I am')
    })
  })

  describe('Test classic static endpoints', function () {
    it('Should get robots.txt', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/robots.txt',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.text).to.contain('User-agent')
      expect(res.text).to.contain('Sitemap: ' + server.url + '/sitemap.xml')
    })

    it('Should get security.txt', async function () {
      await makeGetRequest({
        url: server.url,
        path: '/security.txt',
        expectedStatus: HttpStatusCode.MOVED_PERMANENTLY_301
      })
    })

    it('Should get nodeinfo', async function () {
      const res = await makeGetRequest({
        url: server.url,
        path: '/nodeinfo/2.0.json',
        expectedStatus: HttpStatusCode.OK_200
      })

      expect(res.body.software.name).to.equal('peertube')
      expect(res.body.usage.users.activeMonth).to.equal(1)
      expect(res.body.usage.users.activeHalfyear).to.equal(1)
    })
  })

  describe('Test bots endpoints', function () {
    let uuid1: string
    let user1Token: string

    // Get the sitemap index and the content of all its sitemap pages
    async function getSitemap (cacheKey?: string) {
      // Use a different key to avoid the cache
      const query = cacheKey
        ? '?t=' + cacheKey
        : ''

      const index = await makeGetRequest({ url: server.url, path: '/sitemap.xml' + query, expectedStatus: HttpStatusCode.OK_200 })
      const pageUrls = [ ...index.text.matchAll(/<loc>([^<]+)<\/loc>/g) ].map(m => m[1])

      const pages: string[] = []

      for (const pageUrl of pageUrls) {
        const res = await makeGetRequest({
          url: server.url,
          path: new URL(pageUrl).pathname + query,
          expectedStatus: HttpStatusCode.OK_200
        })
        pages.push(res.text)
      }

      return { index: index.text, pageUrls, pages, text: pages.join('\n') }
    }

    function extractLastmod (text: string, loc: string) {
      const escapedLoc = loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = new RegExp(`<loc>${escapedLoc}</loc><lastmod>([^<]+)</lastmod>`).exec(text)

      return match?.[1]
    }

    it('Should get the empty sitemap', async function () {
      const res = await getSitemap()

      expect(res.index).to.contain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.pageUrls).to.deep.equal([ server.url + '/sitemaps/pages.xml' ])

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>' + server.url + '/</loc></url>')
      expect(res.text).to.contain('<url><loc>' + server.url + '/about/instance/home</loc></url>')
      expect(res.text).to.contain('<url><loc>' + server.url + '/videos/browse</loc></url>')
    })

    it('Should get the empty cached sitemap', async function () {
      const res = await getSitemap()

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>' + server.url + '/about/instance/home</loc></url>')
    })

    it('Should add videos, channel and accounts and get sitemap', async function () {
      this.timeout(35000)

      const user1 = await server.users.generate('user1')
      user1Token = user1.token

      const { token: user2Token } = await server.users.generate('user2')
      const { token: user3Token } = await server.users.generate('user3')

      const { id: channel1Id } = await server.channels.create({
        attributes: { name: 'channel1', displayName: 'channel 1' },
        token: user1Token
      })
      const { id: channel2Id } = await server.channels.create({
        attributes: { name: 'channel2', displayName: 'channel 2' },
        token: user2Token
      })
      const { id: channel3Id } = await server.channels.create({
        attributes: { name: 'channel3', displayName: 'channel 3' },
        token: user3Token
      })

      const video1 = await server.videos.upload({ attributes: { name: 'video 1', nsfw: false }, videoChannelId: channel1Id })
      uuid1 = video1.uuid
      await server.videos.upload({ attributes: { name: 'video 2', nsfw: false }, videoChannelId: channel2Id })
      await server.videos.upload({ attributes: { name: 'video 3', privacy: VideoPrivacy.PRIVATE }, videoChannelId: channel3Id })

      await server.videos.update({
        id: uuid1,
        attributes: {
          tags: [ 'fish', 'chips' ]
        }
      })

      const res = await getSitemap('1')

      expect(res.text).to.contain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
      expect(res.text).to.contain('<url><loc>' + server.url + '/about/instance/home</loc></url>')

      expect(res.text).to.contain('<video:title>video 1</video:title>')
      expect(res.text).to.contain('<video:title>video 2</video:title>')
      expect(res.text).to.not.contain('<video:title>video 3</video:title>')

      expect(res.text).to.match(/<video:thumbnail_loc>.*\.jpg<\/video:thumbnail_loc>/)
      expect(res.text).to.match(/<video:content_loc>.*\.webm<\/video:content_loc>/)
      expect(res.text).to.match(/<video:player_loc>.*\/videos\/embed\/.*<\/video:player_loc>/)
      expect(res.text).to.match(/<video:duration>.*<\/video:duration>/)
      expect(res.text).to.match(/<video:rating>0<\/video:rating>/)
      expect(res.text).to.match(/<video:view_count>0<\/video:view_count>/)
      expect(res.text).to.match(/<video:publication_date>.*<\/video:publication_date>/)
      expect(res.text).to.match(/<video:tag>fish<\/video:tag>/)
      expect(res.text).to.match(/<video:tag>chips<\/video:tag>/)
      expect(res.text).to.match(/<video:uploader.*>channel 1<\/video:uploader>/)
      expect(res.text).to.match(/<video:live>NO<\/video:live>/)

      expect(res.text).to.contain('<loc>' + server.url + '/c/channel1/videos</loc>')
      expect(res.text).to.contain('<loc>' + server.url + '/c/channel2/videos</loc>')
      expect(res.text).to.not.contain('<url><loc>' + server.url + '/c/channel3/videos</loc></url>')

      expect(res.text).to.contain('<loc>' + server.url + '/a/user1/video-channels</loc>')
      expect(res.text).to.contain('<loc>' + server.url + '/a/user2/video-channels</loc>')
      expect(res.text).to.not.contain('<url><loc>' + server.url + '/a/user3/video-channels</loc></url>')

      const isoDateRegexp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

      expect(extractLastmod(res.text, server.url + '/w/' + uuidToShort(uuid1))).to.match(isoDateRegexp)
      expect(extractLastmod(res.text, server.url + '/c/channel1/videos')).to.match(isoDateRegexp)
      expect(extractLastmod(res.text, server.url + '/a/user1/video-channels')).to.match(isoDateRegexp)
    })

    it('Should only update the video lastmod when relevant content changed', async function () {
      this.timeout(20000)

      const videoLoc = server.url + '/w/' + uuidToShort(uuid1)

      const getLastmod = async (query: string) => {
        const res = await getSitemap(query)

        return extractLastmod(res.text, videoLoc)
      }

      const initialLastmod = await getLastmod('lastmod-1')

      // Updating tags only should not change the lastmod value
      await server.videos.update({ id: uuid1, attributes: { tags: [ 'sea', 'bass' ] } })
      const afterTagsUpdateLastmod = await getLastmod('lastmod-2')
      expect(afterTagsUpdateLastmod).to.equal(initialLastmod)

      // Updating the name should bump the lastmod value
      await wait(1500)
      await server.videos.update({ id: uuid1, attributes: { name: 'video 1 updated' } })
      const afterNameUpdateLastmod = await getLastmod('lastmod-3')
      expect(afterNameUpdateLastmod).to.not.equal(initialLastmod)
      expect(new Date(afterNameUpdateLastmod).getTime()).to.be.greaterThan(new Date(initialLastmod).getTime())
    })

    it('Should update the channel lastmod when it is updated', async function () {
      this.timeout(20000)

      const channelLoc = server.url + '/c/channel1/videos'

      const res1 = await getSitemap('channel-lastmod-1')
      const initialLastmod = extractLastmod(res1.text, channelLoc)

      await wait(1500)
      await server.channels.update({
        channelName: 'channel1',
        token: user1Token,
        attributes: { displayName: 'channel 1 updated' }
      })

      const res2 = await getSitemap('channel-lastmod-2')
      const updatedLastmod = extractLastmod(res2.text, channelLoc)

      expect(updatedLastmod).to.not.equal(initialLastmod)
      expect(new Date(updatedLastmod).getTime()).to.be.greaterThan(new Date(initialLastmod).getTime())
    })

    it('Should update the account lastmod when it is updated', async function () {
      this.timeout(20000)

      const accountLoc = server.url + '/a/user1/video-channels'

      const res1 = await getSitemap('account-lastmod-1')
      const initialLastmod = extractLastmod(res1.text, accountLoc)

      await wait(1500)
      await server.users.updateMe({ token: user1Token, description: 'updated bio' })

      const res2 = await getSitemap('account-lastmod-2')
      const updatedLastmod = extractLastmod(res2.text, accountLoc)

      expect(updatedLastmod).to.not.equal(initialLastmod)
      expect(new Date(updatedLastmod).getTime()).to.be.greaterThan(new Date(initialLastmod).getTime())
    })

    it('Should not fail with big title/description videos', async function () {
      const name = 'v'.repeat(115)

      await server.videos.upload({ attributes: { name, description: 'd'.repeat(2500), nsfw: false } })

      const res = await getSitemap('2')

      await expectLogDoesNotContain(server, 'Warning in sitemap generation')
      await expectLogDoesNotContain(server, 'Error in sitemap generation')

      expect(res.text).to.contain(`<video:title>${'v'.repeat(97)}...</video:title>`)
    })

    it('Should use the plain text video description', async function () {
      await server.videos.upload({ attributes: { name: 'markdown video', description: '**Fish** & <i>chips</i>', nsfw: false } })

      const res = await getSitemap('3')

      expect(res.text).to.contain('<video:description>Fish &amp; chips</video:description>')
    })

    it('Should paginate the sitemap', async function () {
      const { index, pageUrls, pages } = await getSitemap('pagination')

      expect(pageUrls[0]).to.equal(server.url + '/sitemaps/pages.xml')

      const pagesByType: { [type: string]: string[] } = { videos: [], channels: [], accounts: [] }

      for (let i = 1; i < pageUrls.length; i++) {
        const [ , type ] = /\/sitemaps\/(videos|channels|accounts)\/\d+\.xml$/.exec(pageUrls[i])

        expect(extractLastmod(index, pageUrls[i])).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

        // Test instances have 2 ids per sitemap page
        const urls = pages[i].match(/<url>/g)
        expect(urls.length).to.be.at.least(1)
        expect(urls.length).to.be.at.most(2)

        pagesByType[type].push(pages[i])
      }

      const videoTitles = pagesByType.videos.join('').match(/<video:title>[^<]+<\/video:title>/g)
      expect(videoTitles).to.have.lengthOf(4)
      expect(new Set(videoTitles).size).to.equal(4)

      const channelLocs = pagesByType.channels.join('').match(/<loc>[^<]+<\/loc>/g)
      expect(channelLocs).to.have.lengthOf(3)
      expect(new Set(channelLocs).size).to.equal(3)

      const accountLocs = pagesByType.accounts.join('').match(/<loc>[^<]+<\/loc>/g)
      expect(accountLocs).to.have.lengthOf(3)
      expect(new Set(accountLocs).size).to.equal(3)
    })

    it('Should not shift sitemap pages when a video is deleted', async function () {
      const getVideoPages = async (cacheKey: string) => {
        const { pageUrls, pages } = await getSitemap(cacheKey)

        return pageUrls
          .map((url, i) => ({ url, titles: pages[i].match(/<video:title>[^<]+<\/video:title>/g) || [] }))
          .filter(({ url }) => url.includes('/sitemaps/videos/'))
      }

      const { uuid } = await server.videos.quickUpload({ name: 'video to delete' })
      await server.videos.quickUpload({ name: 'video after deleted one 1' })
      await server.videos.quickUpload({ name: 'video after deleted one 2' })

      const before = await getVideoPages('shift-1')
      expect(before.flatMap(p => p.titles)).to.include('<video:title>video to delete</video:title>')
      expect(before.flatMap(p => p.titles)).to.include('<video:title>video after deleted one 2</video:title>')

      await server.videos.remove({ id: uuid })

      const after = await getVideoPages('shift-2')

      for (const page of after) {
        const pageBefore = before.find(p => p.url === page.url)

        expect(page.titles).to.deep.equal(pageBefore.titles.filter(t => t !== '<video:title>video to delete</video:title>'))
      }
    })

    it('Should fail with an invalid or a non existing sitemap page', async function () {
      const invalidPaths = [
        '/sitemaps/videos/0.xml',
        '/sitemaps/videos/toto.xml',
        '/sitemaps/videos/01.xml',
        '/sitemaps/videos/99999999999999999999.xml',
        '/sitemaps/videos/1e21.xml',
        '/sitemaps/channels/-1.xml'
      ]

      for (const path of invalidPaths) {
        await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
      }

      for (const path of [ '/sitemaps/videos/1000.xml', '/sitemaps/channels/1000.xml', '/sitemaps/accounts/1000.xml' ]) {
        await makeGetRequest({ url: server.url, path, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
      }
    })

    it('Should use an experimental env variable to update video URLs', async function () {
      const video = await server.videos.get({ id: uuid1 })

      {
        const res = await getSitemap('3')

        const url = server.url + '/w/' + uuidToShort(video.uuid)
        expect(res.text).to.contain(`<loc>${url}</loc>`)
      }

      await server.kill()
      await server.run({}, { env: { EXPERIMENTAL_SITEMAP_VIDEO_URL: 'true' } })

      {
        const res = await getSitemap('4')

        const url = server.url + '/videos/watch/' + video.uuid
        expect(res.text).to.contain(`<loc>${url}</loc>`)
      }
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
