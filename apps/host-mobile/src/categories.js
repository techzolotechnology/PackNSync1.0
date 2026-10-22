export const HOSTING_CATEGORIES = [
  { key: 'CAR', label: 'Car', plural: 'Cars', icon: 'car-sport-outline', seats: '5', fuel: 'Petrol', transmission: 'Manual' },
  { key: 'BIKE', label: 'Bike', plural: 'Bikes', icon: 'motorbike', seats: '2', fuel: 'Petrol', transmission: 'Manual' },
  { key: 'SCOOTER', label: 'Scooter', plural: 'Scooters', icon: 'scooter', seats: '2', fuel: 'Petrol', transmission: 'Automatic' },
  { key: 'HELICOPTER', label: 'Helicopter', plural: 'Helicopters', icon: 'helicopter', seats: '4', fuel: 'Aviation fuel', transmission: 'Operator flown' },
];
export const categoryFor = (type) => HOSTING_CATEGORIES.find((c) => c.key === type) || HOSTING_CATEGORIES[0];
export const DOCUMENTS = [
  { key: 'registration', label: 'Aircraft registration', expiry: false },
  { key: 'operatorPermit', label: 'Operator permit', expiry: true },
  { key: 'airworthiness', label: 'Airworthiness document', expiry: true },
  { key: 'insurance', label: 'Aircraft insurance', expiry: true },
];
