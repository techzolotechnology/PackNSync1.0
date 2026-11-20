module.exports = ({ config }) => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

  return {
    ...config,
    android: {
      ...config.android,
      ...(apiKey ? {
        config: {
          ...config.android?.config,
          googleMaps: { ...config.android?.config?.googleMaps, apiKey },
        },
      } : {}),
    },
    extra: {
      ...config.extra,
      mapsConfigured: Boolean(apiKey),
    },
  };
};
