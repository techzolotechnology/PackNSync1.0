# MVP Build Plan

## Rule For Agents
Build in small working slices. After each slice, run the app and verify one user flow.

## Phase 1: Product Shell
1. Create landing/app screen with map area, chat box, and result list.
2. Add waitlist form.
3. Use mock place data first.

Done when: a user can type a query and see ranked mock places on a map/list.

## Phase 2: Conversational Place Search
1. Parse query into intent, location, constraints, and vibe.
2. Search place provider or local seed data.
3. Rank results by fit.
4. Show reason for each place.

Done when: "quiet romantic drinks near me" returns sensible places with explanations.

## Phase 3: Trip Planner
1. Accept destination, dates, pace, interests, budget.
2. Ask traveler type: solo, family, couple, friends, work trip, backpacker.
3. Generate personalized day plans with curated recommendations.
4. Order places by geography, open hours, and realistic daily energy.
5. Allow edit, regenerate, and save.

Done when: user can create a 2-3 day itinerary and view it by day.

## Phase 4: Group Planning
1. Create shareable plan.
2. Let members add places.
3. Add voting.
4. Sort by votes and fit.

Done when: multiple users can vote on a shared plan.

## Phase 5: Saved Media Import
1. Accept screenshot, pasted text, or TikTok/reel link.
2. Extract place names.
3. Match extracted names to real map places.
4. Save to user map.

Done when: pasted social content becomes mapped saved places.
