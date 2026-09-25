# Third-party material

Some agents and skills in this directory are adapted from open-source projects.
All are MIT-licensed; their copyright notices are reproduced below.

| Project | Version | Files | Changes |
|---------|---------|-------|---------|
| [ECC — everything-claude-code](https://github.com/affaan-m/ecc) | 2.2.2 (`bf70150`) | files ending with *Adapted from everything-claude-code* | Rewritten for this stack (Next.js 16.3, Drizzle, Better Auth, AI SDK, pnpm) and for the spec + TDD workflow; generic examples and tooling references removed. |
| [ponytail](https://github.com/DietrichGebert/ponytail) | 4.10.0 (`e3ba2aa`) | `skills/ponytail/`, `skills/ponytail-review/` | Precedence rules added (spec and TDD first), `ultra` level and test-minimisation rule removed, examples adapted. Hooks, plugin and MCP server not used. |
| [Next.js](https://github.com/vercel/next.js) | `canary` on 2026-09-25 (hash in `/skills-lock.json`) | `skills/next-dev-loop/` | None: installed with `npx skills add vercel/next.js --skill next-dev-loop --agent claude-code -y`, byte-identical to upstream. |

## everything-claude-code

MIT License — Copyright (c) 2026 Affaan Mustafa

## ponytail

MIT License — Copyright (c) 2026 DietrichGebert

## Next.js

MIT License — Copyright (c) 2025 Vercel, Inc.

---

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
