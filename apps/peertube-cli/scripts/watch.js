import * as esbuild from 'esbuild'
import { esbuildOptions } from './build.js'

const context = await esbuild.context(esbuildOptions)

// Enable watch mode
await context.watch()
