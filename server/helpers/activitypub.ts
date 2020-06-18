import * as Bluebird from 'bluebird'
import validator from 'validator'
import { ResultList } from '../../shared/models'
import { Activity } from '../../shared/models/activitypub'
import { ACTIVITY_PUB, REMOTE_SCHEME } from '../initializers/constants'
import { signJsonLDObject } from './peertube-crypto'
import { pageToStartAndCount } from './core-utils'
import { URL } from 'url'
import { MActor, MVideoAccountLight } from '../types/models'
import { ContextType } from '@shared/models/activitypub/context'

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

type ActivityPubCollectionPaginationHandler = (start: number, count: number) => Bluebird<ResultList<any>> | Promise<ResultList<any>>
async function activityPubCollectionPagination (
  baseUrl: string,
  handler: ActivityPubCollectionPaginationHandler,
  page?: any,
  size = ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE
) {
  if (!page || !validator.isInt(page)) {
    // We just display the first page URL, we only need the total items
    const result = await handler(0, 1)

    return {
      id: baseUrl,
      type: 'OrderedCollectionPage',
      totalItems: result.total,
      first: baseUrl + '?page=1'
    }
  }

  const { start, count } = pageToStartAndCount(page, size)
  const result = await handler(start, count)

  let next: string | undefined
  let prev: string | undefined

  // Assert page is a number
  page = parseInt(page, 10)

  // There are more results
  if (result.total > page * size) {
    next = baseUrl + '?page=' + (page + 1)
  }

  if (page > 1) {
    prev = baseUrl + '?page=' + (page - 1)
  }

  return {
    id: baseUrl + '?page=' + page,
    type: 'OrderedCollectionPage',
    prev,
    next,
    partOf: baseUrl,
    orderedItems: result.data,
    totalItems: result.total
  }

}

function buildSignedActivity (byActor: MActor, data: Object, contextType?: ContextType) {
  const activity = activityPubContextify(data, contextType)

  return signJsonLDObject(byActor, activity) as Promise<Activity>
}

function getAPId (activity: string | { id: string }) {
  if (typeof activity === 'string') return activity

  return activity.id
}

function checkUrlsSameHost (url1: string, url2: string) {
  const idHost = new URL(url1).host
  const actorHost = new URL(url2).host

  return idHost && actorHost && idHost.toLowerCase() === actorHost.toLowerCase()
}

function buildRemoteVideoBaseUrl (video: MVideoAccountLight, path: string) {
  const host = video.VideoChannel.Account.Actor.Server.host

  return REMOTE_SCHEME.HTTP + '://' + host + path
}

// ---------------------------------------------------------------------------

export {
  checkUrlsSameHost,
  getAPId,
  activityPubContextify,
  activityPubCollectionPagination,
  buildSignedActivity,
  buildRemoteVideoBaseUrl
}
