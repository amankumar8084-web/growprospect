import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderFactory, PROVIDER_TYPES } from '@lead-discovery/scraper-business';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.resolve(__dirname, '../data/providersConfig.json');

const DEFAULT_CONFIG = {
  activeProvider: PROVIDER_TYPES.GEOAPIFY,
  providers: {
    [PROVIDER_TYPES.GOOGLE_PLACES]: {
      name: 'Google Maps / Places API',
      enabled: true,
      apiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    },
    [PROVIDER_TYPES.GEOAPIFY]: {
      name: 'Geoapify Places API',
      enabled: true,
      apiKey: process.env.GEOAPIFY_API_KEY || ''
    },
    [PROVIDER_TYPES.OSM]: {
      name: 'OpenStreetMap (Nominatim)',
      enabled: true,
      endpoint: 'https://nominatim.openstreetmap.org/search'
    }
  }
};

let inMemoryConfig = null;

function loadConfig() {
  if (inMemoryConfig) return inMemoryConfig;

  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      inMemoryConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        providers: {
          ...DEFAULT_CONFIG.providers,
          ...(parsed.providers || {})
        }
      };
      return inMemoryConfig;
    }
  } catch (err) {
    console.error('[ProvidersController] Failed to read config file, using defaults:', err.message);
  }

  inMemoryConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  return inMemoryConfig;
}

function saveConfig(newConfig) {
  inMemoryConfig = newConfig;
  try {
    const dir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(newConfig, null, 2), 'utf8');
  } catch (err) {
    console.error('[ProvidersController] Failed to persist config to disk:', err.message);
  }
}

function maskKey(key) {
  if (!key || typeof key !== 'string') return '';
  const trimmed = key.trim();
  if (trimmed.length <= 4) return '••••';
  return '••••••••' + trimmed.slice(-4);
}

export function getPublicConfig() {
  const config = loadConfig();
  return {
    activeProvider: config.activeProvider,
    providers: {
      [PROVIDER_TYPES.GOOGLE_PLACES]: {
        name: config.providers[PROVIDER_TYPES.GOOGLE_PLACES]?.name || 'Google Maps / Places API',
        enabled: config.providers[PROVIDER_TYPES.GOOGLE_PLACES]?.enabled ?? true,
        hasKey: Boolean(config.providers[PROVIDER_TYPES.GOOGLE_PLACES]?.apiKey?.trim()),
        maskedKey: maskKey(config.providers[PROVIDER_TYPES.GOOGLE_PLACES]?.apiKey)
      },
      [PROVIDER_TYPES.GEOAPIFY]: {
        name: config.providers[PROVIDER_TYPES.GEOAPIFY]?.name || 'Geoapify Places API',
        enabled: config.providers[PROVIDER_TYPES.GEOAPIFY]?.enabled ?? true,
        hasKey: Boolean(config.providers[PROVIDER_TYPES.GEOAPIFY]?.apiKey?.trim()),
        maskedKey: maskKey(config.providers[PROVIDER_TYPES.GEOAPIFY]?.apiKey)
      },
      [PROVIDER_TYPES.OSM]: {
        name: config.providers[PROVIDER_TYPES.OSM]?.name || 'OpenStreetMap (Nominatim)',
        enabled: config.providers[PROVIDER_TYPES.OSM]?.enabled ?? true,
        endpoint: config.providers[PROVIDER_TYPES.OSM]?.endpoint || 'https://nominatim.openstreetmap.org/search'
      }
    }
  };
}

export function updateConfig(updates = {}) {
  const current = loadConfig();
  const nextConfig = {
    ...current,
    activeProvider: updates.activeProvider || current.activeProvider,
    providers: { ...current.providers }
  };

  if (updates.providers) {
    for (const [providerId, provUpdates] of Object.entries(updates.providers)) {
      if (!nextConfig.providers[providerId]) continue;

      const existingProv = nextConfig.providers[providerId];
      const updatedApiKey = (provUpdates.apiKey && !provUpdates.apiKey.includes('••••'))
        ? provUpdates.apiKey.trim()
        : existingProv.apiKey;

      nextConfig.providers[providerId] = {
        ...existingProv,
        ...provUpdates,
        apiKey: updatedApiKey
      };
    }
  }

  saveConfig(nextConfig);
  return getPublicConfig();
}

export async function testProviderConnection({ providerId, apiKey, endpoint }) {
  const config = loadConfig();
  const providerConfig = config.providers[providerId] || {};

  // If apiKey not sent or masked, use stored key
  const effectiveKey = (apiKey && !apiKey.includes('••••'))
    ? apiKey.trim()
    : (providerConfig.apiKey || '');

  const effectiveEndpoint = endpoint || providerConfig.endpoint || '';

  const adapter = ProviderFactory.create(providerId, {
    apiKey: effectiveKey,
    endpoint: effectiveEndpoint
  });

  return await adapter.testConnection();
}

export async function searchActivePlaces(searchParams = {}) {
  const config = loadConfig();
  const activeType = config.activeProvider || PROVIDER_TYPES.GEOAPIFY;
  const activeProvConfig = config.providers[activeType];

  if (!activeProvConfig || activeProvConfig.enabled === false) {
    throw new Error(`The currently active provider "${activeType}" is disabled. Enable it or select another provider in Settings.`);
  }

  const adapter = ProviderFactory.create(activeType, activeProvConfig);
  return await adapter.searchPlaces(searchParams);
}
