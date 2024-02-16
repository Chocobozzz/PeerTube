import express from 'express'
import OAuth2Server, {
  InvalidClientError,
  InvalidGrantError,
  InvalidRequestError,
  Request,
  Response,
  UnauthorizedClientError,
  UnsupportedGrantTypeError
} from '@node-oauth/oauth2-server'
import { randomBytesPromise } from '@server/helpers/core-utils.js'
import { isOTPValid } from '@server/helpers/otp.js'
import { CONFIG } from '@server/initializers/config.js'
import { UserRegistrationModel } from '@server/models/user/user-registration.js'
import { MOAuthClient } from '@server/types/models/index.js'
import { sha1 } from '@peertube/peertube-node-utils'
import { HttpStatusCode, ServerErrorCode, UserRegistrationState } from '@peertube/peertube-models'
import { OTP } from '../../initializers/constants.js'
import { BypassLogin, getAccessToken, getClient, getRefreshToken, getUser, revokeToken, saveToken } from './oauth-model.js'
import axios from 'axios'
import {createHash} from 'crypto';

class MissingTwoFactorError extends Error {
  code = HttpStatusCode.UNAUTHORIZED_401
  name = ServerErrorCode.MISSING_TWO_FACTOR
}

class InvalidTwoFactorError extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.INVALID_TWO_FACTOR
}

class RegistrationWaitingForApproval extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_WAITING_FOR_APPROVAL
}

class RegistrationApprovalRejected extends Error {
  code = HttpStatusCode.BAD_REQUEST_400
  name = ServerErrorCode.ACCOUNT_APPROVAL_REJECTED
}

/**
 *
 * Reimplement some functions of OAuth2Server to inject external auth methods
 *
 */
const oAuthServer = new OAuth2Server({
  // Wants seconds
  accessTokenLifetime: CONFIG.OAUTH2.TOKEN_LIFETIME.ACCESS_TOKEN / 1000,
  refreshTokenLifetime: CONFIG.OAUTH2.TOKEN_LIFETIME.REFRESH_TOKEN / 1000,

  // See https://github.com/oauthjs/node-oauth2-server/wiki/Model-specification for the model specifications
  model: {
    getAccessToken,
    getClient,
    getRefreshToken,
    getUser,
    revokeToken,
    saveToken
  } as any // FIXME: typings
})

// ---------------------------------------------------------------------------

async function handleOAuthToken (req: express.Request, options: { refreshTokenAuthName?: string, bypassLogin?: BypassLogin }) {
  const request = new Request(req)
  const { refreshTokenAuthName, bypassLogin } = options

  if (request.method !== 'POST') {
    throw new InvalidRequestError('Invalid request: method must be POST')
  }

  if (!request.is([ 'application/x-www-form-urlencoded' ])) {
    throw new InvalidRequestError('Invalid request: content must be application/x-www-form-urlencoded')
  }

  const clientId = request.body.client_id
  const clientSecret = request.body.client_secret

  if (!clientId || !clientSecret) {
    throw new InvalidClientError('Invalid client: cannot retrieve client credentials')
  }

  const client = await getClient(clientId, clientSecret)
  if (!client) {
    throw new InvalidClientError('Invalid client: client is invalid')
  }

  const grantType = request.body.grant_type
  if (!grantType) {
    throw new InvalidRequestError('Missing parameter: `grant_type`')
  }

  if (![ 'password', 'refresh_token' ].includes(grantType)) {
    throw new UnsupportedGrantTypeError('Unsupported grant type: `grant_type` is invalid')
  }

  if (!client.grants.includes(grantType)) {
    throw new UnauthorizedClientError('Unauthorized client: `grant_type` is invalid')
  }

  if (grantType === 'password') {
    return handlePasswordGrant({
      request,
      client,
      bypassLogin
    })
  }

  return handleRefreshGrant({
    request,
    client,
    refreshTokenAuthName
  })
}

function handleOAuthAuthenticate (
  req: express.Request,
  res: express.Response
) {
  return oAuthServer.authenticate(new Request(req), new Response(res))
}

export {
  MissingTwoFactorError,
  InvalidTwoFactorError,

  handleOAuthToken,
  handleOAuthAuthenticate
}

// ---------------------------------------------------------------------------

