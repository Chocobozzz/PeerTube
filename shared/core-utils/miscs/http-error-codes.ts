/**
 * Hypertext Transfer Protocol (HTTP) response status codes.
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_status_codes}
 *
 * WebDAV and other codes useless with regards to PeerTube are not listed.
 */
export enum HttpStatusCode {

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.2.1
   *
   * The server has received the request headers and the client should proceed to send the request body
   * (in the case of a request for which a body needs to be sent; for example, a POST request).
   * Sending a large request body to a server after a request has been rejected for inappropriate headers would be inefficient.
   * To have a server check the request's headers, a client must send Expect: 100-continue as a header in its initial request
   * and receive a 100 Continue status code in response before sending the body. The response 417 Expectation Failed indicates
   * the request should not be continued.
   */
  CONTINUE_100 = 100,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.2.2
   *
   * This code is sent in response to an Upgrade request header by the client, and indicates the protocol the server is switching too.
   */
  SWITCHING_PROTOCOLS_101 = 101,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.1
   *
   * Standard response for successful HTTP requests. The actual response will depend on the request method used:
   * GET: The resource has been fetched and is transmitted in the message body.
   * HEAD: The entity headers are in the message body.
   * POST: The resource describing the result of the action is transmitted in the message body.
   * TRACE: The message body contains the request message as received by the server
   */
  OK_200 = 200,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.2
   *
   * The request has been fulfilled, resulting in the creation of a new resource, typically after a PUT.
   */
  CREATED_201 = 201,

  /**
   * The request has been accepted for processing, but the processing has not been completed.
   * The request might or might not be eventually acted upon, and may be disallowed when processing occurs.
   */
  ACCEPTED_202 = 202,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.3.5
   *
   * There is no content to send for this request, but the headers may be useful.
   * The user-agent may update its cached headers for this resource with the new ones.
   */
  NO_CONTENT_204 = 204,

  /**
   * The server successfully processed the request, but is not returning any content.
   * Unlike a 204 response, this response requires that the requester reset the document view.
   */
  RESET_CONTENT_205 = 205,

  /**
   * The server is delivering only part of the resource (byte serving) due to a range header sent by the client.
   * The range header is used by HTTP clients to enable resuming of interrupted downloads,
   * or split a download into multiple simultaneous streams.
   */
  PARTIAL_CONTENT_206 = 206,

  /**
   * Indicates multiple options for the resource from which the client may choose (via agent-driven content negotiation).
   * For example, this code could be used to present multiple video format options,
   * to list files with different filename extensions, or to suggest word-sense disambiguation.
   */
  MULTIPLE_CHOICES_300 = 300,

  /**
   * This and all future requests should be directed to the given URI.
   */
  MOVED_PERMANENTLY_301 = 301,

  /**
   * This is an example of industry practice contradicting the standard.
   * The HTTP/1.0 specification (RFC 1945) required the client to perform a temporary redirect
   * (the original describing phrase was "Moved Temporarily"), but popular browsers implemented 302
   * with the functionality of a 303 See Other. Therefore, HTTP/1.1 added status codes 303 and 307
   * to distinguish between the two behaviours. However, some Web applications and frameworks
   * use the 302 status code as if it were the 303.
   */
  FOUND_302 = 302,

  /**
   * SINCE HTTP/1.1
   * The response to the request can be found under another URI using a GET method.
   * When received in response to a POST (or PUT/DELETE), the client should presume that
   * the server has received the data and should issue a redirect with a separate GET message.
   */
  SEE_OTHER_303 = 303,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7232#section-4.1
   *
   * Indicates that the resource has not been modified since the version specified by the request headers
   * `If-Modified-Since` or `If-None-Match`.
   * In such case, there is no need to retransmit the resource since the client still has a previously-downloaded copy.
   */
  NOT_MODIFIED_304 = 304,

  /**
   * SINCE HTTP/1.1
   * In this case, the request should be repeated with another URI; however, future requests should still use the original URI.
   * In contrast to how 302 was historically implemented, the request method is not allowed to be changed when reissuing the
   * original request.
   * For example, a POST request should be repeated using another POST request.
   */
  TEMPORARY_REDIRECT_307 = 307,

