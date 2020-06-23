import { makeDeleteRequest, makeGetRequest, makePutBodyRequest } from '../requests/requests'
import { CustomConfig } from '../../models/server/custom-config.model'
import { DeepPartial } from '@shared/core-utils'
import { merge } from 'lodash'

function getConfig (url: string) {
  const path = '/api/v1/config'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getAbout (url: string) {
  const path = '/api/v1/config/about'

  return makeGetRequest({
    url,
    path,
    statusCodeExpected: 200
  })
}

function getCustomConfig (url: string, token: string, statusCodeExpected = 200) {
  const path = '/api/v1/config/custom'

  return makeGetRequest({
    url,
    token,
    path,
    statusCodeExpected
  })
}

function updateCustomConfig (url: string, token: string, newCustomConfig: CustomConfig, statusCodeExpected = 200) {
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

      defaultClientRoute: '/videos/recently-added',
      isNSFW: true,
      defaultNSFWPolicy: 'blur',
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

function deleteCustomConfig (url: string, token: string, statusCodeExpected = 200) {
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
  updateCustomSubConfig
}
