# REST API quick start

## Authentication

### Get client

Some endpoints need authentication. We use OAuth 2.0 so first fetch the client tokens:

```bash
$ curl https://peertube.example.com/api/v1/oauth-clients/local
```

Response example:

```json
{
  "client_id": "v1ikx5hnfop4mdpnci8nsqh93c45rldf",
  "client_secret": "AjWiOapPltI6EnsWQwlFarRtLh4u8tDt"
}
```

### Get user token

Now you can fetch the user token:

```bash
$ curl -X POST \
 -d "client_id=v1ikx5hnfop4mdpnci8nsqh93c45rldf&client_secret=AjWiOapPltI6EnsWQwlFarRtLh4u8tDt&grant_type=password&response_type=code&username=your_user&password=your_password" \
  https://peertube.example.com/api/v1/users/token
```

Response example:

```json
{
  "access_token": "90286a0bdf0f7315d9d3fe8dabf9e1d2be9c97d0",
  "token_type": "Bearer",
  "expires_in": 14399,
  "refresh_token": "2e0d675df9fc96d2e4ec8a3ebbbf45eca9137bb7"
}
```

Just use the `access_token` in the `Authorization` header:

```bash
$ curl -H 'Authorization: Bearer 90286a0bdf0f7315d9d3fe8dabf9e1d2be9c97d0' https://peertube.example.com/api/v1/jobs/completed
```


## List videos

```bash
$ curl https://peertube.example.com/api/v1/videos
```

## Libraries

[Convenience libraries](https://framagit.org/framasoft/peertube/clients) are generated automatically from the [OpenAPI specification](https://github.com/Chocobozzz/PeerTube/blob/develop/support/doc/api/openapi.yaml) for the following languages:

- [python](https://framagit.org/framasoft/peertube/clients/python)
- [go](https://framagit.org/framasoft/peertube/clients/go)
- [kotlin](https://framagit.org/framasoft/peertube/clients/kotlin)

Other [languages supported by the OpenAPI generator](https://openapi-generator.tech/docs/generators/#client-generators) can be added to the generation, provided they make a common enough use case.
