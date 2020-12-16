#!/bin/bash

set -eu

declare -A languages
defaultLanguage="en-US"

# Supported languages
languages=(
    ["ar"]="ar"
    ["en"]="en-US"
    ["vi"]="vi-VN"
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
    ["gl"]="gl-ES"
    ["cs"]="cs-CZ"
    ["eo"]="eo"
    ["de"]="de-DE"
    ["it"]="it-IT"
    ["kab"]="kab"
)

cd client

rm -rf ./dist ./compiled

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    npm run ng build -- --prod --output-path "dist/build"

    for key in "${!languages[@]}"; do
        lang=${languages[$key]}

        mv "dist/build/$key" "dist/$lang"

        if [ "$lang" != "en-US" ]; then
            # Do not duplicate assets
            rm -r "./dist/$lang/assets"
        fi
    done

    mv "./dist/$defaultLanguage/assets" "./dist"
    mv "./dist/$defaultLanguage/manifest.webmanifest" "./dist/manifest.webmanifest"

    rmdir "dist/build"
else
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
        additionalParams="--namedChunks=true --outputHashing=none"
        export ANALYZE_BUNDLE=true
    fi

    npm run ng build -- --localize=false --output-path "dist/$defaultLanguage/" --deploy-url "/client/$defaultLanguage/" --prod --stats-json $additionalParams
fi

cd ../ && npm run build:embed && cd client/

# Copy runtime locales
cp -r "./src/locale" "./dist/locale"
