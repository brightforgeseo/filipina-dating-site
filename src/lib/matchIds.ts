export function deterministicMatchId(userIdA: string, userIdB: string): string {
  if (!userIdA || !userIdB) {
    throw new Error('Both user IDs are required to build a match ID');
  }

  const [user1Id, user2Id] = [userIdA, userIdB].sort();
  return `${user1Id}_${user2Id}`;
}

export function deterministicMatchParticipants(userIdA: string, userIdB: string) {
  const [user1Id, user2Id] = [userIdA, userIdB].sort();
  return { user1Id, user2Id };
}
