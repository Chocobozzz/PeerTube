import { glob, readFile } from 'fs/promises'
import { defineConfig, ExtractedKey } from 'i18next-cli'
import { I18N_LOCALES } from '../packages/core-utils/dist/i18n/i18n.js'

// https://github.com/i18next/i18next-cli/blob/main/test/plugin.handlebars.test.ts
const handlebarsPlugin = () => ({
  name: 'handlebars-plugin',
  async onEnd (keys: Map<string, ExtractedKey>) {
    const hbsFiles = glob('server/**/*.hbs')

    // Regex to find {{t 'key'}} patterns in Handlebars templates
    const keyRegex1 = /\{\{t\s+['"](.+)['"]\s?.*\}\}/g
    const keyRegex2 = /\(t\s+['"](.+)['"]\s?.*\)/g

    for await (const file of hbsFiles) {
      const content = await readFile(file, 'utf-8')
      let match
      while ((match = keyRegex1.exec(content)) !== null || (match = keyRegex2.exec(content)) !== null) {
        let key = match[1]

        if (key) {
          key = key.replaceAll('\\', '')

          const uniqueKey = `translation:${key}`
          if (!keys.has(uniqueKey)) {
            keys.set(uniqueKey, {
              key,
              defaultValue: 'key',
              ns: 'translation'
            })
          }
        }
      }
    }
  }
})

export default defineConfig({
  plugins: [ handlebarsPlugin() ],
  locales: Object.keys(I18N_LOCALES),

  extract: {
    'input': 'server/**/*.{js,jsx,ts,tsx}',
    'output': 'server/locales/{{language}}/{{namespace}}.json',
    'defaultNS': 'translation',
    'keySeparator': false,
    'nsSeparator': false,
    'fallbackNS': 'fallback',
    'defaultValue': key => key,
    'pluralSeparator': null,
    'generateBasePluralForms': false,
    'contextSeparator': '_',
    'functions': [
      't',
      '*.t',
      'tu'
    ],
    'transComponents': [
      'Trans'
    ]
  }
})
