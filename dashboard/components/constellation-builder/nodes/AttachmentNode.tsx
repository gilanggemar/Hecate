'use client';
// AttachmentNode.tsx — Deprecated. This node type is no longer used.
// Kept as a stub to prevent import errors from other parts of the codebase.

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

function AttachmentNodeComponent({ data }: NodeProps) {
    return (
        <div className="p-3 rounded-sm border border-white/10 bg-black/60 text-xs font-mono text-white/30">
            <Handle type="target" position={Position.Top} className="!bg-transparent !border-0" />
            <span>Legacy Attachment Node</span>
            <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0" />
        </div>
    );
}

export const AttachmentNode = memo(AttachmentNodeComponent);
export default AttachmentNode;
