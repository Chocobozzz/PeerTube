import { RunnerRegistrationTokenModel } from '@server/models/runner/runner-registration-token.js'

// ############################################################################

export type MRunnerRegistrationToken = Omit<RunnerRegistrationTokenModel, 'Runners'>
