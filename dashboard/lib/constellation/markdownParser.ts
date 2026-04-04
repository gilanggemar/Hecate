// lib/constellation/markdownParser.ts
// Parses OpenClaw agent markdown files into structured AgentArchitecture data.
// Handles SOUL.md, AGENTS.md, doctrine, MEMORY.md, and custom files.
// Flexible heading extraction: works with any heading level (##, ###, ####).

import type {
    AgentArchitecture,
    RoleCharter,
    BoundaryModel,
    Doctrine,
    OperationalProtocol,
    Playbook,
    MemoryPolicy,
    CharacterLayer,
    IdentityCard,
    UserContext,
    ToolGuide,
    Heartbeat,
    BuildScore,
} from './agentSchema';
import { createEmptyAgent } from './agentSchema';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract content under a markdown heading at ANY level (##, ###, ####).
 * Searches for the heading text case-insensitively.
 * Returns the text between the matched heading and the next heading of same or higher level,
 * or a horizontal rule (---), or end of string.
 */
function extractSection(md: string, heading: string): string {
    // Try matching heading at levels 2, 3, 4 (in order of priority)
    for (let level = 2; level <= 4; level++) {
        const prefix = '#'.repeat(level);
        // Match this heading, capture content until next heading of same/higher level, HR, or end of string
        const regex = new RegExp(
            `^${prefix}\\s+${escapeRegex(heading)}[\\s:]*$([\\s\\S]*?)(?=^#{1,${level}}\\s|^---+\\s*$|$(?![\\s\\S]))`,
            'mi'
        );
        const match = md.match(regex);
        if (match && match[1].trim()) {
            return match[1].trim();
        }
    }

    // Fallback: try matching as a bold label "**Heading:** content" (single line)
    const boldRegex = new RegExp(
        `\\*\\*${escapeRegex(heading)}[:\\s]*\\*\\*[:\\s]*(.+)`,
        'mi'
    );
    const boldMatch = md.match(boldRegex);
    if (boldMatch) return boldMatch[1].trim();

    return '';
}

/**
 * Extract a large section that may contain sub-headings.
 * Used for top-level sections like "## Boundaries" that contain ### children.
 */
function extractTopSection(md: string, heading: string): string {
    const regex = new RegExp(
        `^##\\s+${escapeRegex(heading)}[\\s:]*$([\\s\\S]*?)(?=^##\\s(?!#)|^---+\\s*$|$(?![\\s\\S]))`,
        'mi'
    );
    const match = md.match(regex);
    if (match && match[1].trim()) {
        return match[1].trim();
    }
    return '';
}

/** Extract all items from a markdown bullet list */
function extractList(text: string): string[] {
    return text
        .split('\n')
        .map(line => line.replace(/^\s*[-*+]\s*/, '').trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── SOUL.md Parser ─────────────────────────────────────────────────────────

export function parseSoulMd(content: string): Partial<CharacterLayer> {
    if (!content) return {};

    const result: Partial<CharacterLayer> = {};

    const toneSection = extractSection(content, 'Tone');
    if (toneSection) result.tone = toneSection;

    const worldviewSection = extractSection(content, 'Worldview')
        || extractSection(content, 'Core Truths')
        || extractSection(content, 'Philosophy');
    if (worldviewSection) result.worldview = worldviewSection;

    const personalitySection = extractSection(content, 'Personality')
        || extractSection(content, 'Role')
        || extractSection(content, 'Identity');
    if (personalitySection) result.personality = personalitySection;

    const emotionalSection = extractSection(content, 'Emotional Logic')
        || extractSection(content, 'Emotional');
    if (emotionalSection) result.emotionalLogic = emotionalSection;

    const voiceSection = extractSection(content, 'Voice Markers')
        || extractSection(content, 'Conversational Fingerprint')
        || extractSection(content, 'Voice')
        || extractSection(content, 'Communication Style');
    if (voiceSection) {
        result.conversationalFingerprint = voiceSection;
        result.voiceMarkers = extractList(voiceSection);
    }

    const pacingSection = extractSection(content, 'Pacing');
    if (pacingSection) result.pacing = pacingSection;

    const forbiddenSection = extractSection(content, 'Forbidden Habits')
        || extractSection(content, 'Forbidden')
        || extractSection(content, 'Boundaries')
        || extractSection(content, 'Hard Limits')
        || extractSection(content, "Don't");
    if (forbiddenSection) result.forbiddenHabits = extractList(forbiddenSection);

    // If none of the sections matched, treat the whole content as personality
    if (Object.keys(result).length === 0 && content.trim()) {
        result.personality = content.trim();
    }

    return result;
}

// ─── AGENTS.md Parser ───────────────────────────────────────────────────────

export function parseAgentsMd(content: string): {
    roleCharter: Partial<RoleCharter>;
    boundaries: Partial<BoundaryModel>;
    operationalProtocol: Partial<OperationalProtocol>;
} {
    if (!content) return { roleCharter: {}, boundaries: {}, operationalProtocol: {} };

    const roleCharter: Partial<RoleCharter> = {};
    const boundaries: Partial<BoundaryModel> = {};
    const operationalProtocol: Partial<OperationalProtocol> = {};

    // ── Role Charter ──
    // Try to get title/codename from bold labels
    const titleMatch = content.match(/\*\*Title[\s:]*\*\*[\s:]*(.+)/i);
    if (titleMatch) roleCharter.title = titleMatch[1].trim();

    const codenameMatch = content.match(/\*\*Codename[\s:]*\*\*[\s:]*(.+)/i);
    if (codenameMatch) roleCharter.codename = codenameMatch[1].trim();

    // Mission
    const missionSection = extractSection(content, 'Mission')
        || extractSection(content, 'Purpose')
        || extractSection(content, 'Role');
    if (missionSection) roleCharter.mission = missionSection;

    // Scope
    const scopeSection = extractSection(content, 'Scope of Responsibility')
        || extractSection(content, 'Scope')
        || extractSection(content, 'Responsibility');
    if (scopeSection) roleCharter.scopeOfResponsibility = scopeSection;

    // Why this role
    const whySection = extractSection(content, 'Why This Role Exists')
        || extractSection(content, 'Why This Role');
    if (whySection) roleCharter.whyThisRoleExists = whySection;

    // Cost of weakness
    const costSection = extractSection(content, 'Cost of Weakness')
        || extractSection(content, 'Cost');
    if (costSection) roleCharter.costOfWeakness = costSection;

    // ── Boundaries ──
    // The AGENTS.md files use both ## Owns (top-level) and ### Owns (under ## Boundaries)
    // Try extracting a top-level "Boundaries" section first, then parse children within it.
    // Also support ## Owns directly.
    const boundariesBlock = extractTopSection(content, 'Boundaries');
    const boundarySource = boundariesBlock || content;

    const ownsSection = extractSection(boundarySource, 'Owns')
        || extractSection(boundarySource, 'Primary Domain')
        || extractSection(boundarySource, 'Ownership');
    if (ownsSection) boundaries.owns = extractList(ownsSection);

    const advisesSection = extractSection(boundarySource, 'Advises On')
        || extractSection(boundarySource, 'Advises')
        || extractSection(boundarySource, 'Advisory');
    if (advisesSection) boundaries.advisesOn = extractList(advisesSection);

    const staysOutSection = extractSection(boundarySource, 'Stays Out Of')
        || extractSection(boundarySource, 'Stays Out')
        || extractSection(boundarySource, 'No-Fly');
    if (staysOutSection) boundaries.staysOutOf = extractList(staysOutSection);

    const defersSection = extractSection(boundarySource, 'Defers To')
        || extractSection(boundarySource, 'Defers')
        || extractSection(boundarySource, 'Handoffs');
    if (defersSection) boundaries.defersTo = extractList(defersSection);

    const routeSection = extractSection(boundarySource, 'Route Elsewhere');
    if (routeSection) boundaries.routeElsewhere = extractList(routeSection);

    // ── Operational Protocol ──
    const protocolBlock = extractTopSection(content, 'Operational Protocol');
    const protocolSource = protocolBlock || content;

    const defaultBehavior = extractSection(protocolSource, 'Default Behavior')
        || extractSection(protocolSource, 'Behavior')
        || extractSection(protocolSource, 'Startup');
    if (defaultBehavior) operationalProtocol.defaultBehavior = defaultBehavior;

    const taskRouting = extractSection(protocolSource, 'Task Routing')
        || extractSection(protocolSource, 'Routing')
        || extractSection(protocolSource, 'Workflow');
    if (taskRouting) operationalProtocol.taskRouting = extractList(taskRouting);

    const toolPrefs = extractSection(protocolSource, 'Tool Preferences')
        || extractSection(protocolSource, 'Tool Usage')
        || extractSection(protocolSource, 'Tools');
    if (toolPrefs) operationalProtocol.toolPreferences = extractList(toolPrefs);

    const memoryRoutines = extractSection(protocolSource, 'Memory Routines')
        || extractSection(protocolSource, 'Memory Policy')
        || extractSection(protocolSource, 'Memory');
    if (memoryRoutines) operationalProtocol.memoryRoutines = extractList(memoryRoutines);

    const responseDiscipline = extractSection(protocolSource, 'Response Discipline')
        || extractSection(protocolSource, 'Output');
    if (responseDiscipline) operationalProtocol.responseDiscipline = responseDiscipline;

    const handoffBehavior = extractSection(protocolSource, 'Handoff Behavior')
        || extractSection(protocolSource, 'Handoff');
    if (handoffBehavior) operationalProtocol.handoffBehavior = handoffBehavior;

    const doctrineWhen = extractSection(protocolSource, 'When to Read Doctrine');
    if (doctrineWhen) operationalProtocol.whenToReadDoctrine = extractList(doctrineWhen);

    const formatting = extractSection(protocolSource, 'Formatting Habits')
        || extractSection(protocolSource, 'Formatting');
    if (formatting) operationalProtocol.formattingHabits = extractList(formatting);

    return { roleCharter, boundaries, operationalProtocol };
}

// ─── Doctrine File Parser ───────────────────────────────────────────────────

export function parseDoctrineMd(content: string): Partial<Doctrine> {
    if (!content) return {};

    const result: Partial<Doctrine> = {};

    const mission = extractSection(content, 'Mission');
    if (mission) result.mission = mission;

    const nonGoals = extractSection(content, 'Non-Goals') || extractSection(content, 'Non Goals')
        || extractSection(content, 'Anti-Goals');
    if (nonGoals) result.nonGoals = extractList(nonGoals);

    const frameworks = extractSection(content, 'Decision Frameworks')
        || extractSection(content, 'Frameworks');
    if (frameworks) result.decisionFrameworks = extractList(frameworks);

    const criteria = extractSection(content, 'Evaluation Criteria')
        || extractSection(content, 'Criteria');
    if (criteria) result.evaluationCriteria = extractList(criteria);

    const metrics = extractSection(content, 'Metrics');
    if (metrics) result.metrics = extractList(metrics);

    const deliverables = extractSection(content, 'Standard Deliverables')
        || extractSection(content, 'Deliverables');
    if (deliverables) result.standardDeliverables = extractList(deliverables);

    const antiPatterns = extractSection(content, 'Anti-Patterns')
        || extractSection(content, 'Anti Patterns');
    if (antiPatterns) result.antiPatterns = extractList(antiPatterns);

    const handoffs = extractSection(content, 'Handoff Rules')
        || extractSection(content, 'Handoffs');
    if (handoffs) result.handoffRules = extractList(handoffs);

    const good = extractSection(content, 'Good Judgment')
        || extractSection(content, 'Good Examples');
    const bad = extractSection(content, 'Bad Judgment')
        || extractSection(content, 'Bad Examples');
    if (good || bad) {
        result.examples = {
            good: good ? extractList(good) : [],
            bad: bad ? extractList(bad) : [],
        };
    }

    return result;
}

// ─── Memory File Parser ─────────────────────────────────────────────────────

export function parseMemoryMd(content: string): Partial<MemoryPolicy> {
    if (!content) return {};

    const result: Partial<MemoryPolicy> = {};

    const working = extractSection(content, 'Working Memory')
        || extractSection(content, 'Working');
    if (working) result.workingMemory = working;

    const journal = extractSection(content, 'Journal Layer')
        || extractSection(content, 'Journal');
    if (journal) result.journalLayer = journal;

    const longTerm = extractSection(content, 'Long-Term Core Facts')
        || extractSection(content, 'Long-Term')
        || extractSection(content, 'Core Facts');
    if (longTerm) result.longTermCoreFacts = longTerm;

    const remembered = extractSection(content, 'What Gets Remembered')
        || extractSection(content, 'Remember');
    if (remembered) result.whatGetsRemembered = extractList(remembered);

    const archived = extractSection(content, 'What Gets Archived')
        || extractSection(content, 'Archive');
    if (archived) result.whatGetsArchived = extractList(archived);

    const ignore = extractSection(content, 'What Should Not Be Stored')
        || extractSection(content, 'Should Not')
        || extractSection(content, 'Ignore');
    if (ignore) result.whatShouldNotBeStored = extractList(ignore);

    return result;
}

// ─── IDENTITY.md Parser ───────────────────────────────────────────────────────

export function parseIdentityMd(content: string): Partial<IdentityCard> {
    if (!content) return {};
    const result: Partial<IdentityCard> = {};

    // Bold labels
    const nameMatch = content.match(/\*\*Name[\s:]*\*\*[\s:]*(.+)/i);
    if (nameMatch) result.name = nameMatch[1].trim();

    const emojiMatch = content.match(/\*\*Emoji[\s:]*\*\*[\s:]*(.+)/i);
    if (emojiMatch) result.emoji = emojiMatch[1].trim();

    const roleMatch = content.match(/\*\*Role[\s:]*\*\*[\s:]*(.+)/i);
    if (roleMatch) result.role = roleMatch[1].trim();

    const codeMatch = content.match(/\*\*Codename[\s:]*\*\*[\s:]*(.+)/i);
    if (codeMatch) result.codename = codeMatch[1].trim();

    // Sections
    const oneLiner = extractSection(content, 'One-Liner')
        || extractSection(content, 'Summary')
        || extractSection(content, 'Tagline');
    if (oneLiner) result.oneLiner = oneLiner;

    const coreId = extractSection(content, 'Core Identity')
        || extractSection(content, 'Identity')
        || extractSection(content, 'Who I Am');
    if (coreId) result.coreIdentity = coreId;

    const style = extractSection(content, 'Operating Style')
        || extractSection(content, 'Style')
        || extractSection(content, 'Approach');
    if (style) result.operatingStyle = style;

    const team = extractSection(content, 'Relationship to Team')
        || extractSection(content, 'Team')
        || extractSection(content, 'Collaboration');
    if (team) result.teamRelationship = team;

    return result;
}

// ─── USER.md Parser ───────────────────────────────────────────────────────────

export function parseUserMd(content: string): Partial<UserContext> {
    if (!content) return {};
    const result: Partial<UserContext> = {};

    const who = extractSection(content, 'Who You Are')
        || extractSection(content, 'About')
        || extractSection(content, 'User')
        || extractSection(content, 'Profile');
    if (who) result.whoYouAre = who;

    const comm = extractSection(content, 'Communication Preferences')
        || extractSection(content, 'Communication')
        || extractSection(content, 'Preferences');
    if (comm) result.communicationPreferences = extractList(comm);

    const projects = extractSection(content, 'Projects')
        || extractSection(content, 'Active Projects')
        || extractSection(content, 'Work');
    if (projects) result.projects = extractList(projects);

    const env = extractSection(content, 'Environment')
        || extractSection(content, 'Setup')
        || extractSection(content, 'Tech Stack')
        || extractSection(content, 'Stack');
    if (env) result.environment = extractList(env);

    const tz = extractSection(content, 'Timezone & Availability')
        || extractSection(content, 'Timezone')
        || extractSection(content, 'Availability')
        || extractSection(content, 'Schedule');
    if (tz) result.timezone = tz;

    const priorities = extractSection(content, 'Priorities')
        || extractSection(content, 'Goals')
        || extractSection(content, 'Focus');
    if (priorities) result.priorities = extractList(priorities);

    const peeves = extractSection(content, 'Pet Peeves')
        || extractSection(content, "Don't")
        || extractSection(content, 'Avoid')
        || extractSection(content, 'Annoyances');
    if (peeves) result.petPeeves = extractList(peeves);

    return result;
}

// ─── TOOLS.md Parser ──────────────────────────────────────────────────────────

export function parseToolsMd(content: string): Partial<ToolGuide> {
    if (!content) return {};
    const result: Partial<ToolGuide> = {};

    const available = extractSection(content, 'Available Tools')
        || extractSection(content, 'Tools')
        || extractSection(content, 'Tool List');
    if (available) result.availableTools = extractList(available);

    const rules = extractSection(content, 'Tool Usage Rules')
        || extractSection(content, 'Usage Rules')
        || extractSection(content, 'Rules')
        || extractSection(content, 'Constraints');
    if (rules) result.usageRules = extractList(rules);

    const notes = extractSection(content, 'Tool-Specific Notes')
        || extractSection(content, 'Notes')
        || extractSection(content, 'Details');
    if (notes) result.specificNotes = notes;

    const browser = extractSection(content, 'Browser')
        || extractSection(content, 'Web')
        || extractSection(content, 'Web Research');
    if (browser) result.browserNotes = browser;

    const shell = extractSection(content, 'Shell')
        || extractSection(content, 'Terminal')
        || extractSection(content, 'Command Line')
        || extractSection(content, 'CLI');
    if (shell) result.shellNotes = shell;

    const mem = extractSection(content, 'Memory')
        || extractSection(content, 'Memory Tool')
        || extractSection(content, 'Persistence');
    if (mem) result.memoryNotes = mem;

    const forbidden = extractSection(content, 'Forbidden Tool Combinations')
        || extractSection(content, 'Forbidden')
        || extractSection(content, "Don't Combine");
    if (forbidden) result.forbidden = extractList(forbidden);

    const emergency = extractSection(content, 'Emergency Procedures')
        || extractSection(content, 'Emergency')
        || extractSection(content, 'Fallback')
        || extractSection(content, 'Error Handling');
    if (emergency) result.emergencyProcedures = emergency;

    return result;
}

// ─── HEARTBEAT.md Parser ───────────────────────────────────────────────────────

export function parseHeartbeatMd(content: string): Partial<Heartbeat> {
    if (!content) return {};
    const result: Partial<Heartbeat> = {};

    const interval = extractSection(content, 'Heartbeat Interval')
        || extractSection(content, 'Interval')
        || extractSection(content, 'Frequency')
        || extractSection(content, 'Schedule');
    if (interval) result.interval = interval;

    const startup = extractSection(content, 'Startup Checklist')
        || extractSection(content, 'Startup')
        || extractSection(content, 'Boot')
        || extractSection(content, 'Init');
    if (startup) result.startupChecklist = extractList(startup);

    const recurring = extractSection(content, 'Recurring Tasks')
        || extractSection(content, 'Tasks')
        || extractSection(content, 'Cron')
        || extractSection(content, 'Scheduled');
    if (recurring) result.recurringTasks = extractList(recurring);

    const health = extractSection(content, 'Health Checks')
        || extractSection(content, 'Health')
        || extractSection(content, 'Monitoring')
        || extractSection(content, 'Checks');
    if (health) result.healthChecks = extractList(health);

    const idle = extractSection(content, 'Idle Behavior')
        || extractSection(content, 'Idle')
        || extractSection(content, 'Standby')
        || extractSection(content, 'Waiting');
    if (idle) result.idleBehavior = idle;

    const shutdown = extractSection(content, 'Shutdown Routine')
        || extractSection(content, 'Shutdown')
        || extractSection(content, 'Teardown')
        || extractSection(content, 'Exit');
    if (shutdown) result.shutdownRoutine = extractList(shutdown);

    return result;
}

// ─── Master Parser ──────────────────────────────────────────────────────────

/**
 * Doctrine file names — these large files are loaded lazily, not during init.
 */
export const DOCTRINE_FILE_NAMES = ['FORGE.md', 'ORACLE.md', 'NEXUS.md', 'CONDUIT.md'];

/**
 * Special files that are NOT doctrine.
 */
export const SPECIAL_FILES = ['SOUL.md', 'AGENTS.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md', 'MEMORY.md', 'HEARTBEAT.md', 'COMPANION.md', 'SOUL_EXTENDED.md'];

/**
 * Parse ALL OpenClaw agent workspace files into structured AgentArchitecture.
 * Takes a map of filename → content.
 * Handles: SOUL.md, AGENTS.md, IDENTITY.md, USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md, + doctrine files
 *
 * @param skipDoctrine If true, skip parsing doctrine files (they'll be loaded lazily)
 */
export function parseAgentFiles(
    agentId: string,
    files: Record<string, string>,
    skipDoctrine: boolean = false
): Partial<AgentArchitecture> {
    const result: Partial<AgentArchitecture> = {};

    // 1. Parse SOUL.md → character layer
    const soulContent = files['SOUL.md'] || files['soul.md'] || '';
    if (soulContent) {
        result.characterLayer = {
            tone: '',
            worldview: '',
            personality: '',
            emotionalLogic: '',
            conversationalFingerprint: '',
            pacing: '',
            voiceMarkers: [],
            forbiddenHabits: [],
            ...parseSoulMd(soulContent),
        };
    }

    // 2. Parse AGENTS.md → role charter + boundaries + operational protocol
    const agentsContent = files['AGENTS.md'] || files['agents.md'] || '';
    if (agentsContent) {
        const parsed = parseAgentsMd(agentsContent);
        result.roleCharter = {
            title: '',
            codename: '',
            mission: '',
            scopeOfResponsibility: '',
            whyThisRoleExists: '',
            costOfWeakness: '',
            ...parsed.roleCharter,
        };
        result.boundaries = {
            owns: [],
            advisesOn: [],
            staysOutOf: [],
            defersTo: [],
            routeElsewhere: [],
            ...parsed.boundaries,
        };
        result.operationalProtocol = {
            defaultBehavior: '',
            taskRouting: [],
            whenToReadDoctrine: [],
            toolPreferences: [],
            formattingHabits: [],
            memoryRoutines: [],
            responseDiscipline: '',
            handoffBehavior: '',
            ...parsed.operationalProtocol,
        };
    }

    // 3. Parse IDENTITY.md → identity card
    const identityContent = files['IDENTITY.md'] || files['identity.md'] || '';
    if (identityContent) {
        result.identityCard = {
            name: '',
            emoji: '',
            role: '',
            codename: '',
            oneLiner: '',
            coreIdentity: '',
            operatingStyle: '',
            teamRelationship: '',
            ...parseIdentityMd(identityContent),
        };
    }

    // 4. Parse USER.md → user context
    const userContent = files['USER.md'] || files['user.md'] || '';
    if (userContent) {
        result.userContext = {
            whoYouAre: '',
            communicationPreferences: [],
            projects: [],
            environment: [],
            timezone: '',
            priorities: [],
            petPeeves: [],
            ...parseUserMd(userContent),
        };
    }

    // 5. Parse TOOLS.md → tool guide
    const toolsContent = files['TOOLS.md'] || files['tools.md'] || '';
    if (toolsContent) {
        result.toolGuide = {
            availableTools: [],
            usageRules: [],
            specificNotes: '',
            browserNotes: '',
            shellNotes: '',
            memoryNotes: '',
            forbidden: [],
            emergencyProcedures: '',
            ...parseToolsMd(toolsContent),
        };
    }

    // 6. Parse MEMORY.md → memory policy
    const memoryContent = files['MEMORY.md'] || files['memory.md'] || '';
    if (memoryContent) {
        result.memoryPolicy = {
            workingMemory: '',
            journalLayer: '',
            longTermCoreFacts: '',
            whatGetsRemembered: [],
            whatGetsArchived: [],
            whatShouldNotBeStored: [],
            ...parseMemoryMd(memoryContent),
        };
    }

    // 7. Parse HEARTBEAT.md → heartbeat/autonomy layer
    const heartbeatContent = files['HEARTBEAT.md'] || files['heartbeat.md'] || '';
    if (heartbeatContent) {
        result.heartbeat = {
            interval: '',
            startupChecklist: [],
            recurringTasks: [],
            healthChecks: [],
            idleBehavior: '',
            shutdownRoutine: [],
            ...parseHeartbeatMd(heartbeatContent),
        };
    }

    // 8. Parse doctrine files (any *.md not in the special files list)
    if (!skipDoctrine) {
        const allSpecial = [...SPECIAL_FILES, ...DOCTRINE_FILE_NAMES.map(n => n.toLowerCase())];
        const doctrineFileNames = Object.keys(files).filter(
            f => !allSpecial.map(n => n.toLowerCase()).includes(f.toLowerCase()) && f.endsWith('.md')
        );
        // Also include known doctrine files (FORGE.md, etc.)
        const knownDoctrineFiles = Object.keys(files).filter(
            f => DOCTRINE_FILE_NAMES.map(n => n.toLowerCase()).includes(f.toLowerCase())
        );
        const allDoctrineFiles = [...new Set([...doctrineFileNames, ...knownDoctrineFiles])];

        for (const docFile of allDoctrineFiles) {
            const docContent = files[docFile];
            if (docContent) {
                const parsed = parseDoctrineMd(docContent);
                if (Object.keys(parsed).length > 0) {
                    result.doctrine = {
                        mission: '',
                        nonGoals: [],
                        decisionFrameworks: [],
                        evaluationCriteria: [],
                        metrics: [],
                        standardDeliverables: [],
                        antiPatterns: [],
                        handoffRules: [],
                        examples: { good: [], bad: [] },
                        ...result.doctrine,
                        ...parsed,
                    };
                }
            }
        }
    }

    return result;
}

// ─── Build Score Auto-Calculator ────────────────────────────────────────────

export function calculateBuildScore(agent: AgentArchitecture): BuildScore {
    const score = (filled: number, total: number, max: number = 5): number => {
        if (total === 0) return 0;
        return Math.min(max, Math.round((filled / total) * max));
    };

    const hasContent = (s: string) => s.trim().length > 0;
    const listLen = (arr: string[]) => arr.filter(s => s.trim().length > 0).length;

    // A. Role Clarity
    const rc = agent.roleCharter;
    const roleFilled = [rc.mission, rc.scopeOfResponsibility, rc.whyThisRoleExists, rc.costOfWeakness]
        .filter(hasContent).length;
    const roleClarity = score(roleFilled, 4);

    // B. Doctrine Depth
    const d = agent.doctrine;
    const doctrineFilled = [
        hasContent(d.mission) ? 1 : 0,
        listLen(d.nonGoals) > 0 ? 1 : 0,
        listLen(d.decisionFrameworks) > 0 ? 1 : 0,
        listLen(d.metrics) > 0 ? 1 : 0,
        listLen(d.antiPatterns) > 0 ? 1 : 0,
        listLen(d.standardDeliverables) > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    const doctrineDepth = score(doctrineFilled, 6);

    // C. Operationalization
    const op = agent.operationalProtocol;
    const opFilled = [
        hasContent(op.defaultBehavior) ? 1 : 0,
        listLen(op.taskRouting) > 0 ? 1 : 0,
        listLen(op.toolPreferences) > 0 ? 1 : 0,
        hasContent(op.handoffBehavior) ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    const operationalization = score(opFilled, 4);

    // D. Procedural Capability
    const proceduralCapability = score(agent.playbooks.length, 3);

    // E. Memory Maturity
    const mp = agent.memoryPolicy;
    const memFilled = [
        hasContent(mp.workingMemory) ? 1 : 0,
        hasContent(mp.longTermCoreFacts) ? 1 : 0,
        listLen(mp.whatGetsRemembered) > 0 ? 1 : 0,
        listLen(mp.whatShouldNotBeStored) > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    const memoryMaturity = score(memFilled, 4);

    // F. Character Distinctness
    const cl = agent.characterLayer;
    const charFilled = [
        hasContent(cl.tone) ? 1 : 0,
        hasContent(cl.personality) ? 1 : 0,
        hasContent(cl.worldview) ? 1 : 0,
        listLen(cl.voiceMarkers) > 0 ? 1 : 0,
    ].reduce((a, b) => a + b, 0);
    const characterDistinctness = score(charFilled, 4);

    // G. Handoff Integrity
    const b = agent.boundaries;
    const handoffFilled = [
        listLen(b.owns) > 0 ? 1 : 0,
        listLen(b.staysOutOf) > 0 ? 1 : 0,
        listLen(b.defersTo) > 0 ? 1 : 0,
        listLen(d.handoffRules) > 0 ? 1 : 0,
    ].reduce((a, bb) => a + bb, 0);
    const handoffIntegrity = score(handoffFilled, 4);

    return {
        roleClarity,
        doctrineDepth,
        operationalization,
        proceduralCapability,
        memoryMaturity,
        characterDistinctness,
        handoffIntegrity,
    };
}
