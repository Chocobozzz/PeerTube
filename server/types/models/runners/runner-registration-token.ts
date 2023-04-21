import { RunnerRegistrationTokenModel } from '@server/models/runner/runner-registration-token'

// ############################################################################

export type MRunnerRegistrationToken = Omit<RunnerRegistrationTokenModel, 'Runners'>
