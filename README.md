# Cloudfront Distribution

### Reusable package to create a cloudfront distribution

Creates a cloudfront distribution with either an S3 bucket or an API gateway as an origin. 
Also, creates a Route53 record to aliases the cloudfront distribution.

#### Prerequisites

* [nodejs](https://nodejs.org/en/download/) or [yarn](https://classic.yarnpkg.com/en/docs/install)
* [pulumi](https://www.pulumi.com/docs/get-started/install/#install-pulumi)
* [typescript](https://www.typescriptlang.org/index.html#download-links)

#### Usage

```typescript
///// Example Instantiation /////
import * as dist from 'new-cloud-front-distribution'

const stackConfig = new pulumi.Config()
const config = {
    domain: stackConfig.require('domain'),
    certificateArn: stackConfig.require('certificateArn')
}

const contentBucket = new aws.s3.Bucket('web-content', {
    bucket: config.domain,
    acl: 'private',
    website: {
        indexDocument: 'index.html',
        errorDocument: '404.html',
    }
})

// OPTIONAL: logs bucket is an S3 bucket that will contain the CDN's request logs

const logBucket = new aws.s3.Bucket('requestLogs', {
    bucket: `${config.domain}-logs`,
    acl: 'private',
})

new NewCloudFrontDistribution('dist', contentBucket, config.domain, config.certificateArn, logBucket)
```
