// lib/constellation/markdownSerializer.ts
// Serializes structured AgentArchitecture data back into OpenClaw markdown files.
// Each function produces the content for one file.

import type {
    AgentArchitecture,
    RoleCharter,
    BoundaryModel,
    Doctrine,
    OperationalProtocol,
    MemoryPolicy,
    CharacterLayer,
    IdentityCard,
    UserContext,
    ToolGuide,
    Heartbeat,
    Playbook,
} from './agentSchema';

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderList(items: string[], prefix: string = '- '): string {
    return items.filter(i => i.trim()).map(i => `${prefix}${i}`).join('\n');
}

function renderSection(heading: string, content: string, level: number = 2): string {
    if (!content.trim()) return '';
    const prefix = '#'.repeat(level);
    return `${prefix} ${heading}\n\n${content.trim()}\n`;
}

function renderListSection(heading: string, items: string[], level: number = 2): string {
    const filtered = items.filter(i => i.trim());
    if (filtered.length === 0) return '';
    return renderSection(heading, renderList(filtered), level);
}

// ─── SOUL.md Serializer ─────────────────────────────────────────────────────

export function serializeSoulMd(char: CharacterLayer, agentName: string): string {
    const parts: string[] = [];

    parts.push(`# ${agentName} — Soul\n`);

    if (char.tone) parts.push(renderSection('Tone', char.tone));
    if (char.worldview) parts.push(renderSection('Worldview', char.worldview));
    if (char.personality) parts.push(renderSection('Personality', char.personality));
    if (char.emotionalLogic) parts.push(renderSection('Emotional Logic', char.emotionalLogic));
    if (char.conversationalFingerprint) parts.push(renderSection('Conversational Fingerprint', char.conversationalFingerprint));
    if (char.pacing) parts.push(renderSection('Pacing', char.pacing));
    if (char.voiceMarkers.length > 0) parts.push(renderListSection('Voice Markers', char.voiceMarkers));
    if (char.forbiddenHabits.length > 0) parts.push(renderListSection('Forbidden Habits', char.forbiddenHabits));

    return parts.join('\n');
}

// ─── AGENTS.md Serializer ───────────────────────────────────────────────────

export function serializeAgentsMd(
    role: RoleCharter,
    boundaries: BoundaryModel,
    protocol: OperationalProtocol,
    agentName: string
): string {
    const parts: string[] = [];

    parts.push(`# ${agentName} — Agent Protocol\n`);

    // Role Charter
    if (role.mission || role.scopeOfResponsibility) {
        parts.push('## Role Charter\n');
        if (role.title) parts.push(`**Title:** ${role.title}\n`);
        if (role.codename) parts.push(`**Codename:** ${role.codename}\n`);
        if (role.mission) parts.push(renderSection('Mission', role.mission, 3));
        if (role.scopeOfResponsibility) parts.push(renderSection('Scope of Responsibility', role.scopeOfResponsibility, 3));
        if (role.whyThisRoleExists) parts.push(renderSection('Why This Role Exists', role.whyThisRoleExists, 3));
        if (role.costOfWeakness) parts.push(renderSection('Cost of Weakness', role.costOfWeakness, 3));
    }

    // Boundaries
    const hasBoundaries = boundaries.owns.length > 0 || boundaries.advisesOn.length > 0
        || boundaries.staysOutOf.length > 0 || boundaries.defersTo.length > 0;
    if (hasBoundaries) {
        parts.push('## Boundaries\n');
        if (boundaries.owns.length > 0) parts.push(renderListSection('Owns', boundaries.owns, 3));
        if (boundaries.advisesOn.length > 0) parts.push(renderListSection('Advises On', boundaries.advisesOn, 3));
        if (boundaries.staysOutOf.length > 0) parts.push(renderListSection('Stays Out Of', boundaries.staysOutOf, 3));
        if (boundaries.defersTo.length > 0) parts.push(renderListSection('Defers To', boundaries.defersTo, 3));
        if (boundaries.routeElsewhere.length > 0) parts.push(renderListSection('Route Elsewhere', boundaries.routeElsewhere, 3));
    }

    // Operational Protocol
    const hasProtocol = protocol.defaultBehavior || protocol.taskRouting.length > 0
        || protocol.toolPreferences.length > 0;
    if (hasProtocol) {
        parts.push('## Operational Protocol\n');
        if (protocol.defaultBehavior) parts.push(renderSection('Default Behavior', protocol.defaultBehavior, 3));
        if (protocol.taskRouting.length > 0) parts.push(renderListSection('Task Routing', protocol.taskRouting, 3));
        if (protocol.whenToReadDoctrine.length > 0) parts.push(renderListSection('When to Read Doctrine', protocol.whenToReadDoctrine, 3));
        if (protocol.toolPreferences.length > 0) parts.push(renderListSection('Tool Preferences', protocol.toolPreferences, 3));
        if (protocol.formattingHabits.length > 0) parts.push(renderListSection('Formatting Habits', protocol.formattingHabits, 3));
        if (protocol.memoryRoutines.length > 0) parts.push(renderListSection('Memory Routines', protocol.memoryRoutines, 3));
        if (protocol.responseDiscipline) parts.push(renderSection('Response Discipline', protocol.responseDiscipline, 3));
        if (protocol.handoffBehavior) parts.push(renderSection('Handoff Behavior', protocol.handoffBehavior, 3));
    }

    return parts.join('\n');
}

