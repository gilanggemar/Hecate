"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { MapPin } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function CheckpointNode(props: NodeProps) {
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.checkpoint}
            icon={<MapPin size={14} />}
        />
    );
}
