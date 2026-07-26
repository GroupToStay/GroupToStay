# Translation Coverage Report

Generated: 2026-07-26T10:46:30.794Z

## Coverage Definitions

- **Catalog parity**: keys present in both English and Arabic divided by the union of catalog keys.
- **Estimated UI coverage**: static/dynamic translation call occurrences divided by translation calls plus hardcoded USER_VISIBLE occurrences. This is an estimate, not a claim of linguistic quality.

| Metric                | Coverage |
| --------------------- | -------- |
| Catalog parity        | 100.0%   |
| Estimated UI coverage | 99.9%    |

## Per Namespace

| Namespace     | English | Arabic | Paired | Coverage |
| ------------- | ------- | ------ | ------ | -------- |
| admin         | 423     | 423    | 423    | 100.0%   |
| auth          | 88      | 88     | 88     | 100.0%   |
| buttons       | 2       | 2      | 2      | 100.0%   |
| common        | 89      | 89     | 89     | 100.0%   |
| company       | 14      | 14     | 14     | 100.0%   |
| dashboard     | 153     | 153    | 153    | 100.0%   |
| errors        | 13      | 13     | 13     | 100.0%   |
| forms         | 31      | 31     | 31     | 100.0%   |
| hotel         | 149     | 149    | 149    | 100.0%   |
| landing       | 118     | 118    | 118    | 100.0%   |
| legacy        | 0       | 0      | 0      | 100.0%   |
| legal         | 79      | 79     | 79     | 100.0%   |
| navigation    | 42      | 42     | 42     | 100.0%   |
| notifications | 14      | 14     | 14     | 100.0%   |
| pricing       | 49      | 49     | 49     | 100.0%   |
| profile       | 108     | 108    | 108    | 100.0%   |
| rfq           | 146     | 146    | 146    | 100.0%   |
| subscriptions | 0       | 0      | 0      | 100.0%   |
| validation    | 14      | 14     | 14     | 100.0%   |

## Per Feature

| Feature        | Files | Translation refs | Hardcoded user strings | Estimated coverage |
| -------------- | ----- | ---------------- | ---------------------- | ------------------ |
| Admin          | 12    | 389              | 0                      | 100.0%             |
| Agency         | 4     | 93               | 0                      | 100.0%             |
| Authentication | 6     | 107              | 0                      | 100.0%             |
| Common         | 91    | 146              | 1                      | 99.3%              |
| Dashboard      | 10    | 196              | 0                      | 100.0%             |
| Hotels         | 10    | 156              | 0                      | 100.0%             |
| Landing        | 5     | 214              | 0                      | 100.0%             |
| Legal          | 4     | 59               | 0                      | 100.0%             |
| Notifications  | 5     | 15               | 0                      | 100.0%             |
| Profile        | 1     | 38               | 0                      | 100.0%             |
| RFQ            | 18    | 217              | 0                      | 100.0%             |
| Settings       | 3     | 19               | 0                      | 100.0%             |

## Per Module

| Module                   | Files | Translation refs | Hardcoded user strings | Estimated coverage |
| ------------------------ | ----- | ---------------- | ---------------------- | ------------------ |
| src/components           | 68    | 177              | 0                      | 100.0%             |
| src/features             | 9     | 38               | 0                      | 100.0%             |
| src/hooks                | 7     | 0                | 0                      | 100.0%             |
| src/integrations         | 6     | 0                | 0                      | 100.0%             |
| src/lib                  | 18    | 4                | 1                      | 80.0%              |
| src/router.tsx           | 1     | 0                | 0                      | 100.0%             |
| src/routes               | 56    | 1430             | 0                      | 100.0%             |
| src/routeTree.gen.ts     | 1     | 0                | 0                      | 100.0%             |
| src/server.ts            | 1     | 0                | 0                      | 100.0%             |
| src/start.ts             | 1     | 0                | 0                      | 100.0%             |
| src/vite-imagetools.d.ts | 1     | 0                | 0                      | 100.0%             |

## Per Page

