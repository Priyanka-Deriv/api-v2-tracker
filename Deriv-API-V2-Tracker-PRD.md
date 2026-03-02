# PRODUCT REQUIREMENTS DOCUMENT
## Deriv API V2 Live Team Tracker
*Cross-functional project management tool for the V1→V2 API migration*

| Field | Value |
|-------|-------|
| **Owner** | Priyanka Shrivastava |
| **Date** | February 28, 2026 |
| **Version** | 1.0 |
| **Status** | Draft |
| **Project** | API Meetings & Notes |

---

## 1. Problem Statement

The Deriv API V2 migration is a company-wide initiative involving 17+ cross-functional teams (Core API, Auth/Backend, Design, HubSpot/Marketing, BI/Data, Compliance, Partners, Support, Country Managers, SEO, Translations, Content, Finance, DevOps, and more). Action items emerge continuously from daily standups, Slack channels, stakeholder reviews, and ad-hoc conversations, yet no existing tool is lightweight or fast enough to keep up with the team's velocity.

Without a centralised tracker, critical action items get lost between meetings, duplicate work occurs across teams, and blocked items remain invisible until they cause downstream delays. The cost is measurable: missed deadlines, repeated discussions, and an inability for the product owner to maintain a real-time view of progress across all workstreams.

This problem is experienced daily by Priyanka (product owner), Ashkan (tech lead), and 10+ team members who need a single source of truth that updates in real-time from the tools they already use (Slack, meeting transcripts, direct input).

---

## 2. Goals

1. **Single source of truth:** 100% of active action items visible in one shared board, eliminating scattered tracking across Slack, Notion, and private notes.
2. **Zero-friction capture:** Reduce time-to-capture for new action items to under 30 seconds via transcript parsing, Slack sync, and quick-add.
3. **Real-time visibility:** Any team member can see current status of any item without asking anyone, reducing status-check Slack messages by 50%+.
4. **Meeting prep efficiency:** Team scratchpads with pre-loaded open questions and dependencies reduce meeting prep time to under 2 minutes per team.
5. **Blocked item resolution:** Blocked items are surfaced prominently; target average blocked duration < 48 hours.

---

## 3. Non-Goals

- **Full project management replacement:** This is not intended to replace Jira, Linear, or formal sprint planning tools. It is a lightweight operational layer for cross-team coordination.
- **Automated Slack posting:** V1 experimented with posting to Slack but this was removed in favour of read-only sync. Writing back to Slack introduces noise and permission complexity.
- **Gantt charts / timeline views:** The v1 dashboard had Gantt charts but they were dropped as the team preferred the Kanban paradigm for day-to-day operations.
- **User authentication / RBAC:** All team members have equal access. Role-based permissions are unnecessary given the small, trusted team.
- **External partner access:** The tracker is internal-only. Country managers and external partners receive updates through existing communication channels.

---

## 4. User Stories

### Product Owner (Priyanka)

- As the product owner, I want to paste a meeting transcript and have action items auto-extracted so that I do not need to manually transcribe every discussion into tasks.
- As the product owner, I want to see all blocked items across all teams in one view so that I can prioritise unblocking efforts.
- As the product owner, I want a per-team scratchpad with open questions and dependencies so that I can prepare for cross-team meetings in under 2 minutes.
- As the product owner, I want Slack messages from key channels to auto-generate action items so that tasks mentioned in chat are never lost.
- As the product owner, I want to merge duplicate items so that the board stays clean as items come in from multiple sources (transcripts, Slack, manual entry).

### Team Lead (Ashkan)

- As the tech lead, I want to filter the board by team and owner so that I can run focused standups for just my team's items.
- As the tech lead, I want to see items grouped by type (Action Item, Product Decision, Bug/Fix) so that I can prioritise technical decisions separately from action items.
- As the tech lead, I want to inline-edit task titles and notes directly on cards so that I can correct AI-parsed items without opening a modal.

### Team Members (Engineers, Designers)

- As a team member, I want to move my own cards between statuses with one tap so that I can update progress without leaving my workflow.
- As a team member, I want to add new items with minimal fields (title, owner, priority) so that adding a task takes less than 15 seconds.
- As a team member, I want all changes to persist in real-time so that I never lose work or see stale data.

### Cross-Functional Stakeholders

- As a stakeholder from an external team (BI, Compliance, HubSpot), I want to see what dependencies we have on each other so that I can plan my team's work accordingly.
- As a stakeholder, I want to see a filtered view of items assigned to my team so that I only see what is relevant to me.

---

## 5. Requirements

