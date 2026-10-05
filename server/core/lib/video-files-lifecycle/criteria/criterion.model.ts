import { VideoLifecycleCriterion } from '@peertube/peertube-models'

export interface LifecycleCriterionHandler<C extends VideoLifecycleCriterion> {
  // Throw a human readable error if the criterion of the admin configuration is invalid
  validate(criterion: C): void

  // Warn the admin if the database does not contain the data the criterion needs
  // Unlike `validate` it depends on the database state, so it's run before every scheduler run
  checkDatabaseState?(criterion: C): Promise<void>

  // Contribute to the SQL query that selects the videos to process
  // `index` makes the replacement keys unique when a policy has multiple criteria of the same type
  buildWhereToProcess(criterion: C, index: number): { sql: string, replacements: Record<string, any> }
}
