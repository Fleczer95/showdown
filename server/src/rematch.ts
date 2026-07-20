export interface RematchParticipant {
    uuid: string;
    nickname: string;
}

/**
 * A directed rematch exists only for a completed 1:1 round. Return the sole
 * other participant, or null when the source is waiting, group-sized, or the
 * claimed sender did not complete it.
 */
export function resolveRematchRecipient(
    participants: readonly RematchParticipant[],
    senderUuid: string,
): RematchParticipant | null {
    if (participants.length !== 2) return null;
    if (!participants.some((participant) => participant.uuid === senderUuid)) return null;
    return participants.find((participant) => participant.uuid !== senderUuid) ?? null;
}
