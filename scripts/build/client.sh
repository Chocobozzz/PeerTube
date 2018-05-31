#!/bin/sh

set -eu

cd client

rm -rf ./dist ./compiled

defaultLanguage="en-US"
npm run ng build -- --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json
mv "./dist/$defaultLanguage/assets" "./dist"

languages="fr"

for lang in "$languages"; do
    npm run ng build -- --prod --i18n-file "./src/locale/target/messages_$lang.xml" --i18n-format xlf --i18n-locale "$lang" \
        --output-path "dist/$lang/" --deploy-url "/client/$lang/"

    # Do no duplicate assets
    rm -r "./dist/$lang/assets"
done

NODE_ENV=production npm run webpack -- --config webpack/webpack.video-embed.js --mode production

