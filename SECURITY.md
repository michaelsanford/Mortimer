# Security Policy

## Supported Versions

We only support security updates for the latest released version of Mortimer. Please ensure you are running the most up-to-date client version.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

As Mortimer is a purely client-side static Progressive Web App, it stores zero data on remote servers. All your calculations remain private and sandboxed in your local browser storage.

However, if you discover any security weaknesses (e.g. key derivation flaws in our Passcode Lock or cross-site scripting vulnerabilities), please report them by opening a GitHub Issue or reaching out through security advisories.

### What to check:
1. Verify if the vulnerability can be exploited in a static standalone context.
2. Provide a minimal reproduction script or steps.
