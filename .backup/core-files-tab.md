# NERV.OS — Capabilities Page: Add "Core Files" Tab (Workspace File Editor)

**Target**: Add a third tab to the Capabilities page called "Core Files" that lets users browse and edit OpenClaw workspace markdown files (SOUL.md, AGENTS.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md, BOOTSTRAP.md, MEMORY.md) per agent — exactly like the OpenClaw Control UI's "Files" tab.

**Date**: March 22, 2026

---

## 0. Feasibility: CONFIRMED via Documentation

I verified in the OpenClaw source (DeepWiki analysis of `ui/src/ui/views/agents-panels-status-files.ts`) that the Gateway exposes three dedicated RPC methods for workspace file operations:

| RPC Method | Purpose | Params |
|---|---|---|
| `agents.files.list` | List all workspace files for a given agent | `{ agentId: string }` |
| `agents.files.read` | Read the content of a specific workspace file | `{ agentId: string, name: string }` |
| `agents.files.write` | Write/save content to a specific workspace file | `{ agentId: string, name: string, content: string }` |

The official OpenClaw Control UI uses these exact RPCs in its "Files" tab panel (source: `ui/src/ui/views/agents-panels-status-files.ts` lines 236–361). The response from `agents.files.list` returns an array of file objects, each containing `name` (string), `size` (number — bytes), and `modified` (number — unix timestamp in milliseconds).

This is a fully supported, first-party Gateway feature. No workarounds needed.

---

## 1. What to Change

### 1.1. Modify the Capabilities Page

The existing capabilities page at `/dashboard/capabilities/page.tsx` currently has two tabs:
1. "Per Agent"
2. "Global"

Add a **third tab**: "Core Files"

### 1.2. No New Database Tables

This feature reads/writes directly to the OpenClaw Gateway. No Supabase tables needed. No Drizzle schemas.

### 1.3. No New API Routes (Probably)

The capabilities page already communicates with the OpenClaw Gateway (either via direct WS or a proxy route created during the capabilities refactor). Reuse that same communication channel. Do NOT create a new API route unless the existing one cannot handle these RPC methods — but it should, since the proxy is generic (`method` + `params`).

---

## 2. Gateway RPC Details

### 2.1. `agents.files.list`

**Request:**
```json
{ "type": "req", "id": "<uuid>", "method": "agents.files.list", "params": { "agentId": "main" } }
```

**Response payload** — an array of file metadata objects:
```json
{
  "files": [
    { "name": "AGENTS.md", "size": 7800, "modified": 1740000000000 },
    { "name": "SOUL.md", "size": 1900, "modified": 1740000000000 },
    { "name": "TOOLS.md", "size": 961, "modified": 1740000000000 },
    { "name": "IDENTITY.md", "size": 727, "modified": 1740000000000 },
    { "name": "USER.md", "size": 537, "modified": 1740000000000 },
    { "name": "HEARTBEAT.md", "size": 152, "modified": 1740000000000 },
    { "name": "BOOTSTRAP.md", "size": 1700, "modified": 1740000000000 },
    { "name": "MEMORY.md", "size": 0, "modified": 1740000000000 }
  ]
}
```

The exact shape may vary — the `files` field might be at the top level of `payload` or nested. Parse defensively. Check if response is `payload.files` or `payload` directly being the array.

### 2.2. `agents.files.read`

**Request:**
```json
{ "type": "req", "id": "<uuid>", "method": "agents.files.read", "params": { "agentId": "main", "name": "SOUL.md" } }
```

**Response payload:**
```json
{
  "name": "SOUL.md",
  "path": "/data/.openclaw/workspace/SOUL.md",
  "content": "---\nsummary: \"Workspace template for SOUL.md\"\nread_when:\n  - Bootstrapping a workspace manually\n---\n\n# SOUL.md - Who You Are\n..."
}
```

The `content` field contains the full text of the markdown file. The `path` field is the absolute path on the Gateway host filesystem.

### 2.3. `agents.files.write`