  /**
   * The request and all future requests should be repeated using another URI.
   * 307 and 308 parallel the behaviors of 302 and 301, but do not allow the HTTP method to change.
   * So, for example, submitting a form to a permanently redirected resource may continue smoothly.
   */
  PERMANENT_REDIRECT_308 = 308,

  /**
   * The server cannot or will not process the request due to an apparent client error
   * (e.g., malformed request syntax, too large size, invalid request message framing, or deceptive request routing).
   */
  BAD_REQUEST_400 = 400,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7235#section-3.1
   *
   * Similar to 403 Forbidden, but specifically for use when authentication is required and has failed or has not yet
   * been provided. The response must include a `WWW-Authenticate` header field containing a challenge applicable to the
   * requested resource. See Basic access authentication and Digest access authentication. 401 semantically means
   * "unauthenticated",i.e. the user does not have the necessary credentials.
   */
  UNAUTHORIZED_401 = 401,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.2
   *
   * Reserved for future use. The original intention was that this code might be used as part of some form of digital
   * cash or micro payment scheme, but that has not happened, and this code is not usually used.
   * Google Developers API uses this status if a particular developer has exceeded the daily limit on requests.
   */
  PAYMENT_REQUIRED_402 = 402,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.3
   *
   * The client does not have access rights to the content, i.e. they are unauthorized, so server is rejecting to
   * give proper response. Unlike 401, the client's identity is known to the server.
   */
  FORBIDDEN_403 = 403,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.2
   *
   * The requested resource could not be found but may be available in the future.
   * Subsequent requests by the client are permissible.
   */
  NOT_FOUND_404 = 404,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.5
   *
   * A request method is not supported for the requested resource;
   * for example, a GET request on a form that requires data to be presented via POST, or a PUT request on a read-only resource.
   */
  METHOD_NOT_ALLOWED_405 = 405,

  /**
   * The requested resource is capable of generating only content not acceptable according to the Accept headers sent in the request.
   */
  NOT_ACCEPTABLE_406 = 406,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.7
   *
   * This response is sent on an idle connection by some servers, even without any previous request by the client.
   * It means that the server would like to shut down this unused connection. This response is used much more since
   * some browsers, like Chrome, Firefox 27+, or IE9, use HTTP pre-connection mechanisms to speed up surfing. Also
   * note that some servers merely shut down the connection without sending this message.
   *
   * @
   */
  REQUEST_TIMEOUT_408 = 408,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.8
   *
   * Indicates that the request could not be processed because of conflict in the request,
   * such as an edit conflict between multiple simultaneous updates.
   *
   * @see HttpStatusCode.UNPROCESSABLE_ENTITY_422 to denote a disabled feature
   */
  CONFLICT_409 = 409,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.9
   *
   * Indicates that the resource requested is no longer available and will not be available again.
   * This should be used when a resource has been intentionally removed and the resource should be purged.
   * Upon receiving a 410 status code, the client should not request the resource in the future.
   * Clients such as search engines should remove the resource from their indices.
   * Most use cases do not require clients and search engines to purge the resource, and a "404 Not Found" may be used instead.
   */
  GONE_410 = 410,

  /**
   * The request did not specify the length of its content, which is required by the requested resource.
   */
  LENGTH_REQUIRED_411 = 411,

  /**
   * The server does not meet one of the preconditions that the requester put on the request.
   */
  PRECONDITION_FAILED_412 = 412,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.11
   *
   * The request is larger than the server is willing or able to process ; the server might close the connection
   * or return an Retry-After header field.
   * Previously called "Request Entity Too Large".
   */
  PAYLOAD_TOO_LARGE_413 = 413,

  /**
   * The URI provided was too long for the server to process. Often the result of too much data being encoded as a
   * query-string of a GET request, in which case it should be converted to a POST request.
   * Called "Request-URI Too Long" previously.
   */
  URI_TOO_LONG_414 = 414,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.5.13
   *
   * The request entity has a media type which the server or resource does not support.
   * For example, the client uploads an image as image/svg+xml, but the server requires that images use a different format.
   */
  UNSUPPORTED_MEDIA_TYPE_415 = 415,