// ─── Doctrine File Serializer ───────────────────────────────────────────────

export function serializeDoctrineMd(doctrine: Doctrine, agentName: string, codename: string): string {
    const parts: string[] = [];

    parts.push(`# ${codename} — Doctrine\n`);

    if (doctrine.mission) parts.push(renderSection('Mission', doctrine.mission));
    if (doctrine.nonGoals.length > 0) parts.push(renderListSection('Non-Goals', doctrine.nonGoals));
    if (doctrine.decisionFrameworks.length > 0) parts.push(renderListSection('Decision Frameworks', doctrine.decisionFrameworks));
    if (doctrine.evaluationCriteria.length > 0) parts.push(renderListSection('Evaluation Criteria', doctrine.evaluationCriteria));
    if (doctrine.metrics.length > 0) parts.push(renderListSection('Metrics', doctrine.metrics));
    if (doctrine.standardDeliverables.length > 0) parts.push(renderListSection('Standard Deliverables', doctrine.standardDeliverables));
    if (doctrine.antiPatterns.length > 0) parts.push(renderListSection('Anti-Patterns', doctrine.antiPatterns));
    if (doctrine.handoffRules.length > 0) parts.push(renderListSection('Handoff Rules', doctrine.handoffRules));

    // Examples
    const hasExamples = doctrine.examples.good.length > 0 || doctrine.examples.bad.length > 0;
    if (hasExamples) {
        parts.push('## Examples\n');
        if (doctrine.examples.good.length > 0) parts.push(renderListSection('Good Judgment', doctrine.examples.good, 3));
        if (doctrine.examples.bad.length > 0) parts.push(renderListSection('Bad Judgment', doctrine.examples.bad, 3));
    }

    return parts.join('\n');
}

// ─── MEMORY.md Serializer ───────────────────────────────────────────────────

export function serializeMemoryMd(memory: MemoryPolicy, agentName: string): string {
    const parts: string[] = [];

    parts.push(`# ${agentName} — Memory Policy\n`);

    if (memory.workingMemory) parts.push(renderSection('Working Memory', memory.workingMemory));
    if (memory.journalLayer) parts.push(renderSection('Journal Layer', memory.journalLayer));
    if (memory.longTermCoreFacts) parts.push(renderSection('Long-Term Core Facts', memory.longTermCoreFacts));
    if (memory.whatGetsRemembered.length > 0) parts.push(renderListSection('What Gets Remembered', memory.whatGetsRemembered));
    if (memory.whatGetsArchived.length > 0) parts.push(renderListSection('What Gets Archived', memory.whatGetsArchived));
    if (memory.whatShouldNotBeStored.length > 0) parts.push(renderListSection('What Should Not Be Stored', memory.whatShouldNotBeStored));

    return parts.join('\n');
}

// ─── IDENTITY.md Serializer ─────────────────────────────────────────────────
export function serializeIdentityMd(identity: IdentityCard, agentName: string): string {
    const parts: string[] = [];
    parts.push(`# ${agentName}\n`);

    if (identity.name) parts.push(`**Name:** ${identity.name}`);
    if (identity.emoji) parts.push(`**Emoji:** ${identity.emoji}`);
    if (identity.role) parts.push(`**Role:** ${identity.role}`);
    if (identity.codename) parts.push(`**Codename:** ${identity.codename}`);
    if (identity.name || identity.emoji || identity.role || identity.codename) parts.push('');

    if (identity.oneLiner) parts.push(renderSection('One-Liner', identity.oneLiner));
    if (identity.coreIdentity) parts.push(renderSection('Core Identity', identity.coreIdentity));
    if (identity.operatingStyle) parts.push(renderSection('Operating Style', identity.operatingStyle));
    if (identity.teamRelationship) parts.push(renderSection('Relationship to Team', identity.teamRelationship));

    return parts.join('\n');
}

// ─── USER.md Serializer ─────────────────────────────────────────────────────

export function serializeUserMd(ctx: UserContext, agentName: string): string {
    const parts: string[] = [];
    parts.push(`# User Context\n`);

    if (ctx.whoYouAre) parts.push(renderSection('Who You Are', ctx.whoYouAre));
    if (ctx.communicationPreferences.length > 0) parts.push(renderListSection('Communication Preferences', ctx.communicationPreferences));
    if (ctx.projects.length > 0) parts.push(renderListSection('Projects', ctx.projects));
    if (ctx.environment.length > 0) parts.push(renderListSection('Environment', ctx.environment));
    if (ctx.timezone) parts.push(renderSection('Timezone & Availability', ctx.timezone));
    if (ctx.priorities.length > 0) parts.push(renderListSection('Priorities', ctx.priorities));
    if (ctx.petPeeves.length > 0) parts.push(renderListSection('Pet Peeves', ctx.petPeeves));

    return parts.join('\n');
}

