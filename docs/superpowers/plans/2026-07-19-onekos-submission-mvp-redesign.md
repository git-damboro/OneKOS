# OneKOS Submission and MVP Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the local OneKOS demo around a dynamic advisor profile, low-burden AI content workflow, matrix echo-room control, comment operations, lead feedback, realistic simulated data, and per-page feasibility evidence; refresh the editable competition attachments to match.

**Architecture:** Keep the dependency-free Node.js static application and its deterministic local rule engine. Extend the existing data module with traceable synthetic fixtures and the engine with profile and matrix functions; keep seven user-facing pages by folding simulated publishing into quality control and using the comments page for both pre-publish insight and post-publish operations. Each page reuses one implementation drawer component with page-specific feasibility metadata.

**Tech Stack:** Node.js built-in HTTP server, native ES modules, HTML, CSS, JavaScript, DOCX/XLSX generation through bundled workspace document libraries.

---

## File structure

- Modify `src/data.mjs`: realistic L60/L90 fixtures, dynamic profile tags, evidence logs, matrix samples, feasibility metadata.
- Modify `src/engine.mjs`: weighted profile calibration/update and matrix fingerprint collision/reroute functions; preserve comment, script, quality and lead functions.
- Modify `public/index.html`: seven-page navigation and global simulation disclosure.
- Modify `public/app.js`: onboarding/profile page, low-burden workbench, inline feasibility drawer, quality-to-publish flow, comment-to-lead feedback loop.
- Modify `public/styles.css`: profile, evidence, implementation drawer, workflow, matrix and responsive styles.
- Modify `README.md`: current demo route, boundaries, data provenance and presentation script.
- Modify `../OneKOS_比赛附件包/*`: regenerate editable Word/Excel attachments and corresponding PDFs where currently present.

### Task 1: Realistic synthetic domain model

- [ ] Replace fictional A7 facts with official-public L60/L90 example facts and explicit source/effective-date metadata.
- [ ] Add `advisorProfile`, tag evidence, maturity history, onboarding sources, matrix content samples and per-page feasibility records.
- [ ] Add engine functions that return deterministic profile calibration, evidence-based feedback updates, content fingerprints and reroute decisions.

### Task 2: Seven-page low-burden MVP flow

- [ ] Change navigation to AI content workbench, dynamic profile, opportunity radar, content studio, matrix/quality, comment operations and lead learning.
- [ ] Add a compressed onboarding action that simulates basic data, 18 historical works, 60-second voice sample and preference choices, then shows weighted tags and evidence.
- [ ] Make topic and script pages explain which profile, demand and matrix signals were used, and show storyboard, material checklist, subtitles, cover and editing timeline.
- [ ] Fold publish confirmation into matrix/quality; after safe optimization, simulated publish returns to comment operations.
- [ ] On lead takeover, add a feedback event that visibly changes profile maturity and the next recommendation explanation.

### Task 3: Feasibility evidence and safety boundaries

- [ ] Add a shared “查看真实实现” drawer on every page with simulated scope, real source, Feishu components, processing logic, permissions, exception behavior and human handoff.
- [ ] Mark all business records as synthetic, display knowledge source dates, and state that favorites depend on platform-authorized fields.
- [ ] Show failures for expired/conflicting knowledge, missing profile evidence, API outage, risky replies and low-confidence leads as product rules rather than hidden assumptions.

### Task 4: Submission materials

- [ ] Update Part 1 and Part 2 in the main editable proposal.
- [ ] Replace fixed-persona framing in the sample document with dynamic weighted tags, evidence logs and a profile learning example.
- [ ] Update the demo script and data workbook to match the seven-page flow, realistic synthetic fields and feasibility mapping.
- [ ] Update the external references and attachment instructions; keep team experience as an editable template without fabricated claims.

### Task 5: Handoff

- [ ] Update README with the new five-minute story and explicit simulation/production boundaries.
- [ ] Do not run additional build, browser or document-render validation because the user explicitly requested rapid generation without validation; report this limitation in the handoff.
