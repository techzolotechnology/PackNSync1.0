import Tesseract from 'tesseract.js';

const PLATE_PATTERNS = [
    /[A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,3}\s?[0-9]{4}/gi,
    /[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}/gi,
];

export const normalizePlate = (value = '') =>
    String(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export const normalizeText = (value = '') =>
    String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export const fuzzyContains = (haystack, needle) => {
    if (!needle?.trim()) return false;
    const h = normalizeText(haystack);
    const n = normalizeText(needle);
    if (!h || !n) return false;
    return h.includes(n) || n.split(' ').filter((w) => w.length > 2).some((w) => h.includes(w));
};

export const extractPlateFromText = (text) => {
    const normalized = String(text || '').toUpperCase();
    for (const pattern of PLATE_PATTERNS) {
        const matches = normalized.match(pattern);
        if (matches?.length) {
            return normalizePlate(matches[0]);
        }
    }
    return null;
};

export const runRcOcr = async (filePath) => {
    const result = await Tesseract.recognize(filePath, 'eng', {
        logger: () => {},
    });
    return {
        text: result.data?.text || '',
        confidence: result.data?.confidence || 0,
    };
};

export const evaluateRcMatch = ({ ocrText, vehicle, ownerName }) => {
    const extractedPlate = extractPlateFromText(ocrText);
    const expectedPlate = normalizePlate(vehicle.licensePlate);

    const plateMatch = Boolean(
        extractedPlate && expectedPlate &&
        (extractedPlate === expectedPlate || extractedPlate.includes(expectedPlate) || expectedPlate.includes(extractedPlate))
    );

    const makeMatch = fuzzyContains(ocrText, vehicle.make);
    const modelMatch = fuzzyContains(ocrText, vehicle.model);
    const vehicleMatch = makeMatch || modelMatch;
    const ownerMatch = ownerName ? fuzzyContains(ocrText, ownerName) : true;

    const checks = {
        plate: plateMatch,
        make: makeMatch,
        model: modelMatch,
        vehicle: vehicleMatch,
        owner: ownerMatch,
        extractedPlate,
        expectedPlate,
    };

    const autoApproved = plateMatch && vehicleMatch;

    return {
        autoApproved,
        checks,
        summary: autoApproved
            ? 'RC OCR matched plate and vehicle details.'
            : 'RC uploaded. OCR could not fully match — sent for admin review.',
    };
};
