import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.string().optional().unique().indexed(),
    }),
    events: i.entity({
      name: i.string(),
      joinCode: i.string().unique().indexed(),
      creatorId: i.string(),
      createdAt: i.number(),
    }),
    songRequests: i.entity({
      title: i.string(),
      artist: i.string(),
      url: i.string().optional(),
      submittedBy: i.string(),
      createdAt: i.number(),
    }),
    votes: i.entity({
      value: i.number(),
      voterId: i.string(),
      lookupKey: i.string().unique().indexed(),
    }),
    memberships: i.entity({
      userId: i.string(),
      lookupKey: i.string().unique().indexed(),
      createdAt: i.number(),
    }),
  },
  links: {
    eventRequests: {
      forward: { on: "songRequests", has: "one", label: "event" },
      reverse: { on: "events", has: "many", label: "songRequests" },
    },
    requestVotes: {
      forward: { on: "votes", has: "one", label: "songRequest" },
      reverse: { on: "songRequests", has: "many", label: "votes" },
    },
    eventMemberships: {
      forward: { on: "memberships", has: "one", label: "event" },
      reverse: { on: "events", has: "many", label: "memberships" },
    },
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
