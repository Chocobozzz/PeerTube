import { TagModel } from '../../../models/video/tag'

export type MTag = Omit<TagModel, 'Videos'>