**Request:**
```json
{ "type": "req", "id": "<uuid>", "method": "agents.files.write", "params": { "agentId": "main", "name": "SOUL.md", "content": "# SOUL.md - Who You Are\n\nYou are a helpful assistant..." } }
```

**Response payload:** Confirmation (likely `{ ok: true }` or similar). The file is written to disk on the Gateway host immediately.

**Important**: File writes take effect on the next agent session/turn. The agent reads workspace files at session start, not live. So the user won't see changes reflected until the agent starts a new turn or session.

---

## 3. Store Additions

### 3.1. Extend the Existing Capabilities Store

Add the following state and actions to `useOpenClawCapabilitiesStore` (the store created during the capabilities refactor). Do NOT create a separate store for this — it belongs with the capabilities page state.

```typescript
// Add to the existing store state:
interface CoreFilesState {
  // List of workspace files for the selected agent
  workspaceFiles: Array<{
    name: string;
    size: number;
    modified: number;  // unix timestamp ms
  }>;

  // The currently selected file name (e.g., "SOUL.md")
  selectedFileName: string | null;

  // The content of the currently selected file (from agents.files.read)
  selectedFileContent: string | null;

  // The absolute path of the currently selected file on the Gateway host
  selectedFilePath: string | null;

  // The draft content being edited (before saving)
  draftContent: string | null;

  // Whether the file content has been modified by the user
  isDirty: boolean;

  // Loading states
  isFilesLoading: boolean;
  isFileContentLoading: boolean;
  isFileSaving: boolean;
  fileError: string | null;
}

// Add to the existing store actions:
interface CoreFilesActions {
  fetchWorkspaceFiles: (agentId: string) => Promise<void>;
  selectFile: (agentId: string, fileName: string) => Promise<void>;
  updateDraft: (content: string) => void;
  saveFile: (agentId: string) => Promise<void>;
  resetDraft: () => void;
}
```

### 3.2. Action Implementations

**`fetchWorkspaceFiles(agentId)`:**
1. Set `isFilesLoading = true`.
2. Call `agents.files.list` with `{ agentId }`.
3. Parse the response and set `workspaceFiles`.
4. Set `isFilesLoading = false`.
5. If the response is empty or errors, set `fileError`.

**`selectFile(agentId, fileName)`:**
1. If `isDirty`, prompt the user to confirm abandoning changes (or auto-save — your choice, but the OpenClaw Control UI does NOT auto-save, it shows Reset/Save buttons).
2. Set `selectedFileName = fileName`, `isFileContentLoading = true`.
3. Call `agents.files.read` with `{ agentId, name: fileName }`.
4. Set `selectedFileContent = response.content`, `selectedFilePath = response.path`.
5. Set `draftContent = response.content` (initialize draft with current content).
6. Set `isDirty = false`, `isFileContentLoading = false`.

**`updateDraft(content)`:**
1. Set `draftContent = content`.
2. Set `isDirty = draftContent !== selectedFileContent`.

**`saveFile(agentId)`:**
1. If `!isDirty || !selectedFileName || draftContent === null`, return early.
2. Set `isFileSaving = true`.
3. Call `agents.files.write` with `{ agentId, name: selectedFileName, content: draftContent }`.
4. On success: set `selectedFileContent = draftContent`, `isDirty = false`, `isFileSaving = false`.
5. Show a success toast: "File saved."
6. Re-fetch the file list to update the `size` and `modified` metadata: call `fetchWorkspaceFiles(agentId)`.
7. On error: set `isFileSaving = false`, `fileError = errorMessage`. Show error toast.

**`resetDraft()`:**
1. Set `draftContent = selectedFileContent`.
2. Set `isDirty = false`.

---

## 4. UI Layout for the "Core Files" Tab

### 4.1. Tab Integration

