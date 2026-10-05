import { describe, it, expect } from 'vitest';
import { computeSplit, decodeState, encodeState, splitEvenly } from './splitCalculator.js';

const people = [
    { id: 'a', name: 'Asha' },
    { id: 'b', name: 'Bilal' },
    { id: 'c', name: 'Chitra' },
];

describe('trip cost splitter', () => {
    it('splits uneven amounts without losing a paisa', () => {
        expect(splitEvenly(1000, 3)).toEqual([334, 333, 333]);
        expect(splitEvenly(1000, 3).reduce((s, n) => s + n, 0)).toBe(1000);
    });

    it('computes balances and the fewest settle-up transfers', () => {
        const { total, balances, settlements } = computeSplit(people, [
            { id: '1', title: 'Car rental', amount: 6000, paidBy: 'a', splitAmong: [] },
            { id: '2', title: 'Dinner', amount: 1500, paidBy: 'b', splitAmong: [] },
        ]);

        expect(total).toBe(7500);
        expect(balances.find((x) => x.id === 'a').net).toBe(3500);
        expect(balances.find((x) => x.id === 'b').net).toBe(-1000);
        expect(balances.find((x) => x.id === 'c').net).toBe(-2500);
        expect(settlements).toEqual([
            expect.objectContaining({ from: 'c', to: 'a', amount: 2500 }),
            expect.objectContaining({ from: 'b', to: 'a', amount: 1000 }),
        ]);
    });

    it('respects who an expense is split among', () => {
        const { balances } = computeSplit(people, [
            { id: '1', title: 'Drinks', amount: 900, paidBy: 'a', splitAmong: ['a', 'b'] },
        ]);
        expect(balances.find((x) => x.id === 'c').share).toBe(0);
        expect(balances.find((x) => x.id === 'b').net).toBe(-450);
    });

    it('nets to zero across the group', () => {
        const { balances } = computeSplit(people, [
            { id: '1', title: 'Fuel', amount: 1234.56, paidBy: 'c', splitAmong: [] },
            { id: '2', title: 'Tolls', amount: 99.99, paidBy: 'a', splitAmong: ['a', 'c'] },
        ]);
        const net = balances.reduce((s, b) => s + Math.round(b.net * 100), 0);
        expect(net).toBe(0);
    });

    it('round-trips through a shareable link and rejects junk', () => {
        const expenses = [{ id: '1', title: 'Stay ₹', amount: 4200, paidBy: 'b', splitAmong: ['a', 'b'] }];
        const decoded = decodeState(encodeState(people, expenses));
        expect(decoded.people.map((p) => p.name)).toEqual(['Asha', 'Bilal', 'Chitra']);
        expect(decoded.expenses[0]).toMatchObject({ title: 'Stay ₹', amount: 4200, paidBy: 'p1', splitAmong: ['p0', 'p1'] });

        expect(decodeState('not-base64!!')).toBeNull();
        expect(decodeState(btoa('{"x":1}'))).toBeNull();
    });
});
