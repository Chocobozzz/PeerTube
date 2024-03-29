import { AutoTagPoliciesJSON } from '@peertube/peertube-models'
import { AutomaticTagger } from '@server/lib/automatic-tags/automatic-tagger.js'
import { AbstractUserExporter } from './abstract-user-exporter.js'

export class AutoTagPoliciesExporter extends AbstractUserExporter <AutoTagPoliciesJSON> {

  async export () {
    const data = await AutomaticTagger.getAutomaticTagPolicies(this.user.Account)

    return {
      json: {
        reviewComments: data.review.map(name => ({ name }))
      } as AutoTagPoliciesJSON,

      staticFiles: []
    }
  }
}
