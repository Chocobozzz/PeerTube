import { RunnerModel } from '@server/models/runner/runner.js'

// ############################################################################

export type MRunner = Omit<RunnerModel, 'RunnerRegistrationToken'>
