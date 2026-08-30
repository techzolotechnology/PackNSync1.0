export const colors = {
  navy: '#0b2744',
  navySoft: '#35556f',
  blue: '#007bff',
  blueDark: '#0052ad',
  blueSoft: '#d8efff',
  bluePale: '#eff9ff',
  blueBorder: '#b7dcf7',
  white: '#ffffff',
  text: '#0b2744',
  muted: '#526b80',
  subtle: '#64748b',
  border: '#d9e9f5',
  inputBorder: '#c8dfef',
  gold: '#f5b400',
  goldPale: '#fff8d8',
  goldText: '#8a6500',
  danger: '#c2413b',
};

export const shadows = {
  card: {
    shadowColor: colors.navy,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  button: {
    shadowColor: colors.blue,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

export function createLayout(width, height) {
  const compact = width < 360;
  const tablet = width >= 700;
  const landscape = width > height;
  const wide = width >= 560 || (landscape && width >= 640);

  return {
    width,
    height,
    compact,
    tablet,
    landscape,
    wide,
    gutter: compact ? 12 : tablet ? 28 : 16,
    sectionGap: tablet ? 24 : 16,
    contentMaxWidth: 1120,
    formColumns: tablet || (landscape && width >= 680) ? 2 : 1,
    cardColumns: tablet ? 2 : 1,
    heroTitleSize: compact ? 32 : tablet ? 54 : 40,
    headingSize: compact ? 25 : tablet ? 36 : 30,
  };
}

