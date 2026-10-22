import { beforeEach, describe, expect, it, vi } from 'vitest';
const { db, audit } = vi.hoisted(() => ({ db: { $queryRaw: vi.fn(), rentalBusinessProfile: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() } }, audit: vi.fn() }));
vi.mock('../utils/prisma.js', () => ({ prisma: { ...db, $transaction: async fn => fn(db) } }));
vi.mock('../utils/audit.js', () => ({ logAdminAction: audit }));
import { businessRouter, adminBusinessRouter } from './rentalBusiness.routes.js';
const handler = (router, path, method) => router.stack.find(item => item.route?.path === path && item.route.methods[method]).route.stack[0].handle;
const shop = { hostType: 'RENTAL_SHOP', businessName: 'Test shop', address: 'Test address', contactNumber: '+919876543210', registrationReference: 'TEST-123' };
const res = () => ({ json: vi.fn() });
beforeEach(() => { vi.clearAllMocks(); db.rentalBusinessProfile.findUnique.mockResolvedValue(null); });
describe('Business profile ownership and review integrity', () => {
    it('creates a pending profile for the authenticated user, ignoring forged owner and approval', async () => {
        await handler(businessRouter, '/', 'put')({ user: { id: 'owner' }, body: { ...shop, userId: 'victim', status: 'APPROVED' } }, res());
        expect(db.rentalBusinessProfile.upsert.mock.calls[0][0].create).toMatchObject({ userId: 'owner', status: 'PENDING', reviewedBy: null });
    });
    it('invalidates approval when business details change', async () => {
        db.rentalBusinessProfile.findUnique.mockResolvedValue({ ...shop, gstNumber: '', version: 3, status: 'APPROVED' });
        await handler(businessRouter, '/', 'put')({ user: { id: 'owner' }, body: { ...shop, businessName: 'Changed name', expectedVersion: 3 } }, res());
        expect(db.rentalBusinessProfile.upsert.mock.calls[0][0].update).toMatchObject({ status: 'PENDING', reviewedBy: null, version: { increment: 1 } });
    });
    it('rejects stale edits without overwriting current details', async () => {
        db.rentalBusinessProfile.findUnique.mockResolvedValue({ ...shop, version: 4 });
        await expect(handler(businessRouter, '/', 'put')({ user: { id: 'owner' }, body: { ...shop, businessName: 'Old edit', expectedVersion: 3 } }, res())).rejects.toMatchObject({ statusCode: 409 });
        expect(db.rentalBusinessProfile.upsert).not.toHaveBeenCalled();
    });
    it('blocks self-approval', async () => {
        await expect(handler(adminBusinessRouter, '/businesses/:id/review', 'patch')({ user: { id: 'owner' }, params: { id: 'owner' }, body: { status: 'APPROVED', expectedVersion: 1, reviewNotes: 'Checked' } }, res())).rejects.toMatchObject({ statusCode: 403 });
        expect(db.rentalBusinessProfile.updateMany).not.toHaveBeenCalled();
    });
    it('rejects review of stale versions and records no audit success', async () => {
        db.rentalBusinessProfile.updateMany.mockResolvedValue({ count: 0 });
        await expect(handler(adminBusinessRouter, '/businesses/:id/review', 'patch')({ user: { id: 'admin' }, params: { id: 'owner' }, body: { status: 'APPROVED', expectedVersion: 1, reviewNotes: 'Checked' } }, res())).rejects.toMatchObject({ statusCode: 409 });
        expect(audit).not.toHaveBeenCalled();
    });
    it('requires verification notes for approval', async () => {
        await expect(handler(adminBusinessRouter, '/businesses/:id/review', 'patch')({ user: { id: 'admin' }, params: { id: 'owner' }, body: { status: 'APPROVED', expectedVersion: 1, reviewNotes: '' } }, res())).rejects.toMatchObject({ statusCode: 400 });
    });
});
