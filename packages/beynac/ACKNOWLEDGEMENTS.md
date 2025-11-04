# Acknowledgements

This project builds upon ideas and code from several excellent open-source projects. We are grateful to their authors and contributors.

## Laravel

**Website:** https://laravel.com/
**License:** MIT
**Copyright:** Taylor Otwell and contributors

Laravel has been a huge source of inspiration for Beynac's overall design and architecture. Often the implementation of each feature ends up very different, since Laravel's PHP patterns don't translate well to TypeScript. But there isn't a feature in Beynac that didn't at least start with wondering how Laravel handles the same.

## Hono

**Repository:** https://github.com/honojs/hono
**License:** MIT
**Copyright:** Yusuke Wada and contributors

Hono inspired the design of Beynac's JSX renderer. Portions of our JSX renderer tests have been directly adapted from Hono's tests to ensure compatibility and correctness. The implementation itself is original to Beynac.

## Rou3

**Repository:** https://github.com/h3js/rou3
**License:** MIT
**Copyright:** Pooya Parsa

Beynac's routing engine is a fork of Rou3, adapted for our specific requirements. The core radix tree algorithm remains largely unchanged from the original implementation.

## original-url

**Repository:** https://github.com/watson/original-url
**License:** MIT
**Copyright:** Thomas Watson Steen

Beynac's URL generation feature includes logic adapted from original-url for extracting the original protocol and host from proxy headers. The implementation has been adapted for Beynac's Headers interface and excludes support for the Forwarded header.

---

All incorporated code is used in compliance with the MIT License terms, which require preservation of copyright notices and license text in distributed copies.
