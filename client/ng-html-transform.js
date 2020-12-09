const fs = require('fs')
const path = require('path')
const ngConfig = require('./angular.json')

module.exports = (targetOptions, indexHtml) => {
    try {
        const getOutputPath = () => {
            const opIndex = process.argv.indexOf('--output-path');

            return opIndex > -1 ? process.argv[opIndex + 1] : ngConfig.projects.PeerTube.architect.build.options.outputPath
        }
        const assetsPath = [
            path.join(__dirname, getOutputPath(), 'assets'),
            path.join(__dirname, getOutputPath(), 'en', 'assets'),
            path.join(__dirname, getOutputPath(), 'en-US', 'assets')
        ]
        .find(p => fs.existsSync(p))

        if (!assetsPath) {
            throw Error(`Unable to find assets path.`)
        }

        const manifests = fs.readdirSync(assetsPath)
            .filter(fileName => fileName.includes('manifest') && fileName.includes('.json'))

        if (manifests.length !== 1) {
            throw Error(`Unexpected number of manifest files found: ${manifests.length}`)
        }

        const index = indexHtml.indexOf('</head>');

        return `${indexHtml.slice(0, index)}
                <link rel="manifest" href="/client/assets/${manifests[0]}?[manifestContentHash]">
                  ${indexHtml.slice(index)}`;
    } catch (error) {
        console.error(error)
        process.exit(1)
    }
};