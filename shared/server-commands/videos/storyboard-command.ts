import { HttpStatusCode, Storyboard } from '@shared/models'
import { AbstractCommand, OverrideCommandOptions } from '../shared'

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
