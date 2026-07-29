# Agent Guide

## Product
Build ILOMAP: a conversational map for personalized places, group plans, saved social spots, and trips.

Trip planning should include the Wonderplan idea: AI-powered, personalized, budget-aware itineraries for solo travelers, families, and friend groups.

## Read First
1. `project.md`
2. `docs/mvp-build-plan.md`
3. `docs/architecture.md`
4. `docs/data-model.md`

## Build Rules
- Start with mock data before paid/external APIs.
- Keep the first screen useful: chat, map, results, saved plan.
- Every place result needs a reason: why it matches the query.
- Prefer working features over broad architecture.
- Do not build a marketing-only landing page as the main experience.

## MVP Priority
1. Conversational place search
2. Ranked map results
3. Personalized trip itinerary builder
4. Group voting
5. Social/screenshot place import
6. Waitlist

## Suggested First Task
Create a simple web app where a user enters a place query and receives 5 mock ranked results on a map with explanations.
