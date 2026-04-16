import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userMeta: defineTable({
    userId: v.string(),
    legacyClaimed: v.boolean(),
  }).index("by_user", ["userId"]),

  subscriptions: defineTable({
    userId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.string(),
    plan: v.optional(v.union(v.literal("pro_monthly"), v.literal("lifetime"))),
    currentPeriodEnd: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_stripe_customer", ["stripeCustomerId"]),

  objects: defineTable({
    userId: v.optional(v.string()),
    kind: v.union(v.literal("project"), v.literal("note"), v.literal("artifact")),
    createdAt: v.number(),
    modifiedAt: v.number(),

    // Project fields
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.number()),
    blockers: v.optional(v.string()),
    lastActivity: v.optional(v.number()),

    // GitHub fields (Phase 6)
    githubRepo: v.optional(v.string()),       // "owner/repo"
    githubLastSync: v.optional(v.number()),   // timestamp

    // Note fields
    content: v.optional(v.string()),
    maturity: v.optional(v.string()),

    // Artifact fields
    type: v.optional(v.string()),
    fileReference: v.optional(v.string()),
    thumbnailDataUrl: v.optional(v.string()),

    // Shared fields
    embedding: v.optional(v.array(v.float64())),
    embeddingText: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    projectId: v.optional(v.union(v.string(), v.null())),
    lastSurfacedAt: v.optional(v.number()),
    canvasPosition: v.optional(v.object({ x: v.number(), y: v.number() })),
    canvasColor: v.optional(v.string()),
    canvasSize: v.optional(v.object({ w: v.number(), h: v.number() })),
  })
    .index("by_kind", ["kind"])
    .index("by_projectId", ["projectId"])
    .index("by_user", ["userId"]),

  connections: defineTable({
    userId: v.optional(v.string()),
    sourceId: v.string(),
    targetId: v.string(),
    sourceKind: v.string(),
    targetKind: v.string(),
    type: v.union(
      v.literal("manual"),
      v.literal("ai_suggested"),
      v.literal("ai_confirmed"),
      v.literal("dismissed")
    ),
    confidence: v.number(),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_source", ["sourceId"])
    .index("by_target", ["targetId"])
    .index("by_type", ["type"])
    .index("by_user", ["userId"]),

  githubTokens: defineTable({
    userId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  apiKeys: defineTable({
    userId: v.string(),
    key: v.string(),
    name: v.string(),
    createdAt: v.number(),
    lastUsed: v.optional(v.number()),
  }).index("by_key", ["key"]),

  tags: defineTable({
    userId: v.string(),
    name: v.string(),
    objectIds: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_name", ["userId", "name"]),

  activity: defineTable({
    userId: v.optional(v.string()),
    action: v.string(),
    objectId: v.string(),
    objectKind: v.string(),
    objectName: v.string(),
    targetId: v.optional(v.string()),
    targetKind: v.optional(v.string()),
    targetName: v.optional(v.string()),
    timestamp: v.number(),
    // Phase 5.3: project-level activity tracking
    projectId: v.optional(v.string()),
    activityType: v.optional(v.string()),
    summary: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_project", ["projectId"])
    .index("by_user_time", ["userId", "timestamp"]),
});
