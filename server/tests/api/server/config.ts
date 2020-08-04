/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { About } from '../../../../shared/models/server/about.model'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'
import {
  cleanupTests,
  deleteCustomConfig,
  flushAndRunServer,
  getAbout,
  getConfig,
  getCustomConfig,
  killallServers,
  parallelTests,
  registerUser,
  reRunServer,
  ServerInfo,
  setAccessTokensToServers,
  updateCustomConfig,
  uploadVideo
} from '../../../../shared/extra-utils'
import { ServerConfig } from '../../../../shared/models'

const expect = chai.expect

function checkInitialConfig (server: ServerInfo, data: CustomConfig) {
  expect(data.instance.name).to.equal('PeerTube')
  expect(data.instance.shortDescription).to.equal(
    'PeerTube, an ActivityPub-federated video streaming platform using P2P directly in your web browser.'
  )
  expect(data.instance.description).to.equal('Welcome to this PeerTube instance!')

  expect(data.instance.terms).to.equal('No terms for now.')
  expect(data.instance.creationReason).to.be.empty
  expect(data.instance.codeOfConduct).to.be.empty
  expect(data.instance.moderationInformation).to.be.empty
  expect(data.instance.administrator).to.be.empty
  expect(data.instance.maintenanceLifetime).to.be.empty
  expect(data.instance.businessModel).to.be.empty
  expect(data.instance.hardwareInformation).to.be.empty

  expect(data.instance.languages).to.have.lengthOf(0)
  expect(data.instance.categories).to.have.lengthOf(0)

  expect(data.instance.defaultClientRoute).to.equal('/videos/trending')
  expect(data.instance.isNSFW).to.be.false
  expect(data.instance.defaultNSFWPolicy).to.equal('display')
  expect(data.instance.customizations.css).to.be.empty
  expect(data.instance.customizations.javascript).to.be.empty

  expect(data.services.twitter.username).to.equal('@Chocobozzz')
  expect(data.services.twitter.whitelisted).to.be.false

  expect(data.cache.previews.size).to.equal(1)
  expect(data.cache.captions.size).to.equal(1)

  expect(data.signup.enabled).to.be.true
  expect(data.signup.limit).to.equal(4)
  expect(data.signup.requiresEmailVerification).to.be.false

  expect(data.admin.email).to.equal('admin' + server.internalServerNumber + '@example.com')
  expect(data.contactForm.enabled).to.be.true

  expect(data.user.videoQuota).to.equal(5242880)
  expect(data.user.videoQuotaDaily).to.equal(-1)
  expect(data.transcoding.enabled).to.be.false
  expect(data.transcoding.allowAdditionalExtensions).to.be.false
  expect(data.transcoding.allowAudioFiles).to.be.false
  expect(data.transcoding.threads).to.equal(2)
  expect(data.transcoding.resolutions['240p']).to.be.true
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.true
  expect(data.transcoding.resolutions['1080p']).to.be.true
  expect(data.transcoding.resolutions['2160p']).to.be.true
  expect(data.transcoding.webtorrent.enabled).to.be.true
  expect(data.transcoding.hls.enabled).to.be.true

  expect(data.import.videos.http.enabled).to.be.true
  expect(data.import.videos.torrent.enabled).to.be.true
  expect(data.autoBlacklist.videos.ofUsers.enabled).to.be.false

  expect(data.followers.instance.enabled).to.be.true
  expect(data.followers.instance.manualApproval).to.be.false

  expect(data.followings.instance.autoFollowBack.enabled).to.be.false
  expect(data.followings.instance.autoFollowIndex.enabled).to.be.false
  expect(data.followings.instance.autoFollowIndex.indexUrl).to.equal('')

  expect(data.broadcastMessage.enabled).to.be.false
  expect(data.broadcastMessage.level).to.equal('info')
  expect(data.broadcastMessage.message).to.equal('')
  expect(data.broadcastMessage.dismissable).to.be.false
}