| Route file                                     | Files | Translation refs | Hardcoded user strings | Estimated coverage |
| ---------------------------------------------- | ----- | ---------------- | ---------------------- | ------------------ |
| __root.tsx                                     | 1     | 15               | 0                      | 100.0%             |
| _authenticated/admin.agency-verifications.tsx  | 1     | 66               | 0                      | 100.0%             |
| _authenticated/admin.group-requests.tsx        | 1     | 85               | 0                      | 100.0%             |
| _authenticated/admin.hotel-companies.tsx       | 1     | 46               | 0                      | 100.0%             |
| _authenticated/admin.hotel-listings.tsx        | 1     | 39               | 0                      | 100.0%             |
| _authenticated/admin.index.tsx                 | 1     | 43               | 0                      | 100.0%             |
| _authenticated/admin.settings.tsx              | 1     | 6                | 0                      | 100.0%             |
| _authenticated/admin.subscription-interest.tsx | 1     | 3                | 0                      | 100.0%             |
| _authenticated/admin.subscriptions.tsx         | 1     | 6                | 0                      | 100.0%             |
| _authenticated/admin.tsx                       | 1     | 0                | 0                      | 100.0%             |
| _authenticated/admin.users.tsx                 | 1     | 86               | 0                      | 100.0%             |
| _authenticated/dashboard.admin.tsx             | 1     | 57               | 0                      | 100.0%             |
| _authenticated/dashboard.agency-profile.tsx    | 1     | 90               | 0                      | 100.0%             |
| _authenticated/dashboard.bookings.$id.tsx      | 1     | 27               | 0                      | 100.0%             |
| _authenticated/dashboard.bookings.index.tsx    | 1     | 12               | 0                      | 100.0%             |
| _authenticated/dashboard.bookings.tsx          | 1     | 0                | 0                      | 100.0%             |
| _authenticated/dashboard.hotel.$id.tsx         | 1     | 48               | 0                      | 100.0%             |
| _authenticated/dashboard.hotel.index.tsx       | 1     | 32               | 0                      | 100.0%             |
| _authenticated/dashboard.hotel.pms.tsx         | 1     | 6                | 0                      | 100.0%             |
| _authenticated/dashboard.hotel.tsx             | 1     | 0                | 0                      | 100.0%             |
| _authenticated/dashboard.index.tsx             | 1     | 29               | 0                      | 100.0%             |
| _authenticated/dashboard.invitations.tsx       | 1     | 41               | 0                      | 100.0%             |
| _authenticated/dashboard.messages.$id.tsx      | 1     | 16               | 0                      | 100.0%             |
| _authenticated/dashboard.messages.index.tsx    | 1     | 12               | 0                      | 100.0%             |
| _authenticated/dashboard.messages.tsx          | 1     | 1                | 0                      | 100.0%             |
| _authenticated/dashboard.notifications.tsx     | 1     | 9                | 0                      | 100.0%             |
| _authenticated/dashboard.profile.tsx           | 1     | 38               | 0                      | 100.0%             |
| _authenticated/dashboard.quotations.tsx        | 1     | 10               | 0                      | 100.0%             |
| _authenticated/dashboard.rfqs.$id.compare.tsx  | 1     | 18               | 0                      | 100.0%             |
| _authenticated/dashboard.rfqs.$id.tsx          | 1     | 36               | 0                      | 100.0%             |
| _authenticated/dashboard.rfqs.index.tsx        | 1     | 13               | 0                      | 100.0%             |
| _authenticated/dashboard.rfqs.new.tsx          | 1     | 1                | 0                      | 100.0%             |
| _authenticated/dashboard.rfqs.tsx              | 1     | 0                | 0                      | 100.0%             |
| _authenticated/dashboard.tsx                   | 1     | 1                | 0                      | 100.0%             |
| _authenticated/route.tsx                       | 1     | 33               | 0                      | 100.0%             |
| about.tsx                                      | 1     | 7                | 0                      | 100.0%             |
| auth.tsx                                       | 1     | 63               | 0                      | 100.0%             |
| contact.tsx                                    | 1     | 9                | 0                      | 100.0%             |
| cookies.tsx                                    | 1     | 11               | 0                      | 100.0%             |
| for-hotels.tsx                                 | 1     | 9                | 0                      | 100.0%             |
| hotel-list.tsx                                 | 1     | 2                | 0                      | 100.0%             |
| hotels.$id.tsx                                 | 1     | 20               | 0                      | 100.0%             |
| hotels.index.tsx                               | 1     | 14               | 0                      | 100.0%             |
| how-it-works.tsx                               | 1     | 8                | 0                      | 100.0%             |
| index.tsx                                      | 1     | 176              | 0                      | 100.0%             |
| pricing.tsx                                    | 1     | 14               | 0                      | 100.0%             |
| privacy.tsx                                    | 1     | 23               | 0                      | 100.0%             |
| request-quote.tsx                              | 1     | 37               | 0                      | 100.0%             |
| requests.$id.tsx                               | 1     | 46               | 0                      | 100.0%             |
| requests.index.tsx                             | 1     | 18               | 0                      | 100.0%             |
| reset-password.tsx                             | 1     | 11               | 0                      | 100.0%             |
| sitemap[.]xml.ts                               | 1     | 0                | 0                      | 100.0%             |
| subscription.checkout.tsx                      | 1     | 0                | 0                      | 100.0%             |
| subscription.coming-soon.tsx                   | 1     | 12               | 0                      | 100.0%             |
| terms.tsx                                      | 1     | 12               | 0                      | 100.0%             |
| trust.tsx                                      | 1     | 13               | 0                      | 100.0%             |
