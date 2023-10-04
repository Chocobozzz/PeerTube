import { TagModel } from '../../../models/video/tag.js'

export type MTag = Omit<TagModel, 'Videos'>
