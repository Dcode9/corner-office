# Corner Office

**A tower of AI-run companies, powered by Pollinations agents and your own Pollen.**

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

Built for Pollinations quest [#17999](https://github.com/pollinations/pollinations/issues/17999).

## Deployment status

Source is ready for deployment, but this app is not yet hosted or submitted. Replace `POLLI_APP_KEY_PLACEHOLDER` in `pollinations.js` with a publishable App Key before enabling real connections. Developer earnings must remain off. Do not put secret keys in source.

## What it is

Corner Office is a 3D tower you can turn, ride, and step into. Every floor is one company, run day-to-day by a private [Pollinations agent](https://gen.pollinations.ai/docs#tag/publish-an-agent) that lives on **your own account**. The agents do the daily work - research, building, reports - and bring finished jobs to you when a decision needs a human.

- **Turn the tower** - drag to rotate a pure-CSS 3D building, click a floor to ride the elevator and step into its office.
- **Run a workday** - each floor's agent runs a research → build → report cycle. Windows light up while a floor works.
- **Decision inbox** - reports that need a human land in the owner's inbox. Approving one offers a separately confirmed paid follow-up note, not an external business action.
- **Receipts** - every agent call with its tokens and Pollen observed key-budget debit, exportable as JSON (not exact per-call attribution).
- **Directory** - browse the companies and apply to rent the next office; a new floor spins up its own agent on your account.
- **Replay mode** - explore a scripted sample workday with no sign-in and zero Pollen spent.

## Bring Your Own Pollen

The app implements [BYOP](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md) with the **device flow**, because that is the flow that offers the `keys` scope:

1. Click **Connect your Pollen** and read the disclosure - it states exactly what happens before anything does.
2. Authorize on `enter.pollinations.ai` with the shown device code. Tick **keys** so the app can create your floors' agents on *your* account, and set your **budget**.
3. The app creates one private prompt agent per floor (`corner-office-…`, base `openai/gpt-5.4-nano`, `privacy` + `secrets` safety features enforced). You can see and delete them any time in your Pollinations dashboard.
4. A finite provider budget is required, but it is not a guaranteed maximum: a final charge can exceed the remaining budget. Observed key-budget debit can include concurrent use or delayed settlement and is not exact per-call attribution. Zero or unknown observed debit blocks further calls. Every agent run is billed to **your** Pollen at standard model rates. The app takes no cut (developer earnings off), shows a recorded session debit total, and pauses before the next call after recorded charges reach 1 Pollen unless you choose to continue. This local pause is not a hard billing cap: a single call may cross it. Unknown charges or failures block further calls for that session. Pollinations checks the budget before calls using estimates; final charges can cross it.

Without `keys`, the app still works in an agent-less mode (plain model calls on your Pollen, clearly marked). The issued `sk_` key lives only in the tab's session storage and is never sent anywhere except Pollinations' own API.

## Tech

Zero dependencies, zero build step: hand-rolled CSS 3D (`transform-style: preserve-3d`), vanilla JS modules, Pollinations REST APIs (`/account/agents`, `/v1/chat/completions`, `/account/profile`, `/account/balance`). Static hosting - open `index.html` or deploy the folder anywhere.

## Files

| File | Role |
|---|---|
| `index.html` | markup, consent/device modals, views |
| `styles.css` | theme + CSS 3D tower |
| `pollinations.js` | device flow, agent CRUD, agent calls, receipts |
| `tower3d.js` | drag-rotate scene, elevator, window lights |
| `app.js` | state, workday loop, decisions, directory, receipts |
| `demo.js` | replay-mode scripted workday |

## Tested

End-to-end with mocked Pollinations endpoints (Playwright): connect flow, agent creation payloads, an 18-call workday across six floors, decision raise/approve follow-up, rent-a-floor agent creation, replay mode, and mobile layout. No live paid calls were tested. Paid execution and settlement timing remain unverified; reviewers choose whether to exercise this using their own Pollen.
