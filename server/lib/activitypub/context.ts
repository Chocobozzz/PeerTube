import { ContextType } from '@shared/models'
import { Hooks } from '../plugins/hooks'

async function activityPubContextify <T> (data: T, type: ContextType) {
  return { ...await getContextData(type), ...data }
}

// ---------------------------------------------------------------------------

export {
  getContextData,
  activityPubContextify
}

// ---------------------------------------------------------------------------

type ContextValue = { [ id: string ]: (string | { '@type': string, '@id': string }) }

const contextStore: { [ id in ContextType ]: (string | { [ id: string ]: string })[] } = {
  Video: buildContext({
    Hashtag: 'as:Hashtag',
    uuid: 'sc:identifier',
    category: 'sc:category',
    licence: 'sc:license',
    subtitleLanguage: 'sc:subtitleLanguage',
    sensitive: 'as:sensitive',
    language: 'sc:inLanguage',
    identifier: 'sc:identifier',

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

    tileWidth: {
      '@type': 'sc:Number',
      '@id': 'pt:tileWidth'
    },
    tileHeight: {
      '@type': 'sc:Number',
      '@id': 'pt:tileHeight'
    },
    tileDuration: {
      '@type': 'sc:Number',
      '@id': 'pt:tileDuration'
    },

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
    shares: {
      '@id': 'as:shares',
      '@type': '@id'
    },
    comments: {
      '@id': 'as:comments',
      '@type': '@id'
    }
  }),

  Playlist: buildContext({
    Playlist: 'pt:Playlist',
    PlaylistElement: 'pt:PlaylistElement',
    position: {
      '@type': 'sc:Number',
      '@id': 'pt:position'
    },
    startTimestamp: {
      '@type': 'sc:Number',
      '@id': 'pt:startTimestamp'
    },
    stopTimestamp: {
      '@type': 'sc:Number',
      '@id': 'pt:stopTimestamp'
    },
    uuid: 'sc:identifier'
  }),

  CacheFile: buildContext({
    expires: 'sc:expires',
    CacheFile: 'pt:CacheFile'
  }),

  Flag: buildContext({
    Hashtag: 'as:Hashtag'
  }),

  Actor: buildContext({
    playlists: {
      '@id': 'pt:playlists',
      '@type': '@id'
    },
    support: {
      '@type': 'sc:Text',
      '@id': 'pt:support'
    },

    // TODO: remove in a few versions, introduced in 4.2
    icons: 'as:icon'
  }),

  WatchAction: buildContext({
    WatchAction: 'sc:WatchAction',
    startTimestamp: {
      '@type': 'sc:Number',
      '@id': 'pt:startTimestamp'
    },
    stopTimestamp: {
      '@type': 'sc:Number',
      '@id': 'pt:stopTimestamp'
    },
    watchSection: {
      '@type': 'sc:Number',
      '@id': 'pt:stopTimestamp'
    },
    uuid: 'sc:identifier'
  }),

  Collection: buildContext(),
  Follow: buildContext(),
  Reject: buildContext(),
  Accept: buildContext(),
  View: buildContext(),
  Announce: buildContext(),
  Comment: buildContext(),
  Delete: buildContext(),
  Rate: buildContext()
}

async function getContextData (type: ContextType) {
  const contextData = await Hooks.wrapObject(
    contextStore[type],
    'filter:activity-pub.activity.context.build.result'
  )

  return { '@context': contextData }
}

function buildContext (contextValue?: ContextValue) {
  const baseContext = [
    'https://www.w3.org/ns/activitystreams',
    'https://w3id.org/security/v1',
    {
      RsaSignature2017: 'https://w3id.org/security#RsaSignature2017'
    }
  ]

  if (!contextValue) return baseContext

  return [
    ...baseContext,

    {
      pt: 'https://joinpeertube.org/ns#',
      sc: 'http://schema.org/',

      ...contextValue
    }
  ]
}
