import { pick } from '@peertube/peertube-core-utils'
import {
  AutomaticTagAvailable,
  CommentAutomaticTagPolicies,
  CommentAutomaticTagPoliciesUpdate,
  HttpStatusCode
} from '@peertube/peertube-models'
import { AbstractCommand, OverrideCommandOptions } from '../shared/index.js'

export class AutomaticTagsCommand extends AbstractCommand {

  getCommentPolicies (options: OverrideCommandOptions & {
    accountName: string
  }) {
    const path = '/api/v1/automatic-tags/policies/accounts/' + options.accountName + '/comments'

    return this.getRequestBody<CommentAutomaticTagPolicies>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  updateCommentPolicies (options: OverrideCommandOptions & CommentAutomaticTagPoliciesUpdate & {
    accountName: string
  }) {
    const path = '/api/v1/automatic-tags/policies/accounts/' + options.accountName + '/comments'

    return this.putBodyRequest({
      ...options,

      path,
      fields: pick(options, [ 'review' ]),
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.NO_CONTENT_204
    })
  }

  // ---------------------------------------------------------------------------

  getAccountAvailable (options: OverrideCommandOptions & {
    accountName: string
  }) {
    const path = '/api/v1/automatic-tags/accounts/' + options.accountName + '/available'

    return this.getRequestBody<AutomaticTagAvailable>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }

  getServerAvailable (options: OverrideCommandOptions = {}) {
    const path = '/api/v1/automatic-tags/server/available'

    return this.getRequestBody<AutomaticTagAvailable>({
      ...options,

      path,
      implicitToken: true,
      defaultExpectedStatus: HttpStatusCode.OK_200
    })
  }
}