The capabilities page already has a `TabSwitcher` component with "Per Agent" and "Global" tabs. Add a third tab: "Core Files".

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Per Agent    │ │   Global     │ │  Core Files  │
└──────────────┘ └──────────────┘ └──────────────┘
```

When the "Core Files" tab is active, the content area below shows the Core Files panel instead of the tools/skills columns.

### 4.2. Core Files Panel Layout

This layout matches the OpenClaw Control UI screenshot the user provided:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Core Files                                                [Refresh]   │
│  Bootstrap persona, identity, and tool guidance.                       │
│                                                                        │
│  [Agent Dropdown ▾] ← Select which agent's workspace to view          │
│                                                                        │
│  Workspace: /data/.openclaw/workspace                                  │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────────────────────────┐  │
│  │     FILE LIST         │  │          FILE EDITOR                  │  │
│  │                       │  │                                       │  │
│  │  ┌─────────────────┐ │  │  SOUL.md                              │  │
│  │  │ AGENTS.md       │ │  │  /data/.openclaw/workspace/SOUL.md    │  │
│  │  │ 7.8 KB · 19d ago│ │  │                                       │  │
│  │  └─────────────────┘ │  │  Content                              │  │
│  │  ┌─────────────────┐ │  │  ┌─────────────────────────────────┐  │  │
│  │  │ SOUL.md    ← sel│ │  │  │ ---                             │  │  │
│  │  │ 1.9 KB · 19d ago│ │  │  │ summary: "Workspace template   │  │  │
│  │  └─────────────────┘ │  │  │   for SOUL.md"                  │  │  │
│  │  ┌─────────────────┐ │  │  │ read_when:                      │  │  │
│  │  │ TOOLS.md        │ │  │  │   - Bootstrapping a workspace   │  │  │
│  │  │ 961 B · 19d ago │ │  │  │     manually                    │  │  │
│  │  └─────────────────┘ │  │  │ ---                             │  │  │
│  │  ┌─────────────────┐ │  │  │                                 │  │  │
│  │  │ IDENTITY.md     │ │  │  │ # SOUL.md - Who You Are         │  │  │
│  │  │ 727 B · 19d ago │ │  │  │ ...                             │  │  │
│  │  └─────────────────┘ │  │  └─────────────────────────────────┘  │  │
│  │  ┌─────────────────┐ │  │                                       │  │
│  │  │ USER.md         │ │  │               [Reset]  [Save]         │  │
│  │  │ 537 B · 19d ago │ │  │                                       │  │
│  │  └─────────────────┘ │  └────────────────────────────────────────┘  │
│  │  ┌─────────────────┐ │                                              │
│  │  │ HEARTBEAT.md    │ │                                              │
│  │  │ 152 B · 19d ago │ │                                              │
│  │  └─────────────────┘ │                                              │
│  │  ┌─────────────────┐ │                                              │
│  │  │ BOOTSTRAP.md    │ │                                              │
│  │  │ 1.7 KB · 19d ago│ │                                              │
│  │  └─────────────────┘ │                                              │
│  │  ┌─────────────────┐ │                                              │
│  │  │ MEMORY.md       │ │                                              │
│  │  │ 0 B · 19d ago   │ │                                              │
│  │  └─────────────────┘ │                                              │
│  └──────────────────────┘                                              │
│                                                                        │
│  ⚠ Changes are saved to the real OpenClaw workspace.                   │
│  They take effect on the agent's next session/turn.                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3. Component Tree

```
CoreFilesPanel (new component)
├─ CoreFilesHeader
│   ├─ Title: "Core Files"
│   ├─ Subtitle: "Bootstrap persona, identity, and tool guidance."
│   └─ Refresh button → calls fetchWorkspaceFiles(selectedAgentId)
├─ AgentSelector
│   └─ Dropdown populated from the store's agents list
│       └─ On change: fetchWorkspaceFiles(newAgentId)
├─ WorkspacePath
│   └─ Displays "Workspace: <path>" — read from the first file's path or from config
├─ CoreFilesContent (flex row, two columns)
│   ├─ FileList (left column, narrower ~35% width)
│   │   └─ FileListItem (repeated)
│   │       ├─ File name (e.g., "SOUL.md") — monospaced font
│   │       ├─ File size (formatted: "1.9 KB", "727 B", "7.8 KB")
│   │       ├─ Last modified (relative: "19d ago", "2h ago", "just now")
│   │       ├─ Active/selected state: highlighted with accent border (orange/red)
│   │       └─ Click handler: selectFile(agentId, fileName)
│   └─ FileEditor (right column, wider ~65% width)
│       ├─ FileEditorHeader
│       │   ├─ File name (bold, large)
│       │   └─ File path (muted, smaller — the absolute path on the Gateway host)
│       ├─ ContentLabel: "Content"
│       ├─ TextArea / CodeEditor
│       │   ├─ Contains draftContent
│       │   ├─ onChange: updateDraft(newContent)
│       │   ├─ Uses a monospaced font
│       │   ├─ Full height (fills available space, min-height ~300px)
│       │   ├─ Resizable vertically
│       │   └─ Syntax highlighting for markdown is nice-to-have but NOT required
│       └─ ActionButtons (right-aligned)
│           ├─ Reset button → resetDraft() — secondary/outline style
│           │   └─ Disabled when !isDirty
│           └─ Save button → saveFile(agentId) — primary/accent style (orange/red)
│               └─ Disabled when !isDirty, shows spinner when isFileSaving
└─ FooterNotice
    └─ "Changes are saved to the real OpenClaw workspace. They take effect on the agent's next session/turn."
