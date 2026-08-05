# Security Policy

## Supported Versions

Security fixes are applied to the latest published version of the GyosJS extension. Preview versions may receive a replacement release rather than a backport.

## Reporting A Vulnerability

Do not open a public issue for an unpatched vulnerability. Email `phuvncom007@gmail.com` with:

- the affected extension and VS Code versions
- the template or workspace conditions needed to reproduce the issue
- the expected impact
- a minimal proof of concept when it is safe to share

You should receive an initial response within seven days. Please allow time for investigation and a coordinated fix before public disclosure.

## Security Boundaries

The extension parses open template text locally. It does not evaluate GyosJS expressions, execute workspace code, collect telemetry, or upload document contents. Its commands only open fixed documentation URLs under `github.com/gyosjs/gyosjs`.
