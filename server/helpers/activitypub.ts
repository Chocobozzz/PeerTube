import { ResultList } from '../../shared/models'
import { Activity } from '../../shared/models/activitypub'
import { ACTIVITY_PUB } from '../initializers'
import { ActorModel } from '../models/activitypub/actor'
import { signObject } from './peertube-crypto'

function activityPubContextify <T> (data: T) {
  return Object.assign(data,{
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        'RsaSignature2017': 'https://w3id.org/security#RsaSignature2017',
        'Hashtag': 'as:Hashtag',
        'uuid': 'http://schema.org/identifier',
        'category': 'http://schema.org/category',
        'licence': 'http://schema.org/license',
        'nsfw': 'as:sensitive',
        'language': 'http://schema.org/inLanguage',
        'views': 'http://schema.org/Number',
        'size': 'http://schema.org/Number',
        'commentsEnabled': 'http://schema.org/Boolean'
      }
    ]
  })
}

function activityPubCollection (results: any[]) {
  return {
    type: 'OrderedCollection',
    totalItems: results.length,
    orderedItems: results
  }
}

function activityPubCollectionPagination (url: string, page: any, result: ResultList<any>) {
  let next: string
  let prev: string

  // Assert page is a number
  page = parseInt(page, 10)

  // There are more results
  if (result.total > page * ACTIVITY_PUB.COLLECTION_ITEMS_PER_PAGE) {
    next = url + '?page=' + (page + 1)
  }

  if (page > 1) {
    prev = url + '?page=' + (page - 1)
  }

  const orderedCollectionPagination = {
    id: url + '?page=' + page,
    type: 'OrderedCollectionPage',
    prev,
    next,
    partOf: url,
    orderedItems: result.data
  }

  if (page === 1) {
    return activityPubContextify({
      id: url,
      type: 'OrderedCollection',
      totalItems: result.total,
      first: orderedCollectionPagination
    })
  } else {
    orderedCollectionPagination['totalItems'] = result.total
  }

  return orderedCollectionPagination
}

function buildSignedActivity (byActor: ActorModel, data: Object) {
  const activity = activityPubContextify(data)

  return signObject(byActor, activity) as Promise<Activity>
}

// ---------------------------------------------------------------------------

export {
  activityPubContextify,
  activityPubCollectionPagination,
  activityPubCollection,
  buildSignedActivity
}
