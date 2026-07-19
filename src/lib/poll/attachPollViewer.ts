export type PollVoteRef = {
  user?: { toString(): string } | null;
  optionId: string;
};

export type RawPostPoll = {
  options: Array<{ id: string; text: string; votesCount: number }>;
  endsAt: Date | string;
  votesCount: number;
  votes?: PollVoteRef[];
};

export function getMyPollVoteOptionId(
  votes: PollVoteRef[] | undefined,
  userId: string | null
): string | null {
  if (!userId) return null;
  const vote = (votes ?? []).find((v) => v.user?.toString() === userId);
  return vote?.optionId ?? null;
}

type PollViewerFields = {
  poll?: Omit<RawPostPoll, "votes"> | null;
  myVoteOptionId: string | null;
};

/** Strip raw votes from poll and attach the viewer's selection. */
export function withPollViewerState<T>(
  post: T & { poll?: RawPostPoll | null },
  userId: string | null
): Omit<T, "poll"> & PollViewerFields {
  const rawPoll = post.poll;
  const hasOptions = !!rawPoll?.options?.length && !!rawPoll.endsAt;

  if (!hasOptions) {
    return { ...post, poll: null, myVoteOptionId: null };
  }

  const myVoteOptionId = getMyPollVoteOptionId(rawPoll.votes, userId);
  const { votes: _votes, ...pollWithoutVotes } = rawPoll;
  void _votes;

  return {
    ...post,
    poll: pollWithoutVotes,
    myVoteOptionId,
  };
}
