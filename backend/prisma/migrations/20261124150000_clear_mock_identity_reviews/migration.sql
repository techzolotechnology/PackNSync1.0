-- Old Aadhaar/DL DigiLocker records were local placeholders, not verified documents.
-- Reset them so users are prompted to complete Cashfree Secure ID verification.
UPDATE "verifications"
SET "status" = 'REJECTED',
    "verifiedAt" = NULL,
    "rejectionReason" = 'Please complete verification through Cashfree Secure ID.'
WHERE "documentType" IN ('AADHAAR', 'DL')
  AND "status" = 'PENDING'
  AND "digiLockerId" LIKE 'digilocker://%';
