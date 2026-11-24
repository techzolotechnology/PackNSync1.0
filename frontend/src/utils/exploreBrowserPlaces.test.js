import { afterEach, describe, expect, it, vi } from 'vitest';
import { importGoogleMapsLibrary } from './googleMapsLoader.js';
import { searchBrowserPlaces } from './exploreBrowserPlaces.js';

vi.mock('./googleMapsLoader.js', () => ({ importGoogleMapsLibrary: vi.fn() }));
const fallbackUrl = 'https://www.google.com/maps/search/?api=1&query=quiet+drinks+in+Indiranagar';

afterEach(() => vi.clearAllMocks());

describe('Explore browser place search', () => {
    it('uses the contextual query and converts Google Maps results to cards', async () => {
        const searchByText = vi.fn().mockResolvedValue({
            places: [{ id: 'example', displayName: 'Example bar', formattedAddress: 'Indiranagar',
                location: { lat: () => 12.97, lng: () => 77.64 }, priceLevel: 'INEXPENSIVE' }],
        });
        importGoogleMapsLibrary.mockResolvedValue({ Place: { searchByText } });

        expect(await searchBrowserPlaces(fallbackUrl, { budget: true })).toEqual([expect.objectContaining({
            id: 'gplace-example', name: 'Example bar', lat: 12.97, lng: 77.64, priceLevel: 1,
        })]);
        expect(searchByText).toHaveBeenCalledWith(expect.objectContaining({
            textQuery: 'quiet drinks in Indiranagar', priceLevels: ['INEXPENSIVE', 'MODERATE'],
        }));
    });

    it('leaves the interactive Maps link available when browser search is also unavailable', async () => {
        importGoogleMapsLibrary.mockRejectedValue(new Error('Places unavailable'));
        expect(await searchBrowserPlaces(fallbackUrl)).toEqual([]);
        expect(await searchBrowserPlaces('https://other.example/?query=places')).toEqual([]);
        expect(importGoogleMapsLibrary).toHaveBeenCalledOnce();
    });
});
