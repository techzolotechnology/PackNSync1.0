# Owned vehicle condition workflow

Production backend now uses ../Damage AI Inspection/workflow.js and PostgreSQL. This directory retains explicit legacy fixtures; its JSON store and illustrative rate card are not used in production. See ../Damage AI Inspection/RUNBOOK.md for current implementation and rollout.

See [implementation and model roadmap](../Damage%20AI%20Inspection/README.md).
Default runtime uses the PickAndSync local evidence provider. External inspection/insurance adapters are disabled. Mock providers remain explicit test fixtures, not production defaults.

Run: node --test test/*.test.js
