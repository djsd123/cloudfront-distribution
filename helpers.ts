import { route53, cloudfront } from '@pulumi/aws'

export class Helpers {

    static getDomainAndSubDomain(domainName: string): { subDomain: string, parentDomain: string} {

        const domainParts = domainName.split(".");

        // Check if valid domain
        if (domainParts.length < 2) {
            throw new Error(`No TLD found on ${domainName}`);
        }

        // Two parts indicates no sub-domain so only parent domain is returned
        if (domainParts.length === 2) {
            return {
                subDomain: "",
                parentDomain: domainName,
            };
        }

        // Retrieve sub-domain i.e. www if domainName was www.example.com
        const subDomain = domainParts[0];

        // If domainName is www.example.com
        // Shift to the next part
        // resulting in example.com
        domainParts.shift();

        // Return www for subDomain
        // Return example.com for parentDomain and append . on the end
        return {
            subDomain,
            parentDomain: domainParts.join(".") + ".",
        };
    }

    static createAliasRecord(domainName: string, CloudFrontDistribution: cloudfront.Distribution): route53.Record {
        const domainParts = this.getDomainAndSubDomain(domainName);
        const hostedZoneId = route53.getZone({
            name: domainParts.parentDomain,
        }, {async: true}).then(zone => zone.zoneId);

        return new route53.Record(domainName, {
            name: domainParts.subDomain,
            zoneId: hostedZoneId,
            type: "A",
            aliases: [
                {
                    name: CloudFrontDistribution.domainName,
                    zoneId: CloudFrontDistribution.hostedZoneId,
                    evaluateTargetHealth: true,
                },
            ],
        })
    }
}
