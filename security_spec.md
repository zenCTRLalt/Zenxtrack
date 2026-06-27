# Security Specification: Location Tracking Link Platform

This specification outlines the data invariants, security boundaries, and authorization trees governing the Location Tracking Link Platform.

## 1. Data Invariants & Authorization Matrix

| Path / Collection | Operation | Access Level | Constraints & Guardrails |
| :--- | :--- | :--- | :--- |
| `/links/{linkId}` | `create` | Authed User | MUST set `creatorId` as `request.auth.uid`, `createdAt` as `request.time`, and `clicksCount` as `0`. |
| `/links/{linkId}` | `get` | Anyone | Publicly readable to allow redirect handlers to resolve destination URLs. |
| `/links/{linkId}` | `list` | Authed Creator | Restricted to queries matching `creatorId == request.auth.uid`. |
| `/links/{linkId}` | `update` | Authed Creator OR Visitor | - Creator can update `title`, `destinationUrl` fields.<br>- Visitor can ONLY update `clicksCount` by incrementing it by exactly 1. All other fields are immutable. |
| `/links/{linkId}` | `delete` | Authed Creator | Only the creator of the link can delete it. |
| `/links/{linkId}/visits/{visitId}` | `create` | Anyone | Allowed anonymously to register click data. Requires valid structural payloads (IP, country, timestamp == server time). |
| `/links/{linkId}/visits/{visitId}` | `read`/`list` | Authed Creator | ONLY the creator of the parent `/links/{linkId}` document can read/list its visits. Bypassing uses the Master Gate relational lookup. |
| `/links/{linkId}/visits/{visitId}` | `update`/`delete` | No one | Visits are strictly write-once, append-only, and undeletable. |

---

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Controls)

The following malicious payloads are explicitly tested and blocked by our security ruleset:

1. **Unauthenticated Link Creation**: An anonymous user attempts to create a tracking link.
2. **Identity Spoofing**: An authenticated user `userA` attempts to create a tracking link with `creatorId: "userB"`.
3. **Seed Count Escalation**: A user attempts to create a link with pre-loaded `clicksCount: 1000`.
4. **Link Hijacking**: A malicious user attempts to overwrite another creator's tracking link `destinationUrl`.
5. **Creator ID Mutation**: A user attempts to change the `creatorId` of an existing link to take ownership.
6. **Mass Clicks Counter Spoof**: An attacker attempts to set `clicksCount: 999999` with a single update payload.
7. **Visits Exposure**: An unauthenticated user attempts to list the visits of any tracking link.
8. **Visits Cross-Read**: Authenticated `userA` attempts to query or read the list of visits of `userB`'s tracking links.
9. **Visits Modification**: An attacker attempts to edit a recorded visit to cover their tracks or change its location details.
10. **Visits Deletion**: An attacker attempts to delete stored visit records.
11. **Future Timestamp poisoning**: An attacker submits a click with `timestamp` set in year 2030 instead of `request.time`.
12. **Malicious Link ID Poisoning**: An attacker logs a visit with a malformed or 2MB junk string as the document ID.

---

## 3. Reference Security Verification Details

Our `firestore.rules` implements these rules. An ESLint check will be run to verify compliance.
