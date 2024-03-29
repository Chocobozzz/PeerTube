import { ContextType } from '@peertube/peertube-models'
import { ACTIVITY_PUB, REMOTE_SCHEME } from '@server/initializers/constants.js'
import { isArray } from './custom-validators/misc.js'
import { buildDigest } from './peertube-crypto.js'
import type { signJsonLDObject } from './peertube-jsonld.js'
import { doJSONRequest } from './requests.js'

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

export async function getApplicationActorOfHost (host: string) {
  const url = REMOTE_SCHEME.HTTP + '://' + host + '/.well-known/nodeinfo'
  const { body } = await doJSONRequest<{ links: { rel: string, href: string }[] }>(url)

  if (!isArray(body.links)) return undefined

  const found = body.links.find(l => l.rel === 'https://www.w3.org/ns/activitystreams#Application')

  return found?.href || undefined
}

export function getAPPublicValue (): 'https://www.w3.org/ns/activitystreams#Public' {
  return 'https://www.w3.org/ns/activitystreams#Public'
}

export function hasAPPublic (toOrCC: string[]) {
  if (!isArray(toOrCC)) return false

  const publicValue = getAPPublicValue()

  return toOrCC.some(f => f === 'as:Public' || publicValue)
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

type ContextValue = { [ id: string ]: (string | { '@type': string, '@id': string }) }

const contextStore: { [ id in ContextType ]: (string | { [ id: string ]: string })[] } = {
  Video: buildContext({
    Hashtag: 'as:Hashtag',
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
    aspectRatio: {
      '@type': 'sc:Float',
      '@id': 'pt:aspectRatio'
    },

    uuid: {
      '@type': 'sc:identifier',
      '@id': 'pt:uuid'
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

    // Keep for federation compatibility
    commentsEnabled: {
      '@type': 'sc:Boolean',
      '@id': 'pt:commentsEnabled'
    },

    canReply: 'pt:canReply',
    commentsPolicy: {
      '@type': 'sc:Number',
      '@id': 'pt:commentsPolicy'
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
    uuid: {
      '@type': 'sc:identifier',
      '@id': 'pt:uuid'
    }
  }),

  CacheFile: buildContext({
    expires: 'sc:expires',
    CacheFile: 'pt:CacheFile',
    size: {
      '@type': 'sc:Number',
      '@id': 'pt:size'
    },
    fps: {
      '@type': 'sc:Number',
      '@id': 'pt:fps'
    }
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

    lemmy: 'https://join-lemmy.org/ns#',
    postingRestrictedToMods: 'lemmy:postingRestrictedToMods',

    // TODO: remove in a few versions, introduced in 4.2
    icons: 'as:icon'
  }),

  WatchAction: buildContext({
    WatchAction: 'sc:WatchAction',
    startTimestamp: {
      '@type': 'sc:Number',
      '@id': 'pt:startTimestamp'
    },
    endTimestamp: {
      '@type': 'sc:Number',
      '@id': 'pt:endTimestamp'
    },
    uuid: {
      '@type': 'sc:identifier',
      '@id': 'pt:uuid'
    },
    actionStatus: 'sc:actionStatus',
    watchSections: {
      '@type': '@id',
      '@id': 'pt:watchSections'
    },
    addressRegion: 'sc:addressRegion',
    addressCountry: 'sc:addressCountry'
  }),

  View: buildContext({
    WatchAction: 'sc:WatchAction',
    InteractionCounter: 'sc:InteractionCounter',
    interactionType: 'sc:interactionType',
    userInteractionCount: 'sc:userInteractionCount'
  }),

  Collection: buildContext(),
  Follow: buildContext(),
  Reject: buildContext(),
  Accept: buildContext(),
  Announce: buildContext(),

  Comment: buildContext({
    replyApproval: 'pt:replyApproval'
  }),

  Delete: buildContext(),
  Rate: buildContext(),

  ApproveReply: buildContext({
    ApproveReply: 'pt:ApproveReply'
  }),
  RejectReply: buildContext({
    RejectReply: 'pt:RejectReply'
  }),

  Chapters: buildContext({
    hasPart: 'sc:hasPart',
    endOffset: 'sc:endOffset',
    startOffset: 'sc:startOffset'
  })
}

let allContext: (string | ContextValue)[]
export function getAllContext () {
  if (allContext) return allContext

  const processed = new Set<string>()
  allContext = []

  let staticContext: ContextValue = {}

  for (const v of Object.values(contextStore)) {
    for (const item of v) {
      if (typeof item === 'string') {
        if (!processed.has(item)) {
          allContext.push(item)
        }

        processed.add(item)
      } else {
        for (const subKey of Object.keys(item)) {
          if (!processed.has(subKey)) {
            staticContext = { ...staticContext, [subKey]: item[subKey] }
          }

          processed.add(subKey)
        }
      }
    }
  }

  allContext = [ ...allContext, staticContext ]

  return allContext
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
