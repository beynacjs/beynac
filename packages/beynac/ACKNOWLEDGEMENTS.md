# Acknowledgements

This project builds upon ideas and code from several excellent open-source projects. We are grateful to their authors and contributors.

## Laravel

**Website:** https://laravel.com/
**License:** MIT
**Copyright:** Taylor Otwell and contributors

Laravel has been a huge source of inspiration for Beynac's overall design and architecture. While Beynac is implemented in TypeScript rather than PHP, we have used Laravel extensively as a reference implementation for framework patterns and conventions.

## Hono

**Website:** https://hono.dev/
**Repository:** https://github.com/honojs/hono
**License:** MIT
**Copyright:** Yusuke Wada and contributors

Hono inspired the design of Beynac's JSX renderer. Additionally, portions of Beynac's test suite have been directly adapted from Hono's tests to ensure compatibility and correctness. The implementation itself is original to Beynac.

## Rou3

**Repository:** https://github.com/binyamin/rou3
**License:** MIT
**Copyright:** Binyamin Aron Green

Beynac's routing engine is a fork of Rou3, adapted for our specific requirements. The core radix tree algorithm remains largely unchanged from the original implementation, with modifications made to integrate with Beynac's architecture and feature set.

---

All incorporated code is used in compliance with the MIT License terms, which require preservation of copyright notices and license text in distributed copies.
