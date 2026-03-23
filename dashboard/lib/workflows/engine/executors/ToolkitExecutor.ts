// ─── Toolkit Executor ────────────────────────────────────────────────────────
// Tool selection and dispatch. Uses OpenClaw Gateway tools catalog.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { ToolkitData } from '@/types/workflow-nodes';

export class ToolkitExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as ToolkitData;
    const { broadcaster } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      // Try to load tools from OpenClaw Gateway via the gateway's tools catalog.
      // If the gateway is not available (e.g., offline workflow), return an empty toolkit.
      let allTools: Array<{ name: string; description?: string; tools?: any }> = [];

      try {
        const { getGateway } = await import('@/lib/openclawGateway');
        const gw = getGateway();
        if (gw.isConnected) {
          const catalog = await gw.request('tools.catalog', { agentId: 'default' });
          const tools = catalog?.tools || (Array.isArray(catalog) ? catalog : []);
          allTools = (Array.isArray(tools) ? tools : []).map((t: any) => ({
            name: t.name || t.tool || '',
            description: t.description || t.desc || undefined,
            tools: t.tools || undefined,
          }));
        }
      } catch {
        // Gateway not available — workflow runs offline
      }

      const availableToolNames = allTools.map(t => t.name);

      // Filter to only the tools specified in the node config
      const selectedTools = data.availableTools?.length
        ? allTools.filter(t => data.availableTools.includes(t.name))
        : allTools;

      context.set(`toolkit_${node.id}`, {
        tools: selectedTools.map(t => ({
          name: t.name,
          description: t.description,
          tools: t.tools,
        })),
        selectionMode: data.toolSelectionMode,
      });

      context.addLog('info',
        `Toolkit loaded ${selectedTools.length} tools (mode: ${data.toolSelectionMode})`,
        node.id
      );

      return {
        status: 'success',
        output: {
          loadedTools: selectedTools.map(t => t.name),
          selectionMode: data.toolSelectionMode,
          availableInSystem: availableToolNames,
        },
      };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Toolkit failed' };
    }
  }
}
