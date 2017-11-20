import { Activity } from '../../shared/models/activitypub/activity'
import { ResultList } from '../../shared/models/result-list.model'
import { AccountInstance } from '../models/account/account-interface'
import { signObject } from './peertube-crypto'

function activityPubContextify <T> (data: T) {
  return Object.assign(data,{
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
      {
        'Hashtag': 'as:Hashtag',
        'uuid': 'http://schema.org/identifier',
        'category': 'http://schema.org/category',
        'licence': 'http://schema.org/license',
        'nsfw': 'as:sensitive',
        'language': 'http://schema.org/inLanguage',
        'views': 'http://schema.org/Number',
        'size': 'http://schema.org/Number',
        'VideoChannel': 'https://peertu.be/ns/VideoChannel'
      }
    ]
  })
}

function activityPubCollectionPagination (url: string, page: number, result: ResultList<any>) {
  const baseUrl = url.split('?').shift

  const obj = {
    id: baseUrl,
    type: 'Collection',
    totalItems: result.total,
    first: {
      id: baseUrl + '?page=' + page,
      type: 'CollectionPage',
      totalItems: result.total,
      next: baseUrl + '?page=' + (page + 1),
      partOf: baseUrl,
      items: result.data
    }
  }

  return activityPubContextify(obj)
}

function buildSignedActivity (byAccount: AccountInstance, data: Object) {
  const activity = activityPubContextify(data)

  return signObject(byAccount, activity) as Promise<Activity>
}

// ---------------------------------------------------------------------------

export {
  activityPubContextify,
  activityPubCollectionPagination,
  buildSignedActivity
}