### Must-Have (P0)

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|---------------------|----------|
| P0-1 | Kanban Board with 5 statuses | Board displays Backlog, In Progress, Blocked, In Review, Done columns. Cards can be moved between columns with one action. Card count shown per column. | 🔴 P0 |
| P0-2 | 4 views: Kanban, By Person, By Type, Scratchpad | User can switch between views instantly. Each view filters and groups items correctly. State persists across view switches. | 🔴 P0 |
| P0-3 | AI-powered transcript parsing | User pastes meeting text into modal. Claude extracts action items with title, owner, type, priority. Extracted items appear flagged for review. | 🔴 P0 |
| P0-4 | Slack read sync from 2 channels | Auto-syncs on open. Manual sync button available. Messages mentioning team members or containing task-like language create action items. | 🔴 P0 |
| P0-5 | Duplicate detection on Slack sync | When Slack sync finds a potential duplicate, it flags for review rather than silently creating. User can approve or skip each flagged item. | 🔴 P0 |
| P0-6 | Inline editing of title and notes | Click on title or notes field to edit in-place. Enter saves, Escape cancels. Text auto-selects on click for quick replacement. | 🔴 P0 |
| P0-7 | Live shared storage | All changes persist via shared storage API. Multiple users see the same data. No refresh required. Saving indicator shown. | 🔴 P0 |
| P0-8 | Item types and categorisation | Support 6 types: Action Item, Product Decision, Review, Bug/Fix, Documentation, External Request. Each has distinct visual badge. | 🔴 P0 |
| P0-9 | 17 team structure with POC | All 17 teams registered with colour, label, and point-of-contact. Items tagged to primary team. | 🔴 P0 |
| P0-10 | Add / Delete items | Add modal with title, owner, type, status, priority, team fields. Delete with confirmation. Both persist immediately. | 🔴 P0 |

### Nice-to-Have (P1)

| ID | Requirement | Acceptance Criteria | Priority |
|----|-------------|---------------------|----------|
| P1-1 | Merge mode for duplicate items | Select 2+ cards, choose primary title, notes combine, highest priority wins. Merged items removed from board. | 🟡 P1 |
| P1-2 | Team Scratchpad with 4 tabs | Per-team workspace: Open Questions, Decisions, Dependencies (bidirectional), Notes. Item counts in sidebar. | 🟡 P1 |
| P1-3 | Search and filter controls | Filter by owner, status. Text search across titles. Filters persist across views. | 🟡 P1 |
| P1-4 | Slack sync from additional channels | Support #project-br-api-migration, #need_help_api, #task_connect_api_v1_v2 as optional sync sources. | 🟡 P1 |
| P1-5 | Transcript review UX for status changes | When transcript detects status change on existing item, show accept/reject pairs rather than auto-applying. | 🟡 P1 |

### Future Considerations (P2)

| ID | Requirement | Rationale | Priority |
|----|-------------|-----------|----------|
| P2-1 | Slack write-back (post summaries) | Was built in v6 but removed. Re-evaluate once read sync is stable and team feedback collected. | ⚪ P2 |
| P2-2 | Analytics dashboard (charts, burndown) | v1 had charts but were dropped. Revisit once there is enough historical data to make charts meaningful. | ⚪ P2 |
| P2-3 | Mobile-optimised layout | v10 confirmed basic loading on mobile. Full mobile optimisation deferred until core features are stable. | ⚪ P2 |
| P2-4 | Notification system for blocked items | Push/email alerts when items are blocked for > 24 hours. Requires notification infrastructure. | ⚪ P2 |
| P2-5 | Integration with Deriv internal tools | Connect to internal ticketing, CI/CD, and deployment systems for automated status updates. | ⚪ P2 |

---

## 6. Success Metrics

### Leading Indicators (Days to Weeks)

| Metric | Target | Measurement | Timeline |
|--------|--------|-------------|----------|
| **Team adoption rate** | 100% of core team (12 members) actively using within 1 week | Unique editors per day | Week 1 |
| **Action item capture rate** | > 90% of meeting action items captured (vs. manual audit) | Compare transcript output to meeting notes | Week 2 |
| **Slack sync accuracy** | > 80% of auto-extracted items accepted (not skipped) | Accepted / (Accepted + Skipped) | Week 2 |
| **Time to add item** | < 30 seconds for manual add, < 5 minutes for transcript parse | Timed user sessions | Week 1 |
| **Duplicate rate** | < 15% of Slack-synced items flagged as duplicates | Duplicate flags / total synced | Week 3 |

### Lagging Indicators (Weeks to Months)

