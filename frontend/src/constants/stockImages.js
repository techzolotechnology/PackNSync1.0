/** Local stock photos (formerly Unsplash hotlinks). Served from /public/images/stock/. */
const stock = (file) => `/images/stock/${file}`;

export const STOCK = {
    carHero: stock('car-hero.jpg'),
    bikeHero: stock('bike-hero.jpg'),
    tripRoad: stock('trip-road.jpg'),
    trip1: stock('trip-1.jpg'),
    trip2: stock('trip-2.jpg'),
    trip3: stock('trip-3.jpg'),
    trip5: stock('trip-5.jpg'),
    trip6: stock('trip-6.jpg'),
    carClassic: stock('car-classic.jpg'),
    carSuv: stock('car-suv.jpg'),
    carEv: stock('car-ev.jpg'),
    carLuxury: stock('car-luxury.jpg'),
    bikeCommuter: stock('bike-commuter.jpg'),
    bikeSports: stock('bike-sports.jpg'),
    bikeScooter: stock('bike-scooter.jpg'),
    bikeEv: stock('bike-ev.jpg'),
    explorePlace: stock('explore-place.jpg'),
};

export const TRIP_COVER_FALLBACKS = [
    STOCK.trip1,
    STOCK.trip2,
    STOCK.trip3,
    STOCK.tripRoad,
    STOCK.trip5,
    STOCK.trip6,
];

export const CAR_FALLBACKS = [
    STOCK.carClassic,
    STOCK.carSuv,
    STOCK.carEv,
    STOCK.carLuxury,
];

export const BIKE_FALLBACKS = [
    STOCK.bikeCommuter,
    STOCK.bikeSports,
    STOCK.bikeScooter,
    STOCK.bikeEv,
];

/** width/height hints to reduce layout shift (match CSS aspect ratios). */
export const STOCK_IMG_SIZE = {
    cardCover: { width: 800, height: 550 },
    profileTrip: { width: 800, height: 500 },
    catThumb: { width: 76, height: 50 },
    hostThumb: { width: 64, height: 64 },
    exploreThumb: { width: 96, height: 96 },
    tripCarThumb: { width: 400, height: 120 },
    moduleCard: { width: 900, height: 600 },
};
