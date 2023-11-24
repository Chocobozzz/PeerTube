import { ContextType } from '@peertube/peertube-models'
import { ACTIVITY_PUB } from '@server/initializers/constants.js'
import { buildDigest } from './peertube-crypto.js'
import type { signJsonLDObject } from './peertube-jsonld.js'

export type ContextFilter = <T> (arg: T) => Promise<T>

export function buildGlobalHTTPHeaders (
  body: any,
  digestBuilder: typeof buildDigest
) {
  return {
    'digest': digestBuilder(body),
    'content-type': 'application/activity+json',
    'accept': ACTIVITY_PUB.ACCEPT_HEADER
  }
}

export async function activityPubContextify <T> (data: T, type: ContextType, contextFilter: ContextFilter) {
  return { ...await getContextData(type, contextFilter), ...data }
}

export async function signAndContextify <T> (options: {
  byActor: { url: string, privateKey: string }
  data: T
  contextType: ContextType | null
  contextFilter: ContextFilter
  signerFunction: typeof signJsonLDObject<T>
}) {
  const { byActor, data, contextType, contextFilter, signerFunction } = options

  const activity = contextType
    ? await activityPubContextify(data, contextType, contextFilter)
    : data

  return signerFunction({ byActor, data: activity })
}

// ---------------------------------------------------------------------------
// Private
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

    uploadDate: 'sc:uploadDate',

    hasParts: 'sc:hasParts',

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
  Rate: buildContext(),

  Chapters: buildContext({
    name: 'sc:name',
    hasPart: 'sc:hasPart',
    endOffset: 'sc:endOffset',
    startOffset: 'sc:startOffset'
  })
}

async function getContextData (type: ContextType, contextFilter: ContextFilter) {
  const contextData = contextFilter
    ? await contextFilter(contextStore[type])
    : contextStore[type]

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
