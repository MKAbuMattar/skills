# Replacement conventions

Use these placeholder shapes for masking. Don't invent ad-hoc replacements when a canonical one exists — consistency makes scrubbed artifacts recognizable to future readers.

## The three replacement strategies

For any leak, pick one of three strategies based on context:

1. **Placeholder** — `<cloud-provider>`, `registry.example.com`. Use when the value is genuinely the user's choice and the artifact is a template.
2. **Multi-option illustrative list** — "e.g., `<X>` / `<Y>` / `<Z>`". Use in prose where naming the class helps the reader understand.
3. **Worked-example value** — `acme`, `<region>` rotated, `appdb`. Use when an obviously-synthetic concrete value reads better than an abstract placeholder.

## Canonical placeholders

| Slot                | Placeholder                                      | Notes                                           |
| ------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Cloud provider name | `<cloud-provider>` / `<Cloud Provider>`          | Capitalize for prose, lowercase in code         |
| Specific cloud      | `<cloud>` / `<Cloud>`                            | Used inline                                     |
| Region              | `<region>`                                       | Or rotate to a region not matching the author's |
| Container registry  | `registry.example.com`                           | Use `example.com` per RFC-2606                  |
| Image path          | `registry.example.com/<your-org>/<image>:<tag>`  | `<your-org>` stays as a literal placeholder     |
| Org / company       | `<your-org>` / `acme`                            | `acme` is the canonical fictional company       |
| Username            | `<username>` / `<user>`                          |                                                 |
| Domain              | `example.com` / `example.org` / `example.net`    | All RFC-2606 reserved                           |
| Email               | `user@example.com`                               | RFC-2606                                        |
| Repo                | `<your-org>/<repo>`                              |                                                 |
| Path (private repo) | drop, or use relative `<repo-root>/...`          | Avoid placeholder if drop works                 |
| API key / secret    | `<your-api-key>` / `xxxxx`                       | Never use realistic-looking fake values         |
| Phone               | `+15555550100`                                   | Reserved range (NANP)                           |
| IP                  | `203.0.113.x` / `192.0.2.x` / `198.51.100.x`     | RFC-5737 reserved                               |
| Service name        | `<service-name>` / `web-api`                     |                                                 |
| Namespace (k8s)     | `<namespace>` / `default`                        |                                                 |
| Bucket / container  | `<bucket-name>` / `mybucket`                     |                                                 |
| Account ID          | `<account-id>` / `123456789012` (12-digit shape) |                                                 |
| Database            | `<database>` / `appdb`                           |                                                 |
| Port                | `8080` / `3000` / `5432`                         | Standard well-known ports are fine              |
| Source-skill author | `<source-author>` / `<upstream-author>`          | Drop entirely is usually best                   |
| Concept author      | `<concept-author>`                               | Usually drop and keep the concept name          |

## Reserved domains (RFC-2606)

Always safe placeholder domains:

- `example.com`
- `example.org`
- `example.net`
- `*.example` (TLD)
- `*.test` (for testing)
- `*.invalid` (always invalid)
- `*.localhost`

## Reserved IP ranges (RFC-5737)

Always safe placeholder IPs (documentation-only, will never route):

- `192.0.2.0/24`
- `198.51.100.0/24`
- `203.0.113.0/24`

Plus the standard private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) — these route on private networks but are safe placeholders.

## Generic role names

When masking branded products, replace with the role name. The role gives the reader the same information without the brand.

| Branded product category | Role replacement                         |
| ------------------------ | ---------------------------------------- |
| Payments providers       | "the payments provider"                  |
| SMS / messaging gateways | "the SMS gateway" / "messaging provider" |
| Email providers          | "the email provider"                     |
| CDN / edge providers     | "the CDN" / "edge proxy"                 |
| Ingress controllers      | "the ingress controller"                 |
| CD platforms             | "the CD platform"                        |
| Feature-flag services    | "the feature-flag service"               |
| Observability / APM      | "the observability platform" / "APM"     |
| Dashboards               | "the dashboard tool"                     |
| Metrics systems          | "the metrics system"                     |
| Chat platforms           | "the chat platform"                      |
| On-call rotation tools   | "the on-call rotation tool"              |
| GitOps controllers       | "the GitOps controller"                  |
| CI systems               | "the CI system"                          |
| Identity providers       | "the identity service"                   |
| Secrets managers         | "the secrets manager"                    |

The wordlist of concrete vendor names lives in `scripts/data/vendor-saas.txt` — the scanner uses it to find the leaks; this doc tells you what to replace them WITH.

## Multi-option illustrative lists

Format: `("e.g., " | "such as " | "(") + Item1 + ", " + Item2 + ", " + Item3 [+ ", or " + Item4 + ")"]`

Example replacements that use lists instead of placeholders:

- `"We use <X>"` → `"We use an ingress controller (e.g., <X>, <Y>, <Z>)"`.
- `"runs on <X>"` → `"runs behind a CDN (e.g., <X>, <Y>, <Z>)"`.
- `"stores in <X>"` → `"stores in a container registry (e.g., <A>, <B>, <C>, <D>)"`.

Lists work best when:

- The role name alone is too abstract for the reader.
- Showing multiple options reinforces the genericity.
- The reader will want to recognize at least one name.

## Worked-example values

Sometimes a concrete-but-obviously-synthetic value reads better than `<placeholder>`:

| Slot                 | Worked example                               |
| -------------------- | -------------------------------------------- |
| Org name             | `acme`                                       |
| Service name         | `webapp`, `api`, `worker`                    |
| Region (placeholder) | rotate to a region not matching the author's |
| Database name        | `appdb`                                      |
| Username             | `appuser`                                    |
| Password (fake)      | `<your-password>` or `s3cret-redacted`       |
| Email                | `team@example.com`                           |

Use worked examples when:

- The value will be displayed as syntax-highlighted code (placeholders look ugly in code).
- The reader will substitute their own value (so a placeholder might be over-replaced).
- A concrete value makes the example easier to follow.

## HTML / Markdown rendering of placeholders

In Markdown source: `<placeholder>` renders as literal angle brackets. Fine in `.md` files.

In HTML files: `<placeholder>` is interpreted as a tag. Use HTML entities:

```html
&lt;cloud-provider&gt;
```

In code blocks within Markdown: depends on the renderer. Most renderers display `<placeholder>` literally inside code fences. If unsure, use `\<placeholder\>` or wrap in backticks: `` `<placeholder>` ``.

## What NOT to use as a placeholder

- **Real data** — never use the user's actual API key, even prefixed with `<your-`. Use `xxxxx` or drop entirely.
- **Famous brand names as placeholders** — don't use a real company name as a stand-in for a real customer; use `acme` (lowercase, common scratch name).
- **Realistic-looking fake values** — secret-shaped fake strings can look like real keys. Use `xxxxxxxx` or drop them.
- **Misleading region names** — don't replace a region with another region from the same vendor unless rotating to a different cloud is the explicit goal.

## When to drop instead of replace

Sometimes the cleanest fix is to drop the leaky line entirely:

- The detail isn't load-bearing for understanding.
- The placeholder version is awkward.
- The line is part of an example that would be incomplete with placeholders.

Examples:

- `"Located at /home/<user>/Work/<repo>/"` — drop entirely; the path was never useful to a reader.
- `"Already running on <A>, <B>, and <C> in our cluster."` — drop the "in our cluster" part; the rest can stay as a list.
- `"Co-Authored-By: <source-author>"` — drop entirely.
