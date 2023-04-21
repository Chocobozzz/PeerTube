import { RunnerModel } from '@server/models/runner/runner'

// ############################################################################

export type MRunner = Omit<RunnerModel, 'RunnerRegistrationToken'>
