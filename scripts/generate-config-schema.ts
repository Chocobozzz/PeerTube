import { readFileSync, writeFileSync } from 'fs'
import { load } from 'js-yaml'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootDir = join(__dirname, '..')
const yamlPath = join(rootDir, 'config', 'default.yaml')
const outputPath = join(rootDir, 'config', 'config-schema.json')

type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'

interface JsonSchema {
  $schema?: string
  title?: string
  description?: string
  type?: JsonSchemaType | JsonSchemaType[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  default?: unknown
  additionalProperties?: boolean | JsonSchema
  examples?: unknown[]
  enum?: unknown[]
}

// ---------------------------------------------------------------------------
// Step 1: extract comments from the raw YAML text
// ---------------------------------------------------------------------------

/**
 * Find a `#`-comment in the "rest" portion of a key: value line, ignoring
 * `#` characters that appear inside single- or double-quoted strings.
 */
function extractInlineComment (rest: string): string | null {
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i]

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === '#' && !inSingle && !inDouble) {
      const comment = rest.slice(i + 1).trim()
      return comment.length > 0 ? comment : null
    }
  }

  return null
}

/**
 * Walk the YAML source line-by-line to associate block and inline comments
 * with each key, returning a map from dotted-path → description string.
 *
 * Limitations (acceptable for schema-generation purposes):
 *  - List items are identified only by their parent key path (not by index).
 *  - Only indentation-based nesting is tracked; flow-style YAML is ignored.
 */
function extractComments (yamlText: string): Map<string, string> {
  const lines = yamlText.split('\n')
  const commentMap = new Map<string, string>()

  let pendingComments: string[] = []
  // Stack entries: { indent, key } – used to reconstruct the dotted path.
  const pathStack: Array<{ indent: number; key: string }> = []

  for (const line of lines) {
    // 1. Pure comment line
    if (/^\s*#/.test(line)) {
      const comment = line.replace(/^\s*#\s?/, '').trim()
      if (comment) pendingComments.push(comment)
      continue
    }

    // 2. Empty line – discard accumulated comments (they belonged to the
    //    previous block and are separated from the next key by blank space).
    if (/^\s*$/.test(line)) {
      pendingComments = []
      continue
    }

    // 3. Key-value (or key-only) line: capture indent + key name
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_]+)\s*:(.*)$/)
    if (keyMatch) {
      const indent = keyMatch[1].length
      const key = keyMatch[2]
      const rest = keyMatch[3]

      // Maintain the path stack: pop any entries at >= this indent level.
      while (pathStack.length > 0 && pathStack[pathStack.length - 1].indent >= indent) {
        pathStack.pop()
      }
      pathStack.push({ indent, key })

      const fullPath = pathStack.map(p => p.key).join('.')

      // Inline comment on the same line takes priority / is appended.
      const inlineComment = extractInlineComment(rest)
      if (inlineComment) {
        pendingComments.push(inlineComment)
      }

      if (pendingComments.length > 0) {
        commentMap.set(fullPath, pendingComments.join(' '))
        pendingComments = []
      }

      continue
    }

    // 4. List-item lines (`- value`) and anything else: discard pending comments.
    pendingComments = []
  }

  return commentMap
}

// ---------------------------------------------------------------------------
// Step 2: convert the parsed YAML value tree into a JSON Schema
// ---------------------------------------------------------------------------

function inferType (value: unknown): JsonSchemaType | JsonSchemaType[] {
  if (value === null) return [ 'null', 'string' ]
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number'
  if (typeof value === 'string') return 'string'
  if (Array.isArray(value)) return 'array'
  return 'object'
}

function generateSchema (
  value: unknown,
  commentMap: Map<string, string>,
  path: string
): JsonSchema {
  const description = commentMap.get(path)
  const base: JsonSchema = {}
  if (description) base.description = description

  if (value === null) {
    return { ...base, type: [ 'null', 'string' ], default: null }
  }

  if (typeof value === 'boolean') {
    return { ...base, type: 'boolean', default: value }
  }

  if (typeof value === 'number') {
    return { ...base, type: Number.isInteger(value) ? 'integer' : 'number', default: value }
  }

  if (typeof value === 'string') {
    return { ...base, type: 'string', default: value }
  }

  if (Array.isArray(value)) {
    const schema: JsonSchema = { ...base, type: 'array', default: value }
    if (value.length > 0) {
      schema.items = generateSchema(value[0], commentMap, path + '[]')
    } else {
      schema.items = {}
    }
    return schema
  }

  // Plain object
  if (typeof value === 'object' && value !== null) {
    const properties: Record<string, JsonSchema> = {}
    for (const [ key, val ] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key
      properties[key] = generateSchema(val, commentMap, childPath)
    }
    return { ...base, type: 'object', properties, additionalProperties: false }
  }

  return { ...base, type: inferType(value) }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const yamlContent = readFileSync(yamlPath, 'utf8')
const parsed = load(yamlContent) as Record<string, unknown>
const commentMap = extractComments(yamlContent)

const schema: JsonSchema = {
  $schema: 'https://json-schema.org/draft-07/schema',
  title: 'PeerTube Configuration',
  description:
    'Full configuration schema for a PeerTube server instance. ' +
    'Corresponds to the YAML configuration files (default.yaml / production.yaml). ',
  type: 'object',
  properties: {},
  additionalProperties: false
}

for (const [ key, val ] of Object.entries(parsed)) {
  ;(schema.properties as Record<string, JsonSchema>)[key] = generateSchema(val, commentMap, key)
}

writeFileSync(outputPath, JSON.stringify(schema, null, 2) + '\n')
console.log(`JSON schema written to ${outputPath}`)
