/**
 * Mock DigiLocker document fetch.
 * Replace with real OAuth + document API when government credentials are available.
 */
export const mockDigiLockerDocuments = ({ userId, includeRc = false, rcNumber = null }) => {
    const docs = [
        {
            documentType: 'AADHAAR',
            documentNumber: `XXXX-XXXX-${String(userId).slice(0, 4)}`,
            digiLockerId: `digilocker://${userId}/aadhaar`,
            documentUrl: null,
        },
        {
            documentType: 'DL',
            documentNumber: `DL-IN-${String(userId).slice(0, 8).toUpperCase()}`,
            digiLockerId: `digilocker://${userId}/dl`,
            documentUrl: null,
        },
    ];

    if (includeRc && rcNumber) {
        docs.push({
            documentType: 'RC',
            documentNumber: rcNumber.toUpperCase(),
            digiLockerId: `digilocker://${userId}/rc/${rcNumber.toUpperCase()}`,
            documentUrl: null,
        });
    }

    return docs;
};