async function handlePasswordGrant (options: {
  request: Request
  client: MOAuthClient
  bypassLogin?: BypassLogin
}) {
  const { request, client, bypassLogin } = options

  if (!request.body.username) {

    throw new InvalidRequestError('Missing parameter: `username`')
  }

  if (!bypassLogin && !request.body.password) {
    throw new InvalidRequestError('Missing parameter: `password`')
  }

  const user = await getUser(request.body.username, request.body.password, bypassLogin)
  if (!user) {
    const registration = await UserRegistrationModel.loadByEmailOrUsername(request.body.username)

    if (registration?.state === UserRegistrationState.REJECTED) {
      throw new RegistrationApprovalRejected('Registration approval for this account has been rejected')
    } else if (registration?.state === UserRegistrationState.PENDING) {
      throw new RegistrationWaitingForApproval('Registration for this account is awaiting approval')
    }

    throw new InvalidGrantError('Invalid grant: user credentials are invalid')
  }

  if (user.otpSecret) {
    if (!request.headers[OTP.HEADER_NAME]) {
      throw new MissingTwoFactorError('Missing two factor header')
    }

    if (await isOTPValid({ encryptedSecret: user.otpSecret, token: request.headers[OTP.HEADER_NAME] }) !== true) {
      throw new InvalidTwoFactorError('Invalid two factor header')
    }
  }

  //remove this part of the code
  //add api call to get token and save below

  const token = await buildToken()

  // console.log('CheckingRequestData' ,request , 'checkingTokenDara' ,token , user )
  return saveToken(token, client, user, { bypassLogin })
}

async function handleRefreshGrant (options: {
  request: Request
  client: MOAuthClient
  refreshTokenAuthName: string
}) {
  const { request, client, refreshTokenAuthName } = options

  if (!request.body.refresh_token) {
    throw new InvalidRequestError('Missing parameter: `refresh_token`')
  }

  const refreshToken = await getRefreshToken(request.body.refresh_token)

  if (!refreshToken) {
    throw new InvalidGrantError('Invalid grant: refresh token is invalid')
  }

  if (refreshToken.client.id !== client.id) {
    throw new InvalidGrantError('Invalid grant: refresh token is invalid')
  }

  if (refreshToken.refreshTokenExpiresAt && refreshToken.refreshTokenExpiresAt < new Date()) {
    throw new InvalidGrantError('Invalid grant: refresh token has expired')
  }

  await revokeToken({ refreshToken: refreshToken.refreshToken })

  const token = await buildToken()

  return saveToken(token, client, refreshToken.user, { refreshTokenAuthName })
}

function generateRandomToken (){
  return randomBytesPromise(256)
    .then(buffer => sha1(buffer))
}

function getTokenExpiresAt (type: 'access' | 'refresh') {
  const lifetime = type === 'access'
    ? CONFIG.OAUTH2.TOKEN_LIFETIME.ACCESS_TOKEN
    : CONFIG.OAUTH2.TOKEN_LIFETIME.REFRESH_TOKEN

  return new Date(Date.now() + lifetime)
}

async function buildToken () {
  const [ accessToken, refreshToken ] = await Promise.all([ generateRandomToken(), generateRandomToken() ])
  console.log(accessToken);
  // //part of the code modified

  //custom headers to send request to Ninjacart IAM service 
  const headers = {
    'authority': 'api.trafyn.info',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'content-type': 'application/json',
    'origin': 'https://retail-banking.trafyn.info',
    'referer': 'https://retail-banking.trafyn.info/',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1',
  };

  //Data of the user that can be changed , right now for demo purposes it is hardcoded
  const data =  {
    contactNumber : "12345678" ,
    retryCount : null 
   };

   //sending/ triggering the api request to recieve the otp from user
    await axios.post('https://api.trafyn.info/iam/api/v1/auth/send/otp', data, { headers });
  
    //recieving the OTP data from the user side , right now for  demo purposes it is hardcoded
    //it defines the user data from the server side , and verifies it is the user the number belongs to
    const userData = {
    action: "VERIFY",
    contactNumber: "12345678" ,
    loginMode: "Mobile",
    newUser: true,
    otp: "111111",
    roles: "TRADER",
  }

   //triggers the api request to recieve the token data from the IAM service 
   const getTokenData = await axios.post('https://api.trafyn.info/iam/api/v1/auth/signin/otp' , userData , {headers});
   const accessTokenNinjacart = createHash('sha256').update(getTokenData.data.data.access_token).digest('base64');
  
  //till here modifications were added , and below the accesstoken passed is the one generated from NINJACART'S IAM service

  return {
    accessToken : String(accessTokenNinjacart),
    refreshToken,
    accessTokenExpiresAt: getTokenExpiresAt('access'),
    refreshTokenExpiresAt: getTokenExpiresAt('refresh')
  }
}
