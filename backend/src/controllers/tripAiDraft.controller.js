import { prisma } from '../utils/prisma.js';
import { aiChatMessage, aiIdentity, aiLimitError, aiQuota, chatContact, finishAiTurn, releaseAiTurn, reserveAiTurn } from '../utils/exploreAiChat.js';
import { generateTripDraft, readTripDraftAnswers } from '../utils/tripAiDraft.js';

export const draftTrip = async (req, res) => {
    const answers = readTripDraftAnswers(req.body?.answers);
    const contact = chatContact(req.body?.contact);
    const identity = await aiIdentity(req, res);
    const quota = await aiQuota(identity);
    if (!quota.remaining) throw aiLimitError(quota.limit);

    const kind = 'TRIP_DRAFT';
    const chat = await prisma.exploreAiChat.create({
        data: { kind, ownerKey: identity.ownerKey, userId: identity.userId, ...contact },
    });
    const turn = await reserveAiTurn(identity, chat.id, kind);
    let draft;
    try {
        draft = await generateTripDraft(answers);
        const pairs = [
            ['Where are you going?', answers.destination],
            ['Where will the group meet?', answers.pickup],
            ['Which places will you stop at?', answers.stopovers.join(', ')],
            ['What kind of trip are you planning?', answers.style],
            ['What else should travellers know?', answers.notes],
            ['What is the estimated budget per person?', answers.budget === null ? null : `₹${answers.budget}`],
        ];
        await finishAiTurn(turn, [
            ...pairs.filter(([, answer]) => answer).flatMap(([question, answer]) => [
                aiChatMessage('assistant', question), aiChatMessage('user', answer),
            ]),
            aiChatMessage('assistant', `${draft.title}\n\n${draft.description}`),
        ]);
    } catch (error) {
        await releaseAiTurn(turn);
        throw error;
    }
    return res.set('Cache-Control', 'no-store').json({ success: true, data: { draft, quota: await aiQuota(identity) } });
};
