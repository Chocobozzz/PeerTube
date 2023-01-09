function PolicyTemplate(bucketInfo) {
    return JSON.stringify({
      "Version": "2012-10-17",
      "Statement": [
          {
              "Effect": "Allow",
              "Principal": {
                  "AWS": [
                      "*"
                  ]
              },
              "Action": [
                  "s3:GetObject"
              ],
              "Resource": [
                  `arn:aws:s3:::${bucketInfo.BUCKET_NAME}/*`
              ]
          },
          {
              "Effect": "Deny",
              "Principal": {
                  "AWS": [
                      "*"
                  ]
              },
              "Action": [
                  "s3:GetObject"
              ],
              "Resource": [
                `arn:aws:s3:::${bucketInfo.BUCKET_NAME}/favicon.ico`
              ]
          }
      ]
  })
}

export { PolicyTemplate }