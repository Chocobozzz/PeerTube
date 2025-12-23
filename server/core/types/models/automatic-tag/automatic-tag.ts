import { AutomaticTagModel } from '@server/models/automatic-tag/automatic-tag.js'

export type MAutomaticTag = Omit<AutomaticTagModel, 'Videos' | 'VideoComments'>
