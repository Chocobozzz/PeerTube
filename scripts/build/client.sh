#!/bin/bash

set -eu

declare -A languages

pre_build_hook () {
  mkdir "./src/pending_locale" > /dev/null || true
  mv ./src/locale/angular.*.xlf "./src/pending_locale"

  if [ ! -z ${1+x} ]; then
    mv "./src/pending_locale/angular.$1.xlf" "./src/locale"
  fi
}

post_build_hook () {
  mv ./src/pending_locale/* "./src/locale"
  rmdir "./src/pending_locale/"
}

# Previous build failed
if [ ! -f "client/src/locale/angular.fr-FR.xlf" ]; then
    git checkout -- client/src/locale/
    rm -r client/src/pending_locale
fi

cd client

rm -rf ./dist ./compiled

pre_build_hook

defaultLanguage="en-US"
npm run ng build -- --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json
mv "./dist/$defaultLanguage/assets" "./dist"
mv "./dist/$defaultLanguage/manifest.webmanifest" "./dist/manifest.webmanifest"

post_build_hook

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || [ "$1" != "--light" ]; then
    if [ ! -z ${1+x} ] && [ "$1" == "--light-fr" ]; then
        languages=(["fr"]="fr-FR")
    else
        # Supported languages
        languages=(
            ["hu"]="hu-HU"
            ["th"]="th-TH"
            ["fi"]="fi-FI"
            ["nl"]="nl-NL"
            ["gd"]="gd"
            ["el"]="el-GR"
            ["es"]="es-ES"
            ["oc"]="oc"
            ["pt"]="pt-BR"
            ["pt-PT"]="pt-PT"
            ["sv"]="sv-SE"
            ["pl"]="pl-PL"
            ["ru"]="ru-RU"
            ["zh-Hans"]="zh-Hans-CN"
            ["zh-Hant"]="zh-Hant-TW"
            ["fr"]="fr-FR"
            ["ja"]="ja-JP"
            ["eu"]="eu-ES"
            ["ca"]="ca-ES"
            ["cs"]="cs-CZ"
            ["eo"]="eo"
            ["de"]="de-DE"
            ["it"]="it-IT"
        )
    fi

    for key in "${!languages[@]}"; do
        lang=${languages[$key]}

        # TODO: remove when the project will use runtime translations
        pre_build_hook "$lang"

        npm run ng build -- --prod --configuration="$lang"

        if [ ! "$lang" = "$key" ]; then
          mv "dist/$key" "dist/$lang"
        fi

        # Do not duplicate assets
        rm -r "./dist/$lang/assets"

        # TODO: remove when the project will use runtime translations
        post_build_hook
    done
fi

cd ../ && npm run build:embed && cd client/

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
