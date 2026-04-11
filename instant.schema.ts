// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $streams: i.entity({
      abortReason: i.string().optional(),
      clientId: i.string().unique().indexed(),
      done: i.boolean().optional(),
      size: i.number().optional(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    events: i.entity({
      createdAt: i.number(),
      creatorId: i.string(),
      joinCode: i.string().unique().indexed(),
      name: i.string(),
    }),
    memberships: i.entity({
      createdAt: i.number(),
      lookupKey: i.string().unique().indexed(),
      userId: i.string(),
    }),
    songRequests: i.entity({
      artist: i.string(),
      createdAt: i.number(),
      durationMs: i.number().optional(),
      imageUrl: i.string().optional(),
      submittedBy: i.string(),
      title: i.string(),
      url: i.string().optional(),
    }),
    votes: i.entity({
      lookupKey: i.string().unique().indexed(),
      value: i.number(),
      voterId: i.string(),
    }),
  },
  links: {
    $streams$files: {
      forward: {
        on: "$streams",
        has: "many",
        label: "$files",
      },
      reverse: {
        on: "$files",
        has: "one",
        label: "$stream",
        onDelete: "cascade",
      },
    },
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    membershipsEvent: {
      forward: {
        on: "memberships",
        has: "one",
        label: "event",
      },
      reverse: {
        on: "events",
        has: "many",
        label: "memberships",
      },
    },
    songRequestsEvent: {
      forward: {
        on: "songRequests",
        has: "one",
        label: "event",
      },
      reverse: {
        on: "events",
        has: "many",
        label: "songRequests",
      },
    },
    votesSongRequest: {
      forward: {
        on: "votes",
        has: "one",
        label: "songRequest",
      },
      reverse: {
        on: "songRequests",
        has: "many",
        label: "votes",
      },
    },
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