```

### 4.4. Empty States

**No OpenClaw connection:**
- Show: "Connect to an OpenClaw Gateway to manage workspace files." with a link to connection settings.

**No agent selected:**
- Show: "Select an agent to view their workspace files."

**Agent selected but no files returned:**
- Show: "No workspace files found for this agent. The workspace may not be initialized."

**No file selected (file list loaded but nothing clicked yet):**
- The right column (editor) shows a placeholder: "Select a file from the list to view and edit its content."

**File content is empty (size = 0):**
- Show the editor with empty content. The user can type content and save it. This is valid — MEMORY.md starts empty.

---

## 5. Styling & Design

### 5.1. Match the OpenClaw Control UI Screenshot

Looking at the user's screenshot:
- **File list**: Dark card-like items with the file name in monospaced bold and size + age below it in muted text. The selected file has a red/orange left border or outline.
- **File editor**: A dark textarea/code-editor with the file name and path displayed above it. The content area has a slightly different background (darker or lighter than the card).
- **Reset button**: Outline/ghost style.
- **Save button**: Red/orange filled button (matches the NERV.OS accent color).

### 5.2. File Size Formatting

Format file sizes as human-readable:
```typescript
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

### 5.3. Relative Time Formatting

Format the `modified` timestamp as relative time:
```typescript
function formatRelativeTime(timestampMs: number): string {
  const now = Date.now();
  const diffMs = now - timestampMs;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}
```

### 5.4. Text Editor Component

Use a standard `<textarea>` with monospaced font. If the codebase already uses a code editor component (like CodeMirror or Monaco), use that instead for markdown syntax highlighting. But do NOT install a new heavy dependency just for this — a styled `<textarea>` is perfectly fine.

The textarea should:
- Use `font-family: monospace` (or the same monospaced font as the rest of the dashboard).
- Have a dark background matching the card theme.
- Have line numbers if easily achievable, but this is not required.
- Support tab-key insertion (pressing Tab inserts spaces/tab instead of moving focus). If this is too complex, skip it.

---

## 6. File Structure (New Files)

```
app/dashboard/capabilities/_components/
  CoreFilesPanel.tsx          ← Main panel component for the "Core Files" tab
  FileList.tsx                ← Left column: list of workspace files
  FileListItem.tsx            ← Single file item in the list
  FileEditor.tsx              ← Right column: file content viewer/editor
```

All of these are `"use client"` components.

---

## 7. Agent Dropdown Reuse

The "Core Files" tab needs an agent dropdown, just like the "Per Agent" tab. **Reuse the same `AgentSelector` component** that already exists in the capabilities page. Do NOT create a duplicate. The agent list comes from the same store (`agents` array populated by `config.get`).

