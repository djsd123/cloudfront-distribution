import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

import { Helpers } from './helpers'

const ttl = 60 * 10

const provider = new aws.Provider('provider-us-east-1', {
    region: 'us-east-1'
})

export interface CloudFrontDistributionInputs {
    origin: aws.s3.Bucket | aws.apigateway.Stage

    domainName: string

    certificateArn: string

    loggingBucket?: aws.s3.Bucket

    priceClass?: string

    wafAcl?: aws.wafv2.WebAcl
}

export class NewCloudFrontDistribution extends pulumi.ComponentResource {

    readonly defaultWebAcl: aws.wafv2.WebAcl

    readonly cdn: aws.cloudfront.Distribution

    constructor(name: string, args: CloudFrontDistributionInputs, opts: pulumi.ComponentResourceOptions = {}) {

        super('djsd123:components:NewCloudFrontDistribution', name, args, opts)

        const isBucket = (origin: aws.s3.Bucket | aws.apigateway.Stage): origin is aws.s3.Bucket => {
            return (
                (origin as aws.s3.Bucket).bucket !== undefined
            )
        }

        // Create Origin Access Identity

        const oai = new aws.cloudfront.OriginAccessIdentity(`${name}-origin-access-identity`, {
            comment: 'Ensure visitors cannot access the site using the S3 endpoint url'
        }, { parent: this})

        if (isBucket(args.origin)) {

            const originAccessIdentityPolicyStatement: aws.iam.PolicyStatement[] = [{
                Sid: 'originAccess',
                Action: ['s3:GetObject'],
                Effect: 'Allow',

                Principal: {
                    AWS: oai.iamArn
                },

                /* Outputs are just promises and passing them calls toString on the output
                for some reason pulumi complains in some cases that this is not supported.
                See: https://github.com/pulumi/pulumi/pull/2496/files
                Hence: using the `interpolate` function
                 */
                Resource: pulumi.interpolate `${args.origin.arn}/*`
            }]

            const originAccessIdentityPolicy: aws.iam.PolicyDocument = {
                Version: '2012-10-17',
                Id: 'mainBucket',
                Statement: originAccessIdentityPolicyStatement
            }

            new aws.s3.BucketPolicy(`${name}-originPolicyAttachment`, {
                bucket: args.origin.id,
                policy: originAccessIdentityPolicy,
            }, { parent: this })

        }

        // Create default WAF access control list

        this.defaultWebAcl = new aws.wafv2.WebAcl(`${name}-waf`, {
            description: 'Best practice AWS WAF rules',
            scope: 'CLOUDFRONT',

            defaultAction: {
                allow: {}
            },

            rules: [
                {
                    name: 'AWS-AWSManagedRulesCommonRuleSet',
                    priority: 0,

                    overrideAction: {
                        count: {}
                    },

                    statement: {
                        managedRuleGroupStatement: {
                            name: 'AWSManagedRulesCommonRuleSet',
                            vendorName: 'AWS'
                        }
                    },

                    visibilityConfig: {
                        cloudwatchMetricsEnabled: true,
                        metricName: 'AWSManagedRulesCommonRuleSet',
                        sampledRequestsEnabled: true
                    }
                },
                {
                    name: 'AWS-AWSManagedRulesAnonymousIpList',
                    priority: 1,

                    overrideAction: {
                        count: {}
                    },

                    statement: {
                        managedRuleGroupStatement: {
                            name: 'AWSManagedRulesAnonymousIpList',
                            vendorName: 'AWS'
                        }
                    },

                    visibilityConfig: {
                        cloudwatchMetricsEnabled: true,
                        metricName: 'AWS-AWSManagedRulesAnonymousIpList',
                        sampledRequestsEnabled: true
                    }
                },
                {
                    name: 'AWS-AWSManagedRulesAmazonIpReputationList',
                    priority: 2,

                    overrideAction: {
                        count: {}
                    },

                    statement: {
                        managedRuleGroupStatement: {
                            name: 'AWSManagedRulesAmazonIpReputationList',
                            vendorName: 'AWS'
                        }
                    },

                    visibilityConfig: {
                        cloudwatchMetricsEnabled: true,
                        metricName: 'AWS-AWSManagedRulesAmazonIpReputationList',
                        sampledRequestsEnabled: true
                    }
                }
            ],

            visibilityConfig: {
                cloudwatchMetricsEnabled: true,
                metricName: name,
                sampledRequestsEnabled: true
            }
        }, { parent: this, provider, deleteBeforeReplace: true })

        const cloudFrontDistributionArgs: aws.cloudfront.DistributionArgs = {

            enabled: true,

            aliases: [args.domainName],

            origins: [
                {
                    originId: args.origin.arn,
                    domainName: isBucket(args.origin) ?
                        args.origin.bucketRegionalDomainName :
                        args.origin.invokeUrl.apply(s => {
                            return s.replace(`/${(args.origin as aws.apigateway.Stage).stageName}`, '')
                        }),
                    originPath: isBucket(args.origin) ? undefined : args.origin.stageName,
                    s3OriginConfig: isBucket(args.origin) ? {
                        originAccessIdentity: oai.cloudfrontAccessIdentityPath
                    } : undefined
                }
            ],

            defaultRootObject: 'index.html',

            defaultCacheBehavior: {
                targetOriginId: args.origin.arn,
                viewerProtocolPolicy: 'redirect-to-https',
                allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
                cachedMethods: ['GET', 'HEAD', 'OPTIONS'],

                forwardedValues: {
                    cookies: { forward: 'none' },
                    queryString: false
                },

                compress: true,
                minTtl: 0,
                defaultTtl: ttl,
                maxTtl: ttl
            },

            // "All" is the most broad distribution, and also the most expensive.
            // "100" is the least broad (USA, Canada and Europe), and also the least expensive.

            priceClass: args.priceClass || 'PriceClass_100',

            // You can customize error responses. When CloudFront recieves an error from the origin (e.g. S3 or some other
            // web service) it can return a different error code, and return the response for a different resource.

            customErrorResponses: isBucket(args.origin) ? [
                {
                    errorCode: 404,
                    responseCode: 404,
                    responsePagePath: '/404.html',
                },
            ] : undefined,

            restrictions: {
                geoRestriction: {
                    restrictionType: 'none',
                },
            },

            viewerCertificate: {
                acmCertificateArn: args.certificateArn,
                sslSupportMethod: 'sni-only',
            },

            loggingConfig: args.loggingBucket ? {
                bucket: args.loggingBucket?.bucketDomainName,
                includeCookies: false,
                prefix: `${args.domainName}/`,
            } : undefined,

            // If no WebACL is defined.  Use default

            webAclId: args.wafAcl?.arn || this.defaultWebAcl.arn
        }

        this.cdn = new aws.cloudfront.Distribution(`${name}-cdn`, cloudFrontDistributionArgs, {
            parent: this,
            provider
        })

        // Create an A record for this distribution

        Helpers.createAliasRecord(args.domainName, this.cdn)

        this.registerOutputs({
            cloudFrontDomainName: this.cdn.domainName,
            cloudFrontUrn: this.cdn.urn,
            wafWebAclUrn: this.defaultWebAcl.urn,
        })
    }
}
