#!/bin/bash

docker run --rm -v ${PWD}:/local openapitools/openapi-generator-cli generate \
    -i support/doc/api/openapi.yaml
    -g python \
    -l python \
    -o /local/out/python
