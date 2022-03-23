import { ContextType } from '@shared/models'

function getContextData (type: ContextType) {
  const context: any[] = [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    {
      RsaSignature2017: 'https://w3id.org/security#RsaSignature2017'
    }
  ]

  if (type !== 'View' && type !== 'Announce') {
    const additional = {
      pt: 'https://joinpeertube.org/ns#',
      sc: 'http://schema.org#'
    }

    if (type === 'CacheFile') {
      Object.assign(additional, {
        expires: 'sc:expires',
        CacheFile: 'pt:CacheFile'
      })
    } else {
      Object.assign(additional, {
        Hashtag: 'as:Hashtag',
        uuid: 'sc:identifier',
        category: 'sc:category',
        licence: 'sc:license',
        subtitleLanguage: 'sc:subtitleLanguage',
        sensitive: 'as:sensitive',
        language: 'sc:inLanguage',

        // TODO: remove in a few versions, introduced in 4.2
        icons: 'as:icon',

        isLiveBroadcast: 'sc:isLiveBroadcast',
        liveSaveReplay: {
          '@type': 'sc:Boolean',
          '@id': 'pt:liveSaveReplay'
        },
        permanentLive: {
          '@type': 'sc:Boolean',
          '@id': 'pt:permanentLive'
        },
        latencyMode: {
          '@type': 'sc:Number',
          '@id': 'pt:latencyMode'
        },

        Infohash: 'pt:Infohash',
        Playlist: 'pt:Playlist',
        PlaylistElement: 'pt:PlaylistElement',

        originallyPublishedAt: 'sc:datePublished',
        views: {
          '@type': 'sc:Number',
          '@id': 'pt:views'
        },
        state: {
          '@type': 'sc:Number',
          '@id': 'pt:state'
        },
        size: {
          '@type': 'sc:Number',
          '@id': 'pt:size'
        },
        fps: {
          '@type': 'sc:Number',
          '@id': 'pt:fps'
        },
        startTimestamp: {
          '@type': 'sc:Number',
          '@id': 'pt:startTimestamp'
        },
        stopTimestamp: {
          '@type': 'sc:Number',
          '@id': 'pt:stopTimestamp'
        },
        position: {
          '@type': 'sc:Number',
          '@id': 'pt:position'
        },
        commentsEnabled: {
          '@type': 'sc:Boolean',
          '@id': 'pt:commentsEnabled'
        },
        downloadEnabled: {
          '@type': 'sc:Boolean',
          '@id': 'pt:downloadEnabled'
        },
        waitTranscoding: {
          '@type': 'sc:Boolean',
          '@id': 'pt:waitTranscoding'
        },
        support: {
          '@type': 'sc:Text',
          '@id': 'pt:support'
        },
        likes: {
          '@id': 'as:likes',
          '@type': '@id'
        },
        dislikes: {
          '@id': 'as:dislikes',
          '@type': '@id'
        },
        playlists: {
          '@id': 'pt:playlists',
          '@type': '@id'
        },
        shares: {
          '@id': 'as:shares',
          '@type': '@id'
        },
        comments: {
          '@id': 'as:comments',
          '@type': '@id'
        }
      })
    }

    context.push(additional)
  }

  return {
    '@context': context
  }
}

function activityPubContextify <T> (data: T, type: ContextType = 'All') {
  return Object.assign({}, data, getContextData(type))
}

export {
  getContextData,
  activityPubContextify
}
