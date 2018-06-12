#!/bin/sh

set -eu

cd client

rm -rf ./dist ./compiled

defaultLanguage="en_US"
npm run ng build -- --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json
mv "./dist/$defaultLanguage/assets" "./dist"

# Supported languages
languages="fr_FR"

for lang in "$languages"; do
    npm run ng build -- --prod --i18n-file "./src/locale/target/angular_$lang.xml" --i18n-format xlf --i18n-locale "$lang" \
        --output-path "dist/$lang/" --deploy-url "/client/$lang/"

    # Do no duplicate assets
    rm -r "./dist/$lang/assets"
done

NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production --json > "./dist/embed-stats.json"

# Copy runtime locales
cp -r "./src/locale/target" "./dist/locale"