# Data Model

## User
- id
- name
- email
- home_city
- preferences

## Place
- id
- name
- address
- lat
- lng
- categories
- price_level
- rating
- review_count
- hours
- vibe_tags
- source

## SearchQuery
- id
- user_id
- raw_text
- location
- intent
- constraints
- created_at

## Plan
- id
- owner_id
- title
- destination
- dates
- members
- status

## PlanItem
- id
- plan_id
- place_id
- day
- start_time
- notes
- votes

## SavedMedia
- id
- user_id
- source_type
- original_url_or_file
- extracted_text
- matched_place_ids

