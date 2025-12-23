Security is core to our values, and we value the input of hackers acting in good faith to help us maintain a high standard for the security and privacy for our users. This includes encouraging responsible vulnerability research and disclosure. This policy sets out our definition of good faith in the context of finding and reporting vulnerabilities, as well as what you can expect from us in return.

## Expectations

When working with us according to this policy, you can expect us to:
- Extend Safe Harbor (see below) for your vulnerability research that is related to this policy;
- Work with you to understand and validate your report
- Work to remediate discovered vulnerabilities in a timely manner; and
- Recognize your contribution to improving our security if you are the first to report a unique vulnerability, and your report triggers a code or configuration change.

## Safe Harbor

When conducting vulnerability research according to this policy, we consider this research to be:
- Authorized in accordance with the law, and we will not initiate or support legal action against you for accidental, good faith violations of this policy;
- Exempt from the Digital Millennium Copyright Act (DMCA), and we will not bring a claim against you for circumvention of technology controls;
- Exempt from restrictions in our Terms & Conditions that would interfere with conducting security research, and we waive those restrictions on a limited basis for work done under this policy;
- Lawful, helpful to the overall security of the Internet, and conducted in good faith.

You are expected, as always, to comply with all applicable laws.

If at any time you have concerns or are uncertain whether your security research is consistent with this policy, please submit a report through one of our Official Channels before going any further.

## Ground Rules

To encourage vulnerability research and to avoid any confusion between good-faith hacking and malicious attack, we ask that you:
- Play by the rules. This includes following this policy, as well as any other relevant agreements. If there is any inconsistency between this policy and any other relevant terms, the terms of this policy will prevail.
- Report any vulnerability you have discovered promptly.
- Avoid violating the privacy of others, disrupting our systems, destroying data, and/or harming user experience.
- Use only the Official Channels to discuss vulnerability information with us.
- Keep the details of any discovered vulnerabilities confidential until they are fixed, according to the Disclosure Terms in this policy.
- Perform testing only on in-scope systems, and respect systems and activities which are out-of-scope. Systems currently considered in-scope are the official demonstration/test servers provided by the PeerTube development team.
- If a vulnerability provides unintended access to data: Limit the amount of data you access to the minimum required for effectively demonstrating a Proof of Concept; and cease testing and submit a report immediately if you encounter any user data during testing, such as Personally Identifiable Information (PII), Personal Healthcare Information (PHI), credit card data, or proprietary information.
- You should only interact with test accounts you own or with explicit permission from the account holder.
- Do not engage in extortion.

## Disclosure Terms

The vulnerability is kept private until a majority of instances known on instances.joinpeertube.org have updated to a safe version of PeerTube or applied a hotfix. The PeerTube development team coordinates efforts to update once the patch is issued.

## Official Channels

To help us receive vulnerability submissions we use the following official reporting channel:
- peertube-security@framasoft.org

The following PGP key can be used to encrypt your email:

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEZjD41hYJKwYBBAHaRw8BAQdAfhTpNfIk8/doN8j+PnGzNazK6p6KXEatqz1L
ARAmlU20M1BlZXJUdWJlIFNlY3VyaXR5IDxwZWVydHViZS1zZWN1cml0eUBmcmFt
YXNvZnQub3JnPoiTBBMWCgA7FiEEr+3Jvd9JW64FG8cvQOaXHEo/b6cFAmYw+NYC
GwMFCwkIBwICIgIGFQoJCAsCBBYCAwECHgcCF4AACgkQQOaXHEo/b6fRbgD8DiAL
7o3eeHuYnQe1I+SnSHU6RDVk/OY27+ZFSrWgsYMBAAA16aGGkbmme1mmig+iEMiL
uhjVAfwuXb0VzrxqqmYMuDgEZjD41hIKKwYBBAGXVQEFAQEHQDCVpwHHyrS9rCQq
0uXbPTWkWuf8yZJqpzZSoG3KY5JZAwEIB4h4BBgWCgAgFiEEr+3Jvd9JW64FG8cv
QOaXHEo/b6cFAmYw+NYCGwwACgkQQOaXHEo/b6fwmAEAsiJDN2GG7sNA2ExjoNT8
P0hnqJkaRh8WJ/pi3u+QlWABAJj5qRhA3Om7SYJjzYfe3fEnrS5cTW51qc96r7GU
IdUI
=y06w
-----END PGP PUBLIC KEY BLOCK-----
```

If you think you have found a vulnerability, please include the following details with your report and be as descriptive as possible:
- The location and nature of the vulnerability,
- A detailed description of the steps required to reproduce the vulnerability (screenshots, compressed screen recordings, and proof-of-concept scripts are all helpful), and
- Your name/handle and a link for recognition.

If you would like to encrypt the information, please use our GPG key.

We may modify the terms of this program or terminate this program at any time. We will not apply any changes we make to these program terms retroactively.
