import { makeDeleteRequest, makeGetRequest, makePutBodyRequest } from '../requests/requests'
import { CustomConfig } from '../../models/server/custom-config.model'
import { DeepPartial, HttpStatusCode } from '@shared/core-utils'
import { merge } from 'lodash'

function getConfig (url: string) {
  const path = '/api/v1/config'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getAbout (url: string) {
  const path = '/api/v1/config/about'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: HttpStatusCode.OK_200
  })
}

function getCustomConfig (url: string, token: string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/config/custom'

  return makeGetRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function updateCustomConfig (url: string, token: string, newCustomConfig: CustomConfig, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/config/custom'

  return makePutBodyRequest({
    url,
    token,
    path,
    fields: newCustomConfig,
    statusCodeExpected
  })
}

function updateCustomSubConfig (url: string, token: string, newConfig: DeepPartial<CustomConfig>) {
  const updateParams: CustomConfig = {
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
      defaultNSFWPolicy: 'blur',

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
        username: '@MySuperUsername',
        whitelisted: true
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
      }
    },
    signup: {
      enabled: false,
      limit: 5,
      requiresEmailVerification: false,
      minimumAge: 16
    },
    admin: {
      email: 'superadmin1@example.com'
    },
    contactForm: {
      enabled: true
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
      concurrency: 3,
      profile: 'default',
      resolutions: {
        '0p': false,
        '240p': false,
        '360p': true,
        '480p': true,
        '720p': false,
        '1080p': false,
        '1440p': false,
        '2160p': false
      },
      webtorrent: {
        enabled: true
      },
      hls: {
        enabled: false
      }
    },
    live: {
      enabled: true,
      allowReplay: false,
      maxDuration: -1,
      maxInstanceLives: -1,
      maxUserLives: 50,
      transcoding: {
        enabled: true,
        threads: 4,
        profile: 'default',
        resolutions: {
          '240p': true,
          '360p': true,
          '480p': true,
          '720p': true,
          '1080p': true,
          '1440p': true,
          '2160p': true
        }
      }
    },
    import: {
      videos: {
        concurrency: 3,
        http: {
          enabled: false
        },
        torrent: {
          enabled: false
        }
      }
    },
    trending: {
      videos: {
        algorithms: {
          enabled: [ 'best', 'hot', 'most-viewed', 'most-liked' ],
          default: 'hot'
        }
      }
    },
    autoBlacklist: {
      videos: {
        ofUsers: {
          enabled: false
        }
      }
    },
    followers: {
      instance: {
        enabled: true,
        manualApproval: false
      }
    },
    followings: {
      instance: {
        autoFollowBack: {
          enabled: false
        },
        autoFollowIndex: {
          indexUrl: 'https://instances.joinpeertube.org/api/v1/instances/hosts',
          enabled: false
        }
      }
    },
    broadcastMessage: {
      enabled: true,
      level: 'warning',
      message: 'hello',
      dismissable: true
    },
    search: {
      remoteUri: {
        users: true,
        anonymous: true
      },
      searchIndex: {
        enabled: true,
        url: 'https://search.joinpeertube.org',
        disableLocalSearch: true,
        isDefaultSearch: true
      }
    }
  }

  merge(updateParams, newConfig)

  return updateCustomConfig(url, token, updateParams)
}

function getCustomConfigResolutions (enabled: boolean) {
  return {
    '240p': enabled,
    '360p': enabled,
    '480p': enabled,
    '720p': enabled,
    '1080p': enabled,
    '1440p': enabled,
    '2160p': enabled
  }
}

function deleteCustomConfig (url: string, token: string, statusCodeExpected = HttpStatusCode.OK_200) {
  const path = '/api/v1/config/custom'

  return makeDeleteRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

// ---------------------------------------------------------------------------

export {
  getConfig,
  getCustomConfig,
  updateCustomConfig,
  getAbout,
  deleteCustomConfig,
  updateCustomSubConfig,
  getCustomConfigResolutions
}
