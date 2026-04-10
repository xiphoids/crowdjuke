import type { InstantRules } from "@instantdb/react";

const rules = {
  events: {
    allow: {
      view: "true",
      create: "auth.id != null",
      update: "auth.id != null && auth.id == data.creatorId",
      delete: "auth.id != null && auth.id == data.creatorId",
    },
  },
  songRequests: {
    allow: {
      view: "true",
      create: "auth.id != null && auth.id == data.submittedBy",
      update: "false",
      delete: "auth.id != null && auth.id == data.submittedBy",
    },
  },
  votes: {
    allow: {
      view: "true",
      create: "auth.id != null && auth.id == data.voterId",
      update: "auth.id != null && auth.id == data.voterId",
      delete: "auth.id != null && auth.id == data.voterId",
    },
  },
  memberships: {
    allow: {
      view: "true",
      create: "auth.id != null",
      update: "false",
      delete: "auth.id != null && auth.id == data.userId",
    },
  },
  attrs: {
    allow: {
      $default: "false",
    },
  },
} satisfies InstantRules;

export default rules;
