import Ajv from 'ajv'
import { readFileSync } from 'fs'
import { load } from 'js-yaml'
import { dirname, join, relative } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = join(__dirname, '..')
const schemaPath = join(rootDir, 'config', 'config-schema.json')

interface Target {
  path: string
  allowNull: boolean
}

const targets: Target[] = [
  { path: join(rootDir, 'config', 'default.yaml'), allowNull: false },
  // production.yaml is an override layered on top of default.yaml; values left
  // for runtime env vars are written as `null` and must be tolerated here.
  { path: join(rootDir, 'support', 'docker', 'production', 'config', 'production.yaml'), allowNull: true }
]

const { $schema: _omit, ...rawSchema } = JSON.parse(readFileSync(schemaPath, 'utf8'))

function withNullableLeaves (node: any): any {
  if (Array.isArray(node)) return node.map(withNullableLeaves)
  if (node === null || typeof node !== 'object') return node

  const out: any = {}
  for (const [ k, v ] of Object.entries(node)) {
    out[k] = withNullableLeaves(v)
  }

  if (typeof out.type === 'string' && out.type !== 'null') {
    out.type = [ out.type, 'null' ]
  } else if (Array.isArray(out.type) && !out.type.includes('null')) {
    out.type = [ ...out.type, 'null' ]
  }

  return out
}

const ajv = new Ajv({ allErrors: true, strict: false })
const validateStrict = ajv.compile(rawSchema)
const validateNullable = ajv.compile(withNullableLeaves(rawSchema))

let hasFailure = false

for (const { path, allowNull } of targets) {
  const data = load(readFileSync(path, 'utf8'))
  const validate = allowNull ? validateNullable : validateStrict
  const ok = validate(data)
  const rel = relative(rootDir, path)

  if (ok) {
    console.log(`OK   ${rel}`)
  } else {
    hasFailure = true
    console.error(`FAIL ${rel}`)
    for (const err of validate.errors ?? []) {
      console.error(`  ${err.instancePath || '/'} ${err.message}` +
        (err.params ? ` ${JSON.stringify(err.params)}` : ''))
    }
  }
}

process.exit(hasFailure ? 1 : 0)
