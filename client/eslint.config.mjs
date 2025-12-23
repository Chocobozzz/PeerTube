import { defineConfig, globalIgnores } from 'eslint/config'
import love from 'eslint-config-love'
import stylistic from '@stylistic/eslint-plugin'
import angular from 'angular-eslint'

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist',
    '**/build',
    '.angular'
  ]),

  {
    extends: [
      love,
      angular.configs.tsRecommended
    ],

    processor: angular.processInlineTemplates,

    plugins: {
      '@stylistic': stylistic
    },

    files: [
      'src/**/*.ts',
      'e2e/**/*.ts'
    ],

    rules: {
      '@angular-eslint/component-selector': [
        'error',
        {
          'type': [ 'element', 'attribute' ],
          'prefix': 'my',
          'style': 'kebab-case'
        }
      ],
      '@angular-eslint/directive-selector': [
        'error',
        {
          'type': [ 'element', 'attribute' ],
          'prefix': 'my',
          'style': 'camelCase'
        }
      ],
      '@angular-eslint/use-component-view-encapsulation': 'error',

      '@typescript-eslint/prefer-readonly': 'off',
      "n/no-callback-literal": "off",

      '@stylistic/semi': [ 'error', 'never' ],

      'eol-last': [ 'error', 'always' ],
      'indent': 'off',
      'no-lone-blocks': 'off',
      'no-mixed-operators': 'off',

      'max-len': [ 'error', {
        code: 140
      } ],

      'array-bracket-spacing': [ 'error', 'always' ],
      'quote-props': [ 'error', 'consistent-as-needed' ],
      'padded-blocks': 'off',
      'no-async-promise-executor': 'off',
      'dot-notation': 'off',
      'promise/param-names': 'off',
      'import/first': 'off',

      'operator-linebreak': [ 'error', 'after', {
        overrides: {
          '?': 'before',
          ':': 'before'
        }
      } ],

      '@typescript-eslint/consistent-type-assertions': [ 'error', {
        assertionStyle: 'as'
      } ],

      '@typescript-eslint/array-type': [ 'error', {
        default: 'array'
      } ],

      '@typescript-eslint/restrict-template-expressions': [ 'off', {
        allowNumber: 'true'
      } ],

      '@typescript-eslint/no-this-alias': [ 'error', {
        allowDestructuring: true,
        allowedNames: [ 'self' ]
      } ],

      '@typescript-eslint/return-await': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/quotes': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/promise-function-async': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'no-implicit-globals': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'logical-assignment-operators': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/prefer-destructuring': 'off',
      'promise/avoid-new': 'off',
      '@typescript-eslint/class-methods-use-this': 'off',
      'arrow-body-style': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/init-declarations': 'off',
      'no-console': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/method-signature-style': 'off',
      'eslint-comments/require-description': 'off',
      'max-lines': 'off',
      '@typescript-eslint/no-misused-spread': 'off',
      'consistent-this': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'prefer-regex-literals': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/no-unnecessary-template-expression': 'off',
      '@typescript-eslint/no-loop-func': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-import-type-side-effects': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-useless-return': 'off',
      'no-return-assign': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'import/no-named-default': 'off',
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',

      "@typescript-eslint/no-deprecated": [ 'error', {
        allow: [
          { from: 'package', package: 'video.js', name: 'options'}
        ]
      }],

      // Can be interesting to enable
      '@typescript-eslint/no-unsafe-return': 'off',
      // Can be interesting to enable
      'complexity': 'off',
      // Interesting but has a bug with specific cases
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      // TODO: enable
      '@typescript-eslint/prefer-as-const': 'off',
      // TODO: enable
      '@typescript-eslint/max-params': 'off',
      // TODO: enable
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // TODO: enable
      '@typescript-eslint/no-deprecated': 'off',
      // TODO: enable
      '@typescript-eslint/no-floating-promises': 'off',
      // TODO: enable but it fails in our CI
      '@typescript-eslint/no-redundant-type-constituents': 'off',

      // We use many nested callbacks in our tests
      'max-nested-callbacks': 'off',

      'no-param-reassign': 'off',
      'no-negated-condition': 'off',
      'radix': 'off',
      'no-plusplus': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
      'no-promise-executor-return': 'off'
    },

    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [ 'src/standalone/build-tools/vite-utils.ts' ]
        }
      }
    }
  },

  {
    files: [ '**/*.html' ],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      // TODO: enable
      '@angular-eslint/template/button-has-type': 'off'
    }
  }
])