function checkUpdatedConfig (data: CustomConfig) {
  expect(data.instance.name).to.equal('PeerTube updated')
  expect(data.instance.shortDescription).to.equal('my short description')
  expect(data.instance.description).to.equal('my super description')

  expect(data.instance.terms).to.equal('my super terms')
  expect(data.instance.creationReason).to.equal('my super creation reason')
  expect(data.instance.codeOfConduct).to.equal('my super coc')
  expect(data.instance.moderationInformation).to.equal('my super moderation information')
  expect(data.instance.administrator).to.equal('Kuja')
  expect(data.instance.maintenanceLifetime).to.equal('forever')
  expect(data.instance.businessModel).to.equal('my super business model')
  expect(data.instance.hardwareInformation).to.equal('2vCore 3GB RAM')

  expect(data.instance.languages).to.deep.equal([ 'en', 'es' ])
  expect(data.instance.categories).to.deep.equal([ 1, 2 ])

  expect(data.instance.defaultClientRoute).to.equal('/videos/recently-added')
  expect(data.instance.isNSFW).to.be.true
  expect(data.instance.defaultNSFWPolicy).to.equal('blur')
  expect(data.instance.customizations.javascript).to.equal('alert("coucou")')
  expect(data.instance.customizations.css).to.equal('body { background-color: red; }')

  expect(data.services.twitter.username).to.equal('@Kuja')
  expect(data.services.twitter.whitelisted).to.be.true

  expect(data.cache.previews.size).to.equal(2)
  expect(data.cache.captions.size).to.equal(3)

  expect(data.signup.enabled).to.be.false
  expect(data.signup.limit).to.equal(5)
  expect(data.signup.requiresEmailVerification).to.be.false

  // We override admin email in parallel tests, so skip this exception
  if (parallelTests() === false) {
    expect(data.admin.email).to.equal('superadmin1@example.com')
  }

  expect(data.contactForm.enabled).to.be.false

  expect(data.user.videoQuota).to.equal(5242881)
  expect(data.user.videoQuotaDaily).to.equal(318742)

  expect(data.transcoding.enabled).to.be.true
  expect(data.transcoding.threads).to.equal(1)
  expect(data.transcoding.allowAdditionalExtensions).to.be.true
  expect(data.transcoding.allowAudioFiles).to.be.true
  expect(data.transcoding.resolutions['240p']).to.be.false
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.false
  expect(data.transcoding.resolutions['1080p']).to.be.false
  expect(data.transcoding.resolutions['2160p']).to.be.false
  expect(data.transcoding.hls.enabled).to.be.false
  expect(data.transcoding.webtorrent.enabled).to.be.true

  expect(data.import.videos.http.enabled).to.be.false
  expect(data.import.videos.torrent.enabled).to.be.false
  expect(data.autoBlacklist.videos.ofUsers.enabled).to.be.true

  expect(data.followers.instance.enabled).to.be.false
  expect(data.followers.instance.manualApproval).to.be.true

  expect(data.followings.instance.autoFollowBack.enabled).to.be.true
  expect(data.followings.instance.autoFollowIndex.enabled).to.be.true
  expect(data.followings.instance.autoFollowIndex.indexUrl).to.equal('https://updated.example.com')

  expect(data.broadcastMessage.enabled).to.be.true
  expect(data.broadcastMessage.level).to.equal('error')
  expect(data.broadcastMessage.message).to.equal('super bad message')
  expect(data.broadcastMessage.dismissable).to.be.true
}

