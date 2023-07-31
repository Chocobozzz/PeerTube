import { HttpStatusCode, Storyboard } from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class StoryboardCommand extends AbstractCommand {

  list (options: OverrideCommandOptions & {
    id: number | string
  }) {
    const path = '/api/v1/videos/' + options.id + '/storyboards'

    return this.getRequestBody<{ storyboards: Storyboard[] }>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
