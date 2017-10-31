import * as program from 'commander'
import * as Promise from 'bluebird'
import { isAbsolute, join } from 'path'

import { readdirPromise } from '../../../helpers/core-utils'
import { execCLI } from '../../utils'

program
  .option('-u, --url <url>', 'Server url')
  .option('-U, --username <username>', 'Username')
  .option('-p, --password <token>', 'Password')
  .option('-i, --input <directory>', 'Videos directory absolute path')
  .option('-d, --description <description>', 'Video descriptions')
  .option('-c, --category <category>', 'Video categories')
  .option('-l, --licence <licence>', 'Video licences')
  .option('-t, --tags <tags>', 'Video tags', list)
  .parse(process.argv)

if (
  !program['url'] ||
  !program['username'] ||
  !program['password'] ||
  !program['input'] ||
  !program['description'] ||
  !program['category'] ||
  !program['licence'] ||
  !program['tags']
) {
  throw new Error('All arguments are required.')
}

if (isAbsolute(program['input']) === false) {
  throw new Error('Input path should be absolute.')
}

let command = `npm run ts-node -- ${__dirname}/get-access-token.ts`
command += ` -u "${program['url']}"`
command += ` -n "${program['username']}"`
command += ` -p "${program['password']}"`

execCLI(command)
  .then(stdout => {
    const accessToken = stdout.replace('\n', '')

    console.log(accessToken)

    return readdirPromise(program['input']).then(files => ({ accessToken, files }))
  })
  .then(({ accessToken, files }) => {
    return Promise.each(files, file => {
      const video = {
        tags: program['tags'],
        name: file,
        description: program['description'],
        category: program['category'],
        licence: program['licence']
      }

      let command = `npm run ts-node -- ${__dirname}/upload.ts`
      command += ` -u "${program['url']}"`
      command += ` -a "${accessToken}"`
      command += ` -n "${video.name}"`
      command += ` -d "${video.description}"`
      command += ` -c "${video.category}"`
      command += ` -l "${video.licence}"`
      command += ` -t "${video.tags.join(',')}"`
      command += ` -f "${join(program['input'], file)}"`

      return execCLI(command).then(stdout => console.log(stdout))
    })
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err)
    process.exit(-1)
  })

// ----------------------------------------------------------------------------

function list (val) {
  return val.split(',')
}
