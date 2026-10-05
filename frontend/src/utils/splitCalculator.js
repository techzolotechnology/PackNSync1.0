/**
 * Trip cost splitter: who paid what, who owes what, and the fewest transfers
 * to settle up. Works in integer paise so totals always add up exactly.
 *
 * people:   [{ id, name }]
 * expenses: [{ id, title, amount, paidBy, splitAmong: [personId] }]
 */

const toPaise = (rupees) => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paise) => paise / 100;

/** Split `total` paise across `n` people; leftover paise go to the first ones. */
export function splitEvenly(totalPaise, n) {
    if (n <= 0) return [];
    const base = Math.floor(totalPaise / n);
    const remainder = totalPaise - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function computeSplit(people, expenses) {
    const ids = new Set(people.map((p) => p.id));
    const paid = Object.fromEntries(people.map((p) => [p.id, 0]));
    const share = Object.fromEntries(people.map((p) => [p.id, 0]));
    let totalPaise = 0;

    for (const expense of expenses) {
        const amount = toPaise(expense.amount);
        if (amount <= 0 || !ids.has(expense.paidBy)) continue;
        const among = (expense.splitAmong || []).filter((id) => ids.has(id));
        const participants = among.length ? among : [...ids];

        totalPaise += amount;
        paid[expense.paidBy] += amount;
        splitEvenly(amount, participants.length).forEach((part, i) => {
            share[participants[i]] += part;
        });
    }

    const balances = people.map((p) => ({
        id: p.id,
        name: p.name,
        paid: toRupees(paid[p.id]),
        share: toRupees(share[p.id]),
        net: toRupees(paid[p.id] - share[p.id]), // + gets money back, - owes
    }));

    return { total: toRupees(totalPaise), balances, settlements: settle(people, paid, share) };
}

/** Greedy: biggest debtor pays biggest creditor until everyone is square. */
function settle(people, paid, share) {
    const name = Object.fromEntries(people.map((p) => [p.id, p.name]));
    const creditors = [];
    const debtors = [];
    for (const p of people) {
        const net = paid[p.id] - share[p.id];
        if (net > 0) creditors.push({ id: p.id, amount: net });
        else if (net < 0) debtors.push({ id: p.id, amount: -net });
    }
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(debtors[i].amount, creditors[j].amount);
        transfers.push({
            from: debtors[i].id,
            fromName: name[debtors[i].id],
            to: creditors[j].id,
            toName: name[creditors[j].id],
            amount: toRupees(amount),
        });
        debtors[i].amount -= amount;
        creditors[j].amount -= amount;
        if (debtors[i].amount === 0) i += 1;
        if (creditors[j].amount === 0) j += 1;
    }
    return transfers;
}

/* ---------- shareable state in the URL hash ---------- */

const MAX_PEOPLE = 30;
const MAX_EXPENSES = 200;

/** Compact, index-based encoding so shared links stay short. */
export function encodeState(people, expenses) {
    const index = Object.fromEntries(people.map((p, i) => [p.id, i]));
    const compact = {
        p: people.map((p) => p.name),
        e: expenses.map((e) => [
            e.title,
            Number(e.amount) || 0,
            index[e.paidBy] ?? 0,
            (e.splitAmong || []).map((id) => index[id]).filter((i) => i !== undefined),
        ]),
    };
    const json = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode a shared link; returns null for anything malformed. */
export function decodeState(encoded) {
    try {
        const b64 = String(encoded).replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(b64 + '==='.slice((b64.length + 3) % 4));
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (!Array.isArray(data?.p) || !Array.isArray(data?.e)) return null;

        const people = data.p.slice(0, MAX_PEOPLE).map((n, i) => ({
            id: `p${i}`,
            name: String(n).slice(0, 40) || `Person ${i + 1}`,
        }));
        const expenses = data.e.slice(0, MAX_EXPENSES).map(([title, amount, payer, among], i) => ({
            id: `e${i}`,
            title: String(title ?? '').slice(0, 80),
            amount: Math.max(0, Math.min(Number(amount) || 0, 10000000)),
            paidBy: `p${Number(payer) || 0}`,
            splitAmong: Array.isArray(among)
                ? among.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < people.length).map((n) => `p${n}`)
                : [],
        })).filter((e) => people.some((p) => p.id === e.paidBy));

        return { people, expenses };
    } catch {
        return null;
    }
}