  /**
   * The client has asked for a portion of the file (byte serving), but the server cannot supply that portion.
   * For example, if the client asked for a part of the file that lies beyond the end of the file.
   * Called "Requested Range Not Satisfiable" previously.
   */
  RANGE_NOT_SATISFIABLE_416 = 416,

  /**
   * The server cannot meet the requirements of the `Expect` request-header field.
   */
  EXPECTATION_FAILED_417 = 417,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc2324
   *
   * This code was defined in 1998 as one of the traditional IETF April Fools' jokes, in RFC 2324, Hyper Text Coffee Pot Control Protocol,
   * and is not expected to be implemented by actual HTTP servers. The RFC specifies this code should be returned by
   * teapots requested to brew coffee. This HTTP status is used as an Easter egg in some websites, including PeerTube instances ;-).
   */
  I_AM_A_TEAPOT_418 = 418,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.3
   *
   * The request was well-formed but was unable to be followed due to semantic errors.
   * The server understands the content type of the request entity (hence a 415 (Unsupported Media Type) status code is inappropriate),
   * and the syntax of the request entity is correct (thus a 400 (Bad Request) status code is inappropriate) but was unable to process
   * the contained instructions. For example, this error condition may occur if an JSON request body contains well-formed (i.e.,
   * syntactically correct), but semantically erroneous, JSON instructions.
   *
   * Can also be used to denote disabled features (akin to disabled syntax).
   *
   * @see HttpStatusCode.UNSUPPORTED_MEDIA_TYPE_415 if the `Content-Type` was not supported.
   * @see HttpStatusCode.BAD_REQUEST_400 if the request was not parsable (broken JSON, XML)
   */
  UNPROCESSABLE_ENTITY_422 = 422,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc4918#section-11.3
   *
   * The resource that is being accessed is locked. WebDAV-specific but used by some HTTP services.
   *
   * @deprecated use `If-Match` / `If-None-Match` instead
   * @see {@link https://evertpot.com/http/423-locked}
   */
  LOCKED_423 = 423,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-4
   *
   * The user has sent too many requests in a given amount of time. Intended for use with rate-limiting schemes.
   */
  TOO_MANY_REQUESTS_429 = 429,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc6585#section-5
   *
   * The server is unwilling to process the request because either an individual header field,
   * or all the header fields collectively, are too large.
   */
  REQUEST_HEADER_FIELDS_TOO_LARGE_431 = 431,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7725
   *
   * A server operator has received a legal demand to deny access to a resource or to a set of resources
   * that includes the requested resource. The code 451 was chosen as a reference to the novel Fahrenheit 451.
   */
  UNAVAILABLE_FOR_LEGAL_REASONS_451 = 451,

  /**
   * A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.
   */
  INTERNAL_SERVER_ERROR_500 = 500,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc7231#section-6.6.2
   *
   * The server either does not recognize the request method, or it lacks the ability to fulfill the request.
   * Usually this implies future availability (e.g., a new feature of a web-service API).
   */
  NOT_IMPLEMENTED_501 = 501,

  /**
   * The server was acting as a gateway or proxy and received an invalid response from the upstream server.
   */
  BAD_GATEWAY_502 = 502,

  /**
   * The server is currently unavailable (because it is overloaded or down for maintenance).
   * Generally, this is a temporary state.
   */
  SERVICE_UNAVAILABLE_503 = 503,

  /**
   * The server was acting as a gateway or proxy and did not receive a timely response from the upstream server.
   */
  GATEWAY_TIMEOUT_504 = 504,

  /**
   * The server does not support the HTTP protocol version used in the request
   */
  HTTP_VERSION_NOT_SUPPORTED_505 = 505,

  /**
   * Official Documentation @ https://tools.ietf.org/html/rfc2518#section-10.6
   *
   * The 507 (Insufficient Storage) status code means the method could not be performed on the resource because the
   * server is unable to store the representation needed to successfully complete the request. This condition is
   * considered to be temporary. If the request which received this status code was the result of a user action,
   * the request MUST NOT be repeated until it is requested by a separate user action.
   *
   * @see HttpStatusCode.PAYLOAD_TOO_LARGE_413 for quota errors
   */
  INSUFFICIENT_STORAGE_507 = 507,
}