When the user switches agents in the "Core Files" tab:
1. Call `fetchWorkspaceFiles(newAgentId)`.
2. Clear the selected file: `selectedFileName = null`, `selectedFileContent = null`, `draftContent = null`, `isDirty = false`.

When the user switches tabs (e.g., from "Per Agent" to "Core Files"):
- If the same agent was already selected in the "Per Agent" tab, keep it selected in "Core Files" too. Share the `selectedAgentId` state across tabs.

---

## 8. Unsaved Changes Guard

If the user has edited a file (`isDirty === true`) and then:
- Clicks a different file in the file list → Show a confirmation dialog: "You have unsaved changes to `<fileName>`. Discard changes?" with "Discard" and "Cancel" buttons.
- Switches to a different agent → Same confirmation dialog.
- Switches to a different tab ("Per Agent" or "Global") → Same confirmation dialog.
- Navigates away from the capabilities page entirely → Optionally use `beforeunload` browser event to warn, but this is a nice-to-have.

Use a shadcn `AlertDialog` for the confirmation.

---

## 9. Error Handling

1. **`agents.files.list` fails**: Show an error in the file list area: "Failed to load workspace files. Check the OpenClaw connection."
2. **`agents.files.read` fails**: Show an error in the editor area: "Failed to load file content." with a retry button.
3. **`agents.files.write` fails**: Show a toast: "Failed to save file: <error message>". Keep the editor open with the draft content so the user doesn't lose their work.
4. **File does not exist**: If `agents.files.read` returns an error for a file that was listed, it may have been deleted on the Gateway host. Show: "File not found. It may have been deleted or moved." and refresh the file list.
5. **No OpenClaw connection**: Disable the entire "Core Files" tab content and show the connection guard (same pattern as the tools/skills tabs).

---

## 10. Things You Must NOT Do

1. **Do NOT store file content in Supabase.** The OpenClaw Gateway filesystem is the source of truth. We are a thin editor client.
2. **Do NOT create a new WebSocket connection.** Reuse the existing one.
3. **Do NOT allow editing arbitrary file paths.** Only files returned by `agents.files.list` should be editable. Do not accept user-typed file paths — this would be a security risk.
4. **Do NOT auto-save.** The OpenClaw Control UI uses explicit Save/Reset buttons, and so should we. Auto-saving could accidentally overwrite files the user was just browsing.
5. **Do NOT create a file upload feature.** This tab is for editing existing workspace markdown files, not uploading new ones.
6. **Do NOT add or remove files.** The `agents.files.list` / `read` / `write` RPCs work with existing workspace files. File creation/deletion is not part of this feature — the user manages that via the OpenClaw CLI or filesystem. If `agents.files.write` can create new files, still do not expose a "New File" button — that is out of scope and could cause agent issues if the wrong file is created.
7. **Do NOT modify the "Per Agent" or "Global" tab implementations.** This is purely additive — a new third tab.

---

## 11. Verification Checklist

- [ ] The capabilities page now has three tabs: "Per Agent", "Global", "Core Files"
- [ ] Selecting "Core Files" shows the agent dropdown and file list
- [ ] The file list populates with files from the connected OpenClaw Gateway for the selected agent
- [ ] Each file shows its name, size (human-readable), and last modified (relative time)
- [ ] Clicking a file loads its content into the editor on the right
- [ ] Editing the content marks the file as dirty (Save button becomes active)
- [ ] Clicking "Save" sends the content to the Gateway via `agents.files.write` and the button shows a loading state
- [ ] Clicking "Reset" reverts the editor content to the original file content
- [ ] Switching files with unsaved changes shows a confirmation dialog
- [ ] Changes saved from NERV.OS are reflected when viewing the file in the OpenClaw Control UI (verify by opening `http://127.0.0.1:18789` → Agents → select agent → Files tab)
- [ ] The workspace path is displayed above the file list
- [ ] Error states are handled gracefully (no connection, failed reads, failed writes)