// ─── TOOLS.md Serializer ────────────────────────────────────────────────────

export function serializeToolsMd(tools: ToolGuide, agentName: string): string {
    const parts: string[] = [];
    parts.push(`# ${agentName} — Tool Guide\n`);

    if (tools.availableTools.length > 0) parts.push(renderListSection('Available Tools', tools.availableTools));
    if (tools.usageRules.length > 0) parts.push(renderListSection('Tool Usage Rules', tools.usageRules));

    const hasSpecificNotes = tools.specificNotes || tools.browserNotes || tools.shellNotes || tools.memoryNotes;
    if (hasSpecificNotes) {
        parts.push('## Tool-Specific Notes\n');
        if (tools.browserNotes) parts.push(renderSection('Browser', tools.browserNotes, 3));
        if (tools.shellNotes) parts.push(renderSection('Shell', tools.shellNotes, 3));
        if (tools.memoryNotes) parts.push(renderSection('Memory', tools.memoryNotes, 3));
        if (tools.specificNotes && !tools.browserNotes && !tools.shellNotes && !tools.memoryNotes) {
            parts.push(tools.specificNotes + '\n');
        }
    }

    if (tools.forbidden.length > 0) parts.push(renderListSection('Forbidden Tool Combinations', tools.forbidden));
    if (tools.emergencyProcedures) parts.push(renderSection('Emergency Procedures', tools.emergencyProcedures));

    return parts.join('\n');
}

// ─── HEARTBEAT.md Serializer ────────────────────────────────────────────────

export function serializeHeartbeatMd(hb: Heartbeat, agentName: string): string {
    const parts: string[] = [];
    parts.push(`# ${agentName} — Heartbeat\n`);

    if (hb.interval) parts.push(renderSection('Heartbeat Interval', hb.interval));
    if (hb.startupChecklist.length > 0) parts.push(renderListSection('Startup Checklist', hb.startupChecklist));
    if (hb.recurringTasks.length > 0) parts.push(renderListSection('Recurring Tasks', hb.recurringTasks));
    if (hb.healthChecks.length > 0) parts.push(renderListSection('Health Checks', hb.healthChecks));
    if (hb.idleBehavior) parts.push(renderSection('Idle Behavior', hb.idleBehavior));
    if (hb.shutdownRoutine.length > 0) parts.push(renderListSection('Shutdown Routine', hb.shutdownRoutine));

    return parts.join('\n');
}

// ─── Master Serializer ─────────────────────────────────────────────────────

/**
 * Given an AgentArchitecture, produce a map of filename → markdown content
 * for ALL OpenClaw workspace files.
 */
export function serializeAgentToFiles(agent: AgentArchitecture): Record<string, string> {
    const files: Record<string, string> = {};

    // 1. SOUL.md
    files['SOUL.md'] = serializeSoulMd(agent.characterLayer, agent.name);

    // 2. AGENTS.md
    files['AGENTS.md'] = serializeAgentsMd(
        agent.roleCharter,
        agent.boundaries,
        agent.operationalProtocol,
        agent.name
    );

    // 3. IDENTITY.md
    const hasIdentity = agent.identityCard.name || agent.identityCard.emoji
        || agent.identityCard.oneLiner || agent.identityCard.coreIdentity;
    if (hasIdentity) {
        files['IDENTITY.md'] = serializeIdentityMd(agent.identityCard, agent.name);
    }

    // 4. USER.md
    const hasUser = agent.userContext.whoYouAre || agent.userContext.communicationPreferences.length > 0
        || agent.userContext.projects.length > 0;
    if (hasUser) {
        files['USER.md'] = serializeUserMd(agent.userContext, agent.name);
    }

    // 5. TOOLS.md
    const hasTools = agent.toolGuide.availableTools.length > 0 || agent.toolGuide.usageRules.length > 0
        || agent.toolGuide.browserNotes || agent.toolGuide.shellNotes;
    if (hasTools) {
        files['TOOLS.md'] = serializeToolsMd(agent.toolGuide, agent.name);
    }

    // 6. MEMORY.md
    const hasMemory = agent.memoryPolicy.workingMemory || agent.memoryPolicy.whatGetsRemembered.length > 0;
    if (hasMemory) {
        files['MEMORY.md'] = serializeMemoryMd(agent.memoryPolicy, agent.name);
    }

    // 7. HEARTBEAT.md
    const hasHeartbeat = agent.heartbeat.interval || agent.heartbeat.startupChecklist.length > 0
        || agent.heartbeat.recurringTasks.length > 0;
    if (hasHeartbeat) {
        files['HEARTBEAT.md'] = serializeHeartbeatMd(agent.heartbeat, agent.name);
    }

    // 8. Doctrine file (named by codename, e.g. ORACLE.md)
    const hasDoctrine = agent.doctrine.mission || agent.doctrine.nonGoals.length > 0
        || agent.doctrine.decisionFrameworks.length > 0;
    if (hasDoctrine) {
        files[`${agent.codename}.md`] = serializeDoctrineMd(
            agent.doctrine,
            agent.name,
            agent.codename
        );
    }

    return files;
}