| Metric | Target | Measurement | Timeline |
|--------|--------|-------------|----------|
| **Blocked item resolution time** | Average < 48 hours (down from estimated 5+ days) | Time in Blocked status | Month 1 |
| **Status-check messages in Slack** | 50% reduction in "where are we on X?" messages | Keyword search in Slack | Month 2 |
| **Meeting prep time** | < 2 minutes per team (vs. estimated 10+ minutes) | Self-reported survey | Month 1 |
| **Cross-team dependency visibility** | 100% of dependencies documented in scratchpads | Audit of scratchpad entries | Month 2 |

---

## 7. Architecture & Technical Considerations

The tracker is built as a React artifact running inside Claude, leveraging the platform's shared storage API for real-time persistence across all users. Key technical decisions:

- **Frontend:** Single-file React component with Tailwind CSS. Must stay under ~15,000 character artifact limit (learned from v7–v9 crashes).
- **Storage:** window.storage API with JSON serialisation. Three keys: items, scratchpad data, next-ID counter. All writes are immediate.
- **AI Integration:** Claude Sonnet API for transcript parsing and Slack message extraction. Structured JSON prompts with team member lists and existing item context for deduplication.
- **Slack Integration:** Read-only via MCP Slack connector. Real user IDs mapped (8 members). Auto-sync on open + manual refresh.
- **Constraint:** Artifact size limit requires aggressive code compression. Features must be tested individually after integration to prevent truncation crashes.

---

## 8. Teams in Scope

| Team | POC | Type | Status |
|------|-----|------|--------|
| **Core API Team** | Ashkan / Priyanka | Internal | 🟢 Active |
| **Auth / Backend** | Kirill, Lepika | Internal | 🟢 Active |
| **Design (Figma)** | Manros + Malaysia | Internal | 🟢 Active |
| **HubSpot / Marketing** | Abheeshta, Manahel | Internal | 🟢 Active |
| **BI / Data** | Prakash, Guru, Harley | External | 🟢 Active |
| **Compliance / Legal** | Azita | External | 🟢 Active |
| **Partners / Biz Dev** | Ying Shan, Rakshit | Internal | 🟢 Active |
| **Support (Intercom)** | Dmitry | External | 🟢 Active |
| **Country Managers** | Regional (BR/KE/LK) | External | 🟢 Active |
| **DevOps / IT Ops** | Shriv | Internal | 🟢 Active |
| **SEO** | TBD | External | 🟡 Not engaged |
| **Translations** | TBD | External | 🟡 Not engaged |
| **Marketing** | TBD | External | 🟡 Not engaged |
| **Content / Docs** | TBD | External | 🟡 Not engaged |
| **Finance / Revenue** | TBD | External | 🟡 Not engaged |

---

## 9. Open Questions

| # | Question | Owner | Blocking? | Status |
|---|----------|-------|-----------|--------|
| 1 | Should we enable Slack sync for all 5 channels or keep it to 2? | Priyanka | No | 🟡 Open |
| 2 | What is the long-term hosting plan — stay in Claude artifact or migrate to a standalone app? | Engineering | No | 🟡 Open |
| 3 | Who are the POCs for SEO, Translations, Marketing, Content, and Finance teams? | Priyanka | No | 🟡 Open |
| 4 | Should transcript parsing support audio files (not just text)? | Engineering | No | 🟡 Open |
| 5 | Do we need an audit log of who changed what and when? | Priyanka | No | 🟡 Open |
| 6 | How should we handle the artifact size constraint if more features are needed? | Engineering | 🔴 Yes | 🟡 Open |
| 7 | Should Compliance (Azita) have veto power over item status changes? | Compliance | No | 🟡 Open |

---

## 10. Timeline & Phasing

The tracker has already been built through 13 iterative versions. The timeline below reflects the stabilisation and rollout plan:

| Phase | Scope | Timeline | Status |
|-------|-------|----------|--------|
| **Phase 1** | Core Kanban + transcript parsing + inline editing + merge mode | Completed (v1–v5) | 🟢 Done |
| **Phase 2** | Slack integration + Team Scratchpad + live shared storage | Completed (v6–v12) | 🟢 Done |
| **Phase 3** | Team rollout: share with Ashkan, Muhammad, Manros, Ahmed. First Slack sync. Populate scratchpads. | Week of Mar 3, 2026 | 🔵 Next |
| **Phase 4** | Engage TBD teams (SEO, Translations, Finance). Expand Slack channels if needed. | Mar 10–21, 2026 | 🟡 Planned |
| **Phase 5** | Evaluate P1 features based on 2 weeks of team usage data. | Apr 2026 | 🟡 Planned |

---

*CONFIDENTIAL — Deriv Group*
*— End of Document —*
