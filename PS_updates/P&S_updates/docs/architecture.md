# Architecture

## Suggested Stack
- Frontend: Next.js or React
- Map: Mapbox, Google Maps, or Leaflet
- Backend: Node.js API routes or Express
- Database: Postgres with PostGIS if possible
- Auth: simple email login for MVP
- AI: LLM for query parsing, explanations, itinerary text
- Places: Google Places, Foursquare, Yelp, OpenStreetMap, or seeded test data

## Main Flow
1. User sends chat query.
2. Backend extracts structured search intent.
3. Place search returns candidates.
4. Ranking layer scores candidates.
5. App displays map pins, result cards, and reasons.

## Ranking Inputs
- Distance and neighborhood fit
- Rating and review count
- Open hours
- Price level
- User constraints
- Vibe tags
- Group votes
- Route efficiency for trips

## Keep MVP Simple
Use mock data until UI and ranking flow work. Add real APIs after the product loop feels good.

