import { StoryboardModel } from '@server/models/video/storyboard'
import { PickWith } from '@shared/typescript-utils'
import { MVideo } from './video'

type Use<K extends keyof StoryboardModel, M> = PickWith<StoryboardModel, K, M>

// ############################################################################

export type MStoryboard = Omit<StoryboardModel, 'Video'>

// ############################################################################

export type MStoryboardVideo =
  MStoryboard &
  Use<'Video', MVideo>
