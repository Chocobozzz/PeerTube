import { AbuseMessageModel } from '@server/models/abuse/abuse-message'
import { PickWith } from '@shared/core-utils'
import { AbuseModel } from '../../../models/abuse/abuse'
import { MAccountFormattable } from '../account'

type Use<K extends keyof AbuseMessageModel, M> = PickWith<AbuseMessageModel, K, M>

// ############################################################################

export type MAbuseMessage = Omit<AbuseMessageModel, 'Account' | 'Abuse' | 'toFormattedJSON'>

export type MAbuseMessageId = Pick<AbuseModel, 'id'>

// ############################################################################

// Format for API

export type MAbuseMessageFormattable =
  MAbuseMessage &
  Use<'Account', MAccountFormattable>
