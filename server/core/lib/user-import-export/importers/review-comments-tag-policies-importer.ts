import { AutoTagPoliciesJSON, AutomaticTagPolicy } from '@peertube/peertube-models'
import { isWatchedWordListNameValid } from '@server/helpers/custom-validators/watched-words.js'
import { setAccountAutomaticTagsPolicy } from '@server/lib/automatic-tags/automatic-tags.js'
import { AbstractUserImporter } from './abstract-user-importer.js'

type SanitizedObject = AutoTagPoliciesJSON['reviewComments']

// eslint-disable-next-line max-len
export class ReviewCommentsTagPoliciesImporter
  extends AbstractUserImporter <AutoTagPoliciesJSON, AutoTagPoliciesJSON['reviewComments'] & { archiveFiles?: never }, SanitizedObject> {

  protected getImportObjects (json: AutoTagPoliciesJSON) {
    if (!json.reviewComments) return []

    return [ json.reviewComments ]
  }

  protected sanitize (data: AutoTagPoliciesJSON['reviewComments']) {
    return data.filter(d => isWatchedWordListNameValid(d.name))
  }

  protected async importObject (data: SanitizedObject) {
    await setAccountAutomaticTagsPolicy({
      account: this.user.Account,
      policy: AutomaticTagPolicy.REVIEW_COMMENT,
      tags: data.map(v => v.name)
    })

    return { duplicate: false }
  }
}
