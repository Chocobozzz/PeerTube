/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { VideoEmbedPrivacy, VideoEmbedPrivacyPolicy } from '@peertube/peertube-models'
import {
  cleanupTests,
  createMultipleServers,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'

describe('Test video embed privacy', function () {
  let servers: PeerTubeServer[]
  let videoId: string
  let userToken: string

  before(async function () {
    this.timeout(120000)

    servers = await createMultipleServers(2)
    await setAccessTokensToServers(servers)

    const { uuid } = await servers[0].videos.quickUpload({ name: 'video' })
    videoId = uuid

    userToken = await servers[0].users.generateUserAndToken('user1')

    await doubleFollow(servers[0], servers[1])
  })

  it('Should get default video embed privacy', async function () {
    const policy = { id: VideoEmbedPrivacyPolicy.ALL_ALLOWED, label: 'All allowed' }

    {
      const body = await servers[0].videoEmbedPrivacy.get({ videoId })
      expect(body).to.deep.equal({ policy, domains: [] } satisfies VideoEmbedPrivacy)
    }

    {
      const video = await servers[0].videos.get({ id: videoId })
      expect(video.embedPrivacyPolicy).to.deep.equal(policy)
    }

    {
      const result = await servers[0].videoEmbedPrivacy.isDomainAllowed({ videoId, domain: 'toto.example.com' })
      expect(result).to.deep.equal({ domainAllowed: true, userBypassAllowed: null })
    }
  })

  it('Should update video embed privacy to allowlist', async function () {
    await servers[0].videoEmbedPrivacy.update({
      videoId,
      policy: VideoEmbedPrivacyPolicy.ALLOWLIST,
      domains: [ 'example.com' ]
    })

    const policy = { id: VideoEmbedPrivacyPolicy.ALLOWLIST, label: 'Allowlist' }

    {
      const body = await servers[0].videoEmbedPrivacy.get({ videoId })
      expect(body).to.deep.equal({ policy, domains: [ 'example.com' ] } satisfies VideoEmbedPrivacy)
    }

    {
      const video = await servers[0].videos.get({ id: videoId })
      expect(video.embedPrivacyPolicy).to.deep.equal(policy)
    }
  })

  it('Should have federated video embed privacy', async function () {
    await waitJobs(servers)

    const video = await servers[1].videos.get({ id: videoId })
    expect(video.embedPrivacyPolicy.id).to.equal(VideoEmbedPrivacyPolicy.REMOTE_RESTRICTIONS)
  })

  it('Should check if embed is allowed on a domain', async function () {
    for (const server of servers) {
      {
        const result = await server.videoEmbedPrivacy.isDomainAllowed({ videoId, domain: 'toto.example.com' })
        expect(result).to.deep.equal({ domainAllowed: false, userBypassAllowed: true })
      }

      {
        const result = await server.videoEmbedPrivacy.isDomainAllowed({ videoId, domain: 'toto.example.com', token: null })
        expect(result).to.deep.equal({ domainAllowed: false, userBypassAllowed: false })
      }
    }

    {
      const result = await servers[0].videoEmbedPrivacy.isDomainAllowed({ videoId, domain: 'toto.example.com', token: userToken })
      expect(result).to.deep.equal({ domainAllowed: false, userBypassAllowed: false })
    }

    {
      const result = await servers[0].videoEmbedPrivacy.isDomainAllowed({ videoId, domain: 'example.com' })
      expect(result).to.deep.equal({ domainAllowed: true, userBypassAllowed: null })
    }

    // Only server 1 knows which domain is allowed
    {
      const result = await servers[1].videoEmbedPrivacy.isDomainAllowed({ videoId, domain: 'example.com' })
      expect(result).to.deep.equal({ domainAllowed: false, userBypassAllowed: true })
    }
  })

  it('Should add some domains to video embed privacy', async function () {
    await servers[0].videoEmbedPrivacy.update({
      videoId,
      policy: VideoEmbedPrivacyPolicy.ALLOWLIST,
      domains: [ 'example.com', 'example2.com' ]
    })

    const policy = { id: VideoEmbedPrivacyPolicy.ALLOWLIST, label: 'Allowlist' }

    {
      const body = await servers[0].videoEmbedPrivacy.get({ videoId })
      expect(body).to.deep.equal({ policy, domains: [ 'example.com', 'example2.com' ] } satisfies VideoEmbedPrivacy)
    }
  })

  it('Should remove video embed privacy restriction', async function () {
    await servers[0].videoEmbedPrivacy.update({
      videoId,
      policy: VideoEmbedPrivacyPolicy.ALL_ALLOWED,
      domains: []
    })

    const policy = { id: VideoEmbedPrivacyPolicy.ALL_ALLOWED, label: 'All allowed' }

    {
      const body = await servers[0].videoEmbedPrivacy.get({ videoId })
      expect(body).to.deep.equal({ policy, domains: [] } satisfies VideoEmbedPrivacy)
    }

    await waitJobs(servers)

    {
      const video = await servers[1].videos.get({ id: videoId })
      expect(video.embedPrivacyPolicy.id).to.equal(VideoEmbedPrivacyPolicy.ALL_ALLOWED)
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
