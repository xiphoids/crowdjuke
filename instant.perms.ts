// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from "@instantdb/react";

const rules = {
  attrs: {
    allow: {
      $default: "false",
    },
  },
  votes: {
    allow: {
      view: "true",
      create: "auth.id != null && auth.id == data.voterId",
      delete:
        "auth.id != null && (auth.id == data.voterId || auth.id in data.ref('songRequest.event.creatorId'))",
      update: "auth.id != null && auth.id == data.voterId",
      link: {
        songRequest: "auth.id != null && auth.id == data.voterId",
      },
    },
  },
  events: {
    allow: {
      view: "true",
      create: "auth.id != null",
      delete: "auth.id != null && auth.id == data.creatorId",
      update: "auth.id != null && auth.id == data.creatorId",
      link: {
        songRequests: "auth.id != null",
        memberships: "auth.id != null",
        nowPlaying: "auth.id != null && auth.id == data.creatorId",
      },
    },
  },
  memberships: {
    allow: {
      view: "true",
      create: "auth.id != null",
      delete: "auth.id != null && auth.id == data.userId",
      update: "auth.id != null && auth.id == data.userId",
      link: {
        event: "auth.id != null && auth.id == data.userId",
      },
    },
  },
  songRequests: {
    allow: {
      view: "true",
      create: "auth.id != null && auth.id == data.submittedBy",
      delete:
        "auth.id != null && (auth.id == data.submittedBy || auth.id in data.ref('event.creatorId'))",
      update:
        "auth.id != null && (auth.id == data.submittedBy || auth.id in data.ref('event.creatorId'))",
      link: {
        // Link-time context does not always include `submittedBy`, so only require auth.
        event: "auth.id != null",
        votes: "auth.id != null",
      },
    },
  },
} satisfies InstantRules;

export default rules;