describe('Test config', function () {
  let server = null

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should have a correct config on a server with registration enabled', async function () {
    const res = await getConfig(server.url)
    const data: ServerConfig = res.body

    expect(data.signup.allowed).to.be.true
  })

  it('Should have a correct config on a server with registration enabled and a users limit', async function () {
    this.timeout(5000)

    await Promise.all([
      registerUser(server.url, 'user1', 'super password'),
      registerUser(server.url, 'user2', 'super password'),
      registerUser(server.url, 'user3', 'super password')
    ])

    const res = await getConfig(server.url)
    const data: ServerConfig = res.body

    expect(data.signup.allowed).to.be.false
  })

  it('Should have the correct video allowed extensions', async function () {
    const res = await getConfig(server.url)
    const data: ServerConfig = res.body

    expect(data.video.file.extensions).to.have.lengthOf(3)
    expect(data.video.file.extensions).to.contain('.mp4')
    expect(data.video.file.extensions).to.contain('.webm')
    expect(data.video.file.extensions).to.contain('.ogv')

    await uploadVideo(server.url, server.accessToken, { fixture: 'video_short.mkv' }, 400)
    await uploadVideo(server.url, server.accessToken, { fixture: 'sample.ogg' }, 400)

    expect(data.contactForm.enabled).to.be.true
  })

  it('Should get the customized configuration', async function () {
    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body as CustomConfig

    checkInitialConfig(server, data)
  })

  it('Should update the customized configuration', async function () {
    const newCustomConfig: CustomConfig = {
      instance: {
        name: 'PeerTube updated',
        shortDescription: 'my short description',
        description: 'my super description',
        terms: 'my super terms',
        codeOfConduct: 'my super coc',

        creationReason: 'my super creation reason',
        moderationInformation: 'my super moderation information',
        administrator: 'Kuja',
        maintenanceLifetime: 'forever',
        businessModel: 'my super business model',
        hardwareInformation: '2vCore 3GB RAM',

        languages: [ 'en', 'es' ],
        categories: [ 1, 2 ],

        defaultClientRoute: '/videos/recently-added',
        isNSFW: true,
        defaultNSFWPolicy: 'blur' as 'blur',
        customizations: {
          javascript: 'alert("coucou")',
          css: 'body { background-color: red; }'
        }
      },
      theme: {
        default: 'default'
      },
      services: {
        twitter: {
          username: '@Kuja',
          whitelisted: true
        }
      },
      cache: {
        previews: {
          size: 2
        },
        captions: {
          size: 3
        }
      },
      signup: {
        enabled: false,
        limit: 5,
        requiresEmailVerification: false
      },
      admin: {
        email: 'superadmin1@example.com'
      },
      contactForm: {
        enabled: false
      },
      user: {
        videoQuota: 5242881,
        videoQuotaDaily: 318742
      },
      transcoding: {
        enabled: true,
        allowAdditionalExtensions: true,
        allowAudioFiles: true,
        threads: 1,
        resolutions: {
          '0p': false,
          '240p': false,
          '360p': true,
          '480p': true,
          '720p': false,
          '1080p': false,
          '2160p': false
        },
        webtorrent: {
          enabled: true
        },
        hls: {
          enabled: false
        }
      },
      import: {
        videos: {
          http: {
            enabled: false
          },
          torrent: {
            enabled: false
          }
        }
      },
      autoBlacklist: {
        videos: {
          ofUsers: {
            enabled: true
          }
        }
      },
      followers: {
        instance: {
          enabled: false,
          manualApproval: true
        }
      },
      followings: {
        instance: {
          autoFollowBack: {
            enabled: true
          },
          autoFollowIndex: {
            enabled: true,
            indexUrl: 'https://updated.example.com'
          }
        }
      },
      broadcastMessage: {
        enabled: true,
        level: 'error',
        message: 'super bad message',
        dismissable: true
      },
      search: {
        remoteUri: {
          anonymous: true,
          users: true
        },
        searchIndex: {
          enabled: true,
          url: 'https://search.joinpeertube.org',
          disableLocalSearch: true,
          isDefaultSearch: true
        }
      }
    }
    await updateCustomConfig(server.url, server.accessToken, newCustomConfig)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    checkUpdatedConfig(data)
  })

  it('Should have the correct updated video allowed extensions', async function () {
    const res = await getConfig(server.url)
    const data: ServerConfig = res.body

    expect(data.video.file.extensions).to.have.length.above(3)
    expect(data.video.file.extensions).to.contain('.mp4')
    expect(data.video.file.extensions).to.contain('.webm')
    expect(data.video.file.extensions).to.contain('.ogv')
    expect(data.video.file.extensions).to.contain('.flv')
    expect(data.video.file.extensions).to.contain('.wmv')
    expect(data.video.file.extensions).to.contain('.mkv')
    expect(data.video.file.extensions).to.contain('.mp3')
    expect(data.video.file.extensions).to.contain('.ogg')
    expect(data.video.file.extensions).to.contain('.flac')

    await uploadVideo(server.url, server.accessToken, { fixture: 'video_short.mkv' }, 200)
    await uploadVideo(server.url, server.accessToken, { fixture: 'sample.ogg' }, 200)
  })

  it('Should have the configuration updated after a restart', async function () {
    this.timeout(10000)

    killallServers([ server ])

    await reRunServer(server)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    checkUpdatedConfig(data)
  })

  it('Should fetch the about information', async function () {
    const res = await getAbout(server.url)
    const data: About = res.body

    expect(data.instance.name).to.equal('PeerTube updated')
    expect(data.instance.shortDescription).to.equal('my short description')
    expect(data.instance.description).to.equal('my super description')
    expect(data.instance.terms).to.equal('my super terms')
    expect(data.instance.codeOfConduct).to.equal('my super coc')

    expect(data.instance.creationReason).to.equal('my super creation reason')
    expect(data.instance.moderationInformation).to.equal('my super moderation information')
    expect(data.instance.administrator).to.equal('Kuja')
    expect(data.instance.maintenanceLifetime).to.equal('forever')
    expect(data.instance.businessModel).to.equal('my super business model')
    expect(data.instance.hardwareInformation).to.equal('2vCore 3GB RAM')

    expect(data.instance.languages).to.deep.equal([ 'en', 'es' ])
    expect(data.instance.categories).to.deep.equal([ 1, 2 ])
  })

  it('Should remove the custom configuration', async function () {
    this.timeout(10000)

    await deleteCustomConfig(server.url, server.accessToken)

    const res = await getCustomConfig(server.url, server.accessToken)
    const data = res.body

    checkInitialConfig(server, data)
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
