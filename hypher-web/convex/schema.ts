import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userMeta: defineTable({
    userId: v.string(),
    legacyClaimed: v.boolean(),
    demoSeeded: v.optional(v.boolean()),
    /** Pre-rendered digest copy for the demo workspace (Try Hypher). */
    demoDigestText: v.optional(v.string()),
    onboardingWelcomeSeenAt: v.optional(v.number()),
    onboardingTourCompletedAt: v.optional(v.number()),
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

  betaInvites: defineTable({
    prefix: v.string(),
    remainderBcrypt: v.string(),
    label: v.string(),
    maxRedemptions: v.number(),
    redemptionCount: v.number(),
    createdBy: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  })
    .index("by_prefix", ["prefix"])
    .index("by_createdAt", ["createdAt"]),

  betaAccess: defineTable({
    userId: v.string(),
    inviteId: v.optional(v.id("betaInvites")),
    grantedBy: v.optional(v.string()),
    grantedAt: v.number(),
  }).index("by_user", ["userId"]),

  betaFeedback: defineTable({
    userId: v.string(),
    category: v.union(v.literal("bug"), v.literal("friction"), v.literal("idea"), v.literal("praise")),
    message: v.string(),
    pagePath: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("reviewed"), v.literal("closed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  betaRequests: defineTable({
    name: v.string(),
    email: v.string(),
    emailNorm: v.string(),
    role: v.string(),
    work: v.string(),
    pain: v.string(),
    link: v.optional(v.string()),
    howFound: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("archived")
    ),
    adminNotes: v.optional(v.string()),
    idealUserType: v.optional(v.string()),
    inviteId: v.optional(v.id("betaInvites")),
    invitePrefix: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.string()),
    archivedAt: v.optional(v.number()),
  })
    .index("by_email", ["emailNorm"])
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

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
    source: v.optional(v.string()),
    captureType: v.optional(v.union(
      v.literal("thought"),
      v.literal("decision"),
      v.literal("bug"),
      v.literal("task"),
      v.literal("design_note"),
      v.literal("code_note"),
      v.literal("meeting_note"),
      v.literal("user_insight"),
      v.literal("agent_output"),
      v.literal("link_reference"),
      v.literal("open_question")
    )),
    suggestedProjectId: v.optional(v.union(v.string(), v.null())),
    confirmedProjectId: v.optional(v.union(v.string(), v.null())),
    confidence: v.optional(v.number()),
    captureStatus: v.optional(v.union(v.literal("unsorted"), v.literal("sorted"), v.literal("archived"))),
    linkedHandoffId: v.optional(v.string()),
    excludeFromPackets: v.optional(v.boolean()),
    pinnedAsDecision: v.optional(v.boolean()),
    convertedToTask: v.optional(v.boolean()),
    stale: v.optional(v.boolean()),
    lastSurfacedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
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

  projectMemories: defineTable({
    userId: v.string(),
    projectId: v.id("objects"),
    summary: v.string(),
    currentGoal: v.optional(v.string()),
    currentDirection: v.string(),
    recentChanges: v.array(v.string()),
    importantDecisions: v.optional(v.array(v.string())),
    constraints: v.optional(v.array(v.string())),
    openQuestions: v.array(v.string()),
    activeTasks: v.optional(v.array(v.string())),
    blockers: v.optional(v.array(v.string())),
    staleAssumptions: v.optional(v.array(v.string())),
    acceptanceCriteria: v.optional(v.array(v.string())),
    agentWarnings: v.optional(v.array(v.string())),
    handoffNotes: v.optional(v.array(v.string())),
    acceptedCrystallizedSuggestions: v.optional(v.array(v.object({
      kind: v.union(
        v.literal("decision"),
        v.literal("constraint"),
        v.literal("do_not_do"),
        v.literal("current_task"),
        v.literal("open_action"),
        v.literal("acceptance_criterion"),
        v.literal("agent_warning"),
        v.literal("handoff_note")
      ),
      text: v.string(),
      sourceType: v.union(
        v.literal("capture"),
        v.literal("handoff"),
        v.literal("returned_agent_output"),
        v.literal("user_note")
      ),
      sourceId: v.optional(v.string()),
      suggestionId: v.optional(v.string()),
      createdAt: v.number(),
      status: v.optional(v.union(
        v.literal("active"),
        v.literal("stale"),
        v.literal("excluded")
      )),
      updatedAt: v.optional(v.number()),
    }))),
    nextActions: v.array(v.object({
      id: v.string(),
      title: v.string(),
      rationale: v.string(),
      requiredContext: v.optional(v.array(v.string())),
      suggestedTargetTool: v.optional(v.union(
        v.literal("ChatGPT"),
        v.literal("Claude"),
        v.literal("Cursor"),
        v.literal("Windsurf"),
        v.literal("Linear"),
        v.literal("GitHub"),
        v.literal("GitHub Copilot"),
        v.literal("MCP tool"),
        v.literal("Manual")
      )),
      confidence: v.optional(v.number()),
      sourceCaptureIds: v.optional(v.array(v.string())),
      status: v.union(v.literal("suggested"), v.literal("accepted"), v.literal("dismissed")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })),
    generatedAt: v.number(),
    sourceUpdatedAt: v.number(),
    lastUpdatedAt: v.optional(v.number()),
    model: v.string(),
    error: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_project", ["userId", "projectId"]),

  handoffs: defineTable({
    userId: v.string(),
    projectId: v.id("objects"),
    generatedAt: v.number(),
    targetTool: v.union(
      v.literal("ChatGPT"),
      v.literal("Claude"),
      v.literal("Cursor"),
      v.literal("Windsurf"),
      v.literal("Linear"),
      v.literal("GitHub"),
      v.literal("GitHub Copilot"),
      v.literal("MCP tool"),
      v.literal("Manual")
    ),
    packetContent: v.string(),
    sourceCaptures: v.array(v.string()),
    requestedTask: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("used"),
      v.literal("completed"),
      v.literal("discarded")
    ),
    userNotes: v.optional(v.string()),
    returnedAgentOutput: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_project", ["userId", "projectId"])
    .index("by_user_status", ["userId", "status"]),

  agentEvents: defineTable({
    userId: v.string(),
    projectId: v.optional(v.id("objects")),
    source: v.string(),
    kind: v.union(
      v.literal("handoff"),
      v.literal("build_log"),
      v.literal("question"),
      v.literal("suggestion"),
      v.literal("artifact"),
      v.literal("next_action")
    ),
    title: v.string(),
    body: v.string(),
    suggestedActions: v.optional(v.array(v.string())),
    repo: v.optional(v.string()),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    artifactUrl: v.optional(v.string()),
    status: v.union(
      v.literal("new"),
      v.literal("reviewed"),
      v.literal("accepted"),
      v.literal("dismissed")
    ),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
    externalKey: v.optional(v.string()),
    autoResolved: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_user_project", ["userId", "projectId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_user_project_externalKey", ["userId", "projectId", "externalKey"]),

  actions: defineTable({
    userId: v.string(),
    projectId: v.id("objects"),
    title: v.string(),
    status: v.union(
      v.literal("suggested"),
      v.literal("accepted"),
      v.literal("completed"),
      v.literal("dismissed")
    ),
    sourceType: v.union(
      v.literal("project_memory"),
      v.literal("agent_event"),
      v.literal("manual"),
      v.literal("github")
    ),
    sourceId: v.optional(v.string()),
    rationale: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_project", ["userId", "projectId"])
    .index("by_user_status", ["userId", "status"]),

  githubTokens: defineTable({
    userId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  apiKeys: defineTable({
    userId: v.string(),
    /** @deprecated Legacy full-key fingerprint (hk_…); use prefix + remainderBcrypt for new keys */
    key: v.optional(v.string()),
    name: v.string(),
    createdAt: v.number(),
    lastUsed: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    /** First 8 characters of the plaintext key (display + lookup) */
    prefix: v.optional(v.string()),
    /** bcrypt hash of the remainder (after prefix), cost 10 */
    remainderBcrypt: v.optional(v.string()),
    /** Old salt-less hash of the full key — accepted until rotated (see LEGACY_HASH_SUNSET_MS) */
    legacyFullKeyHash: v.optional(v.string()),
    needsRotation: v.optional(v.boolean()),
  })
    .index("by_key", ["key"])
    .index("by_prefix", ["prefix"])
    .index("by_legacy_full", ["legacyFullKeyHash"]),

  captureTokens: defineTable({
    userId: v.string(),
    tokenIdHash: v.string(),
    tokenHash: v.string(),
    scopes: v.array(v.union(v.literal("capture:create"), v.literal("projects:list"))),
    projectId: v.optional(v.union(v.string(), v.null())),
    allowedOrigin: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    sourceApiKeyId: v.optional(v.id("apiKeys")),
    mintedByUserId: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
    revokedReason: v.optional(v.string()),
  })
    .index("by_token_id_hash", ["tokenIdHash"])
    .index("by_user", ["userId"]),

  oauthConsentTransactions: defineTable({
    userId: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.string(),
    scope: v.string(),
    state: v.optional(v.string()),
    csrfTokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    approvedAt: v.optional(v.number()),
    codeIssuedAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  oauthAuthorizationCodes: defineTable({
    codeHash: v.string(),
    userId: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    codeChallenge: v.string(),
    resource: v.string(),
    scope: v.string(),
    consentedAt: v.number(),
    createdAt: v.number(),
    expiresAt: v.number(),
    consumedAt: v.optional(v.number()),
  }).index("by_codeHash", ["codeHash"]),

  oauthAccessTokens: defineTable({
    tokenHash: v.string(),
    userId: v.string(),
    clientId: v.string(),
    resource: v.string(),
    scope: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  }).index("by_tokenHash", ["tokenHash"]),

  tags: defineTable({
    userId: v.string(),
    name: v.string(),
    objectIds: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_name", ["userId", "name"]),

  /** Public read-only canvas snapshots; token hash stored, never the raw secret */
  canvasShares: defineTable({
    userId: v.string(),
    projectId: v.string(),
    /** Opaque URL segment (not secret); secret is separate query param */
    publicSlug: v.string(),
    tokenHash: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_publicSlug", ["publicSlug"])
    .index("by_user_project", ["userId", "projectId"]),

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

  // Adaptive workspace: global + per-project layout preferences
  workspacePrefs: defineTable({
    userId: v.string(),
    projectId: v.optional(v.string()),
    globalDefaultMode: v.optional(
      v.union(v.literal("pulse"), v.literal("canvas"), v.literal("list"))
    ),
    pinnedMode: v.optional(
      v.union(v.literal("pulse"), v.literal("canvas"), v.literal("list"))
    ),
    lastManualMode: v.optional(
      v.union(v.literal("pulse"), v.literal("canvas"), v.literal("list"))
    ),
    lastManualAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_project", ["userId", "projectId"]),

  // Spec #07: daily digest email preferences
  digestPrefs: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    localHour: v.number(),     // 0–23, default 8
    timezone: v.string(),      // IANA e.g. "America/Los_Angeles"
    lastSentAt: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // Spec #07: per-send reply tokens for inbound email capture
  digestReplyTokens: defineTable({
    token: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    consumedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),
});
