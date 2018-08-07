import { makeDeleteRequest, makeGetRequest, makePutBodyRequest } from '../'
import { CustomConfig } from '../../../../shared/models/server/custom-config.model'

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

function updateCustomSubConfig (url: string, token: string, newConfig: any) {
  const updateParams: CustomConfig = {
    instance: {
      name: 'PeerTube updated',
      shortDescription: 'my short description',
      description: 'my super description',
      terms: 'my super terms',
      defaultClientRoute: '/videos/recently-added',
      defaultNSFWPolicy: 'blur',
      customizations: {
        javascript: 'alert("coucou")',
        css: 'body { background-color: red; }'
      }
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
      limit: 5
    },
    admin: {
      email: 'superadmin1@example.com'
    },
    user: {
      videoQuota: 5242881
    },
    transcoding: {
      enabled: true,
      threads: 1,
      resolutions: {
        '240p': false,
        '360p': true,
        '480p': true,
        '720p': false,
        '1080p': false
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
    }
  }

  Object.assign(updateParams, newConfig)

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
