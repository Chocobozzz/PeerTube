import { copyFile, readJson, writeFile, writeJSON } from 'fs-extra'
import { resolve } from 'path'
import { cwd } from 'process'
import { execSync } from 'child_process'
import depcheck, { PackageDependencies } from 'depcheck'

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

async function run () {
  execSync('npm run build:types', { stdio: 'inherit' })
  const typesPath = resolve(cwd(), './types/')
  const typesDistPath = resolve(cwd(), typesPath, './dist/')
  const typesDistPackageJsonPath = resolve(typesDistPath, './package.json')
  const typesDistGitIgnorePath = resolve(typesDistPath, './.gitignore')
  const mainPackageJson = await readJson(resolve(cwd(), './package.json'))
  const distTsConfigPath = resolve(cwd(), typesPath, './tsconfig.dist.json')
  const distTsConfig = await readJson(distTsConfigPath)
  const clientPackageJson = await readJson(resolve(cwd(), './client/package.json'))

  const allDependencies = Object.assign(
    mainPackageJson.dependencies,
    mainPackageJson.devDepencies,
    clientPackageJson.dependencies
  ) as PackageDependencies

  // https://github.com/depcheck/depcheck#api
  const depcheckOptions = {
    parsers: { '**/*.ts': depcheck.parser.typescript },
    detectors: [
      depcheck.detector.requireCallExpression,
      depcheck.detector.importDeclaration
    ],
    ignoreMatches: Object.keys(distTsConfig?.compilerOptions?.paths || []),
    package: { dependencies: allDependencies }
  }

  const { dependencies: unusedDependencies } = await depcheck(resolve(cwd(), './types/'), depcheckOptions)
  console.log(`Removing ${Object.keys(unusedDependencies).length} unused dependencies.`)
  const dependencies = Object
    .keys(allDependencies)
    .filter(dependencyName => !unusedDependencies.includes(dependencyName))
    .reduce((dependencies, dependencyName) => {
      dependencies[dependencyName] = allDependencies[dependencyName]
      return dependencies
    }, {})

  const { description, version, licence, engines, author, repository } = mainPackageJson
  const typesPackageJson = {
    name: '@peertube/peertube-types',
    description,
    version,
    private: false,
    license: licence,
    engines,
    author,
    repository,
    dependencies
  }
  console.log(`Writing package.json to ${typesDistPackageJsonPath}`)
  await writeJSON(typesDistPackageJsonPath, typesPackageJson, { spaces: 2 })

  console.log(`Writing git ignore to ${typesDistGitIgnorePath}`)
  await writeFile(typesDistGitIgnorePath, '*.tsbuildinfo')

  console.log('Copying tsconfig files')
  await copyFile(distTsConfigPath, resolve(typesDistPath, './tsconfig.json'))
  await copyFile(resolve(cwd(), './tsconfig.base.json'), resolve(typesDistPath, './tsconfig.base.json'))

  await copyFile(resolve(typesPath, './README.md'), resolve(typesDistPath, './README.md'))
}
