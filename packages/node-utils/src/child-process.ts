import { promisify1, promisify2 } from '@peertube/peertube-core-utils'
import { exec } from 'child_process'

// Resolve to stdout only, unlike the `util.promisify` of `exec` which resolves to `{ stdout, stderr }`
export const execPromise = promisify1<string, string>(exec)
export const execPromise2 = promisify2<string, any, string>(exec)
