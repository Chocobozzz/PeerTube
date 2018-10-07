import * as Bluebird from 'bluebird'
import * as validator from 'validator'
import { ResultList } from '../../shared/models'
import { Activity, ActivityPubActor } from '../../shared/models/activitypub'
import { ACTIVITY_PUB } from '../initializers'
import { ActorModel } from '../models/activitypub/actor'
import { signObject } from './peertube-crypto'
import { pageToStartAndCount } from './core-utils'

function activityPubContextify <T> (data: T) {
  return Object.assign(data, {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        RsaSignature2017: 'https://w3id.org/security#RsaSignature2017',
        pt: 'https://joinpeertube.org/ns',
        schema: 'http://schema.org#',
        Hashtag: 'as:Hashtag',
        uuid: 'schema:identifier',
        category: 'schema:category',
        licence: 'schema:license',
        subtitleLanguage: 'schema:subtitleLanguage',
        sensitive: 'as:sensitive',
        language: 'schema:inLanguage',
        views: 'schema:Number',
        stats: 'schema:Number',
        size: 'schema:Number',
        fps: 'schema:Number',
        commentsEnabled: 'schema:Boolean',
        waitTranscoding: 'schema:Boolean',
        expires: 'schema:expires',
        support: 'schema:Text',
        CacheFile: 'pt:CacheFile'
      },
      {
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
      }
    ]
  })
}

type ActivityPubCollectionPaginationHandler = (start: number, count: number) => Bluebird<ResultList<any>> | Promise<ResultList<any>>
async function activityPubCollectionPagination (url: string, handler: ActivityPubCollectionPaginationHandler, page?: any) {
  if (!page || !validator.isInt(page)) {
    // We just display the first page URL, we only need the total items
    const result = await handler(0, 1)

    return {
      id: url,
      type: 'OrderedCollection',
      totalItems: result.total,
      first: url + '?page=1'
    }
  }

  const { start, count } = pageToStartAndCount(page, ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE)
  const result = await handler(start, count)

  let next: string | undefined
  let prev: string | undefined

  // Assert page is a number
  page = parseInt(page, 10)

  // There are more results
  if (result.total > page * ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE) {
    next = url + '?page=' + (page + 1)
  }

  if (page > 1) {
    prev = url + '?page=' + (page - 1)
  }

  return {
    id: url + '?page=' + page,
    type: 'OrderedCollectionPage',
    prev,
    next,
    partOf: url,
    orderedItems: result.data,
    totalItems: result.total
  }

}

function buildSignedActivity (byActor: ActorModel, data: Object) {
  const activity = activityPubContextify(data)

  return signObject(byActor, activity) as Promise<Activity>
}

function getActorUrl (activityActor: string | ActivityPubActor) {
  if (typeof activityActor === 'string') return activityActor

  return activityActor.id
}

// ---------------------------------------------------------------------------

export {
  getActorUrl,
  activityPubContextify,
  activityPubCollectionPagination,
  buildSignedActivity
}
