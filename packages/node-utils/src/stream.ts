import { pipeline } from 'stream'
import { promisify } from 'util'

export const pipelinePromise = promisify(pipeline)
