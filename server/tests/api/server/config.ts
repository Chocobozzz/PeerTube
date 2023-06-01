/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { parallelTests } from '@shared/core-utils'
import { CustomConfig, HttpStatusCode } from '@shared/models'
import {
  cleanupTests,
  createSingleServer,
  killallServers,
  makeGetRequest,
  PeerTubeServer,
  setAccessTokensToServers
} from '@shared/server-commands'

function checkInitialConfig (server: PeerTubeServer, data: CustomConfig) {
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

  expect(data.client.videos.miniature.preferAuthorDisplayName).to.be.false
  expect(data.client.menu.login.redirectOnSingleExternalAuth).to.be.false

  expect(data.cache.previews.size).to.equal(1)
  expect(data.cache.captions.size).to.equal(1)
  expect(data.cache.torrents.size).to.equal(1)
  expect(data.cache.storyboards.size).to.equal(1)

  expect(data.signup.enabled).to.be.true
  expect(data.signup.limit).to.equal(4)
  expect(data.signup.minimumAge).to.equal(16)
  expect(data.signup.requiresApproval).to.be.false
  expect(data.signup.requiresEmailVerification).to.be.false

  expect(data.admin.email).to.equal('admin' + server.internalServerNumber + '@example.com')
  expect(data.contactForm.enabled).to.be.true

  expect(data.user.history.videos.enabled).to.be.true
  expect(data.user.videoQuota).to.equal(5242880)
  expect(data.user.videoQuotaDaily).to.equal(-1)

  expect(data.videoChannels.maxPerUser).to.equal(20)

  expect(data.transcoding.enabled).to.be.false
  expect(data.transcoding.remoteRunners.enabled).to.be.false
  expect(data.transcoding.allowAdditionalExtensions).to.be.false
  expect(data.transcoding.allowAudioFiles).to.be.false
  expect(data.transcoding.threads).to.equal(2)
  expect(data.transcoding.concurrency).to.equal(2)
  expect(data.transcoding.profile).to.equal('default')
  expect(data.transcoding.resolutions['144p']).to.be.false
  expect(data.transcoding.resolutions['240p']).to.be.true
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.true
  expect(data.transcoding.resolutions['1080p']).to.be.true
  expect(data.transcoding.resolutions['1440p']).to.be.true
  expect(data.transcoding.resolutions['2160p']).to.be.true
  expect(data.transcoding.alwaysTranscodeOriginalResolution).to.be.true
  expect(data.transcoding.webtorrent.enabled).to.be.true
  expect(data.transcoding.hls.enabled).to.be.true

  expect(data.live.enabled).to.be.false
  expect(data.live.allowReplay).to.be.false
  expect(data.live.latencySetting.enabled).to.be.true
  expect(data.live.maxDuration).to.equal(-1)
  expect(data.live.maxInstanceLives).to.equal(20)
  expect(data.live.maxUserLives).to.equal(3)
  expect(data.live.transcoding.enabled).to.be.false
  expect(data.live.transcoding.remoteRunners.enabled).to.be.false
  expect(data.live.transcoding.threads).to.equal(2)
  expect(data.live.transcoding.profile).to.equal('default')
  expect(data.live.transcoding.resolutions['144p']).to.be.false
  expect(data.live.transcoding.resolutions['240p']).to.be.false
  expect(data.live.transcoding.resolutions['360p']).to.be.false
  expect(data.live.transcoding.resolutions['480p']).to.be.false
  expect(data.live.transcoding.resolutions['720p']).to.be.false
  expect(data.live.transcoding.resolutions['1080p']).to.be.false
  expect(data.live.transcoding.resolutions['1440p']).to.be.false
  expect(data.live.transcoding.resolutions['2160p']).to.be.false
  expect(data.live.transcoding.alwaysTranscodeOriginalResolution).to.be.true

  expect(data.videoStudio.enabled).to.be.false
  expect(data.videoStudio.remoteRunners.enabled).to.be.false

  expect(data.import.videos.concurrency).to.equal(2)
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

  expect(data.client.videos.miniature.preferAuthorDisplayName).to.be.true
  expect(data.client.menu.login.redirectOnSingleExternalAuth).to.be.true

  expect(data.cache.previews.size).to.equal(2)
  expect(data.cache.captions.size).to.equal(3)
  expect(data.cache.torrents.size).to.equal(4)
  expect(data.cache.storyboards.size).to.equal(5)

  expect(data.signup.enabled).to.be.false
  expect(data.signup.limit).to.equal(5)
  expect(data.signup.requiresApproval).to.be.false
  expect(data.signup.requiresEmailVerification).to.be.false
  expect(data.signup.minimumAge).to.equal(10)

  // We override admin email in parallel tests, so skip this exception
  if (parallelTests() === false) {
    expect(data.admin.email).to.equal('superadmin1@example.com')
  }

  expect(data.contactForm.enabled).to.be.false

  expect(data.user.history.videos.enabled).to.be.false
  expect(data.user.videoQuota).to.equal(5242881)
  expect(data.user.videoQuotaDaily).to.equal(318742)

  expect(data.videoChannels.maxPerUser).to.equal(24)

  expect(data.transcoding.enabled).to.be.true
  expect(data.transcoding.remoteRunners.enabled).to.be.true
  expect(data.transcoding.threads).to.equal(1)
  expect(data.transcoding.concurrency).to.equal(3)
  expect(data.transcoding.allowAdditionalExtensions).to.be.true
  expect(data.transcoding.allowAudioFiles).to.be.true
  expect(data.transcoding.profile).to.equal('vod_profile')
  expect(data.transcoding.resolutions['144p']).to.be.false
  expect(data.transcoding.resolutions['240p']).to.be.false
  expect(data.transcoding.resolutions['360p']).to.be.true
  expect(data.transcoding.resolutions['480p']).to.be.true
  expect(data.transcoding.resolutions['720p']).to.be.false
  expect(data.transcoding.resolutions['1080p']).to.be.false
  expect(data.transcoding.resolutions['2160p']).to.be.false
  expect(data.transcoding.alwaysTranscodeOriginalResolution).to.be.false
  expect(data.transcoding.hls.enabled).to.be.false
  expect(data.transcoding.webtorrent.enabled).to.be.true

  expect(data.live.enabled).to.be.true
  expect(data.live.allowReplay).to.be.true
  expect(data.live.latencySetting.enabled).to.be.false
  expect(data.live.maxDuration).to.equal(5000)
  expect(data.live.maxInstanceLives).to.equal(-1)
  expect(data.live.maxUserLives).to.equal(10)
  expect(data.live.transcoding.enabled).to.be.true
  expect(data.live.transcoding.remoteRunners.enabled).to.be.true
  expect(data.live.transcoding.threads).to.equal(4)
  expect(data.live.transcoding.profile).to.equal('live_profile')
  expect(data.live.transcoding.resolutions['144p']).to.be.true
  expect(data.live.transcoding.resolutions['240p']).to.be.true
  expect(data.live.transcoding.resolutions['360p']).to.be.true
  expect(data.live.transcoding.resolutions['480p']).to.be.true
  expect(data.live.transcoding.resolutions['720p']).to.be.true
  expect(data.live.transcoding.resolutions['1080p']).to.be.true
  expect(data.live.transcoding.resolutions['2160p']).to.be.true
  expect(data.live.transcoding.alwaysTranscodeOriginalResolution).to.be.false

  expect(data.videoStudio.enabled).to.be.true
  expect(data.videoStudio.remoteRunners.enabled).to.be.true

  expect(data.import.videos.concurrency).to.equal(4)
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

    isNSFW: true,
    defaultNSFWPolicy: 'blur' as 'blur',

    defaultClientRoute: '/videos/recently-added',

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
  client: {
    videos: {
      miniature: {
        preferAuthorDisplayName: true
      }
    },
    menu: {
      login: {
        redirectOnSingleExternalAuth: true
      }
    }
  },
  cache: {
    previews: {
      size: 2
    },
    captions: {
      size: 3
    },
    torrents: {
      size: 4
    },
    storyboards: {
      size: 5
    }
  },
  signup: {
    enabled: false,
    limit: 5,
    requiresApproval: false,
    requiresEmailVerification: false,
    minimumAge: 10
  },
  admin: {
    email: 'superadmin1@example.com'
  },
  contactForm: {
    enabled: false
  },
  user: {
    history: {
      videos: {
        enabled: false
      }
    },
    videoQuota: 5242881,
    videoQuotaDaily: 318742
  },
  videoChannels: {
    maxPerUser: 24
  },
  transcoding: {
    enabled: true,
    remoteRunners: {
      enabled: true
    },
    allowAdditionalExtensions: true,
    allowAudioFiles: true,
    threads: 1,
    concurrency: 3,
    profile: 'vod_profile',
    resolutions: {
      '0p': false,
      '144p': false,
      '240p': false,
      '360p': true,
      '480p': true,
      '720p': false,
      '1080p': false,
      '1440p': false,
      '2160p': false
    },
    alwaysTranscodeOriginalResolution: false,
    webtorrent: {
      enabled: true
    },
    hls: {
      enabled: false
    }
  },
  live: {
    enabled: true,
    allowReplay: true,
    latencySetting: {
      enabled: false
    },
    maxDuration: 5000,
    maxInstanceLives: -1,
    maxUserLives: 10,
    transcoding: {
      enabled: true,
      remoteRunners: {
        enabled: true
      },
      threads: 4,
      profile: 'live_profile',
      resolutions: {
        '144p': true,
        '240p': true,
        '360p': true,
        '480p': true,
        '720p': true,
        '1080p': true,
        '1440p': true,
        '2160p': true
      },
      alwaysTranscodeOriginalResolution: false
    }
  },
  videoStudio: {
    enabled: true,
    remoteRunners: {
      enabled: true
    }
  },
  import: {
    videos: {
      concurrency: 4,
      http: {
        enabled: false
      },
      torrent: {
        enabled: false
      }
    },
    videoChannelSynchronization: {
      enabled: false,
      maxPerUser: 10
    }
  },
  trending: {
    videos: {
      algorithms: {
        enabled: [ 'hot', 'most-viewed', 'most-liked' ],
        default: 'hot'
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

describe('Test static config', function () {
  let server: PeerTubeServer = null

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, { webadmin: { configuration: { edition: { allowed: false } } } })
    await setAccessTokensToServers([ server ])
  })

  it('Should tell the client that edits are not allowed', async function () {
    const data = await server.config.getConfig()

    expect(data.webadmin.configuration.edition.allowed).to.be.false
  })

  it('Should error when client tries to update', async function () {
    await server.config.updateCustomConfig({ newCustomConfig, expectedStatus: 405 })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})

describe('Test config', function () {
  let server: PeerTubeServer = null

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])
  })

  it('Should have a correct config on a server with registration enabled', async function () {
    const data = await server.config.getConfig()

    expect(data.signup.allowed).to.be.true
  })

  it('Should have a correct config on a server with registration enabled and a users limit', async function () {
    this.timeout(5000)

    await Promise.all([
      server.registrations.register({ username: 'user1' }),
      server.registrations.register({ username: 'user2' }),
      server.registrations.register({ username: 'user3' })
    ])

    const data = await server.config.getConfig()

    expect(data.signup.allowed).to.be.false
  })

  it('Should have the correct video allowed extensions', async function () {
    const data = await server.config.getConfig()

    expect(data.video.file.extensions).to.have.lengthOf(3)
    expect(data.video.file.extensions).to.contain('.mp4')
    expect(data.video.file.extensions).to.contain('.webm')
    expect(data.video.file.extensions).to.contain('.ogv')

    await server.videos.upload({ attributes: { fixture: 'video_short.mkv' }, expectedStatus: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415 })
    await server.videos.upload({ attributes: { fixture: 'sample.ogg' }, expectedStatus: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415 })

    expect(data.contactForm.enabled).to.be.true
  })

  it('Should get the customized configuration', async function () {
    const data = await server.config.getCustomConfig()

    checkInitialConfig(server, data)
  })

  it('Should update the customized configuration', async function () {
    await server.config.updateCustomConfig({ newCustomConfig })

    const data = await server.config.getCustomConfig()
    checkUpdatedConfig(data)
  })

  it('Should have the correct updated video allowed extensions', async function () {
    this.timeout(30000)

    const data = await server.config.getConfig()

    expect(data.video.file.extensions).to.have.length.above(4)
    expect(data.video.file.extensions).to.contain('.mp4')
    expect(data.video.file.extensions).to.contain('.webm')
    expect(data.video.file.extensions).to.contain('.ogv')
    expect(data.video.file.extensions).to.contain('.flv')
    expect(data.video.file.extensions).to.contain('.wmv')
    expect(data.video.file.extensions).to.contain('.mkv')
    expect(data.video.file.extensions).to.contain('.mp3')
    expect(data.video.file.extensions).to.contain('.ogg')
    expect(data.video.file.extensions).to.contain('.flac')

    await server.videos.upload({ attributes: { fixture: 'video_short.mkv' }, expectedStatus: HttpStatusCode.OK_200 })
    await server.videos.upload({ attributes: { fixture: 'sample.ogg' }, expectedStatus: HttpStatusCode.OK_200 })
  })

  it('Should have the configuration updated after a restart', async function () {
    this.timeout(30000)

    await killallServers([ server ])

    await server.run()

    const data = await server.config.getCustomConfig()

    checkUpdatedConfig(data)
  })

  it('Should fetch the about information', async function () {
    const data = await server.config.getAbout()

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
    await server.config.deleteCustomConfig()

    const data = await server.config.getCustomConfig()
    checkInitialConfig(server, data)
  })

  it('Should enable/disable security headers', async function () {
    this.timeout(25000)

    {
      const res = await makeGetRequest({
        url: server.url,
        path: '/api/v1/config',
        expectedStatus: 200
      })

      expect(res.headers['x-frame-options']).to.exist
      expect(res.headers['x-powered-by']).to.equal('PeerTube')
    }

    await killallServers([ server ])

    const config = {
      security: {
        frameguard: { enabled: false },
        powered_by_header: { enabled: false }
      }
    }
    await server.run(config)

    {
      const res = await makeGetRequest({
        url: server.url,
        path: '/api/v1/config',
        expectedStatus: 200
      })

      expect(res.headers['x-frame-options']).to.not.exist
      expect(res.headers['x-powered-by']).to.not.exist
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
