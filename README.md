# Cloudfront Distribution

### Reusable package to create a cloudfront distribution

Creates a cloudfront distribution with either an S3 bucket or an API gateway as an origin. 
Also, creates a Route53 record to aliases the cloudfront distribution.

#### Prerequisites

* [nodejs](https://nodejs.org/en/download/) and optionally [yarn](https://classic.yarnpkg.com/en/docs/install)
* [pulumi](https://www.pulumi.com/docs/get-started/install/#install-pulumi)
* [typescript](https://www.typescriptlang.org/index.html#download-links)

#### Usage

```typescript
///// Example Instantiation /////
import * as aws from "@pulumi/aws";
import {NewCloudFrontDistribution} from "../index";

const webBucket = new aws.s3.Bucket('website', {
    bucket: 'your.domain.co.uk',
    acl: 'private',
    website: {
        indexDocument: 'index.html'
    },

    forceDestroy: true
})

new aws.s3.BucketPublicAccessBlock('mainBucketPublicAccessBlock', {
    bucket: webBucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true
})

new aws.s3.BucketObject('index', {
    key: 'index.html',
    acl: 'public-read',
    bucket: webBucket,
    content: `<!DOCTYPE html>
              <html lang="en">
                <body>Hello There</body>
              </html>`
}, { parent: webBucket })

// OPTIONAL: logs bucket is an S3 bucket that will contain the CDN's request logs

const logBucket = new aws.s3.Bucket('requestLogs', {
    bucket: `${config.domain}-logs`,
    acl: 'private',
})

const mydist = new NewCloudFrontDistribution('newcdn', {
    origin: webBucket,
    domainName: 'your.domain.co.uk',
    certificateArn: 'arn:aws:acm:us-east-1:accountid:certificate/some-hash-generated-by-aws'
})

export const endpoints = mydist.cdn.aliases
export const cloudfrontEndpoint = mydist.cdn.domainName
```
