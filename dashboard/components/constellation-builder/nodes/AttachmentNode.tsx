import React, { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileText, Link as LinkIcon, FileSpreadsheet, PlayCircle, UploadCloud, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AttachmentNode({ data }: any) {
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (saved || isSaving) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/constellation/save-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: data.title || "Untitled Attachment",
                    fileType: data.type,
                    content: data.content || data.url || "Empty Content",
                    sizeBytes: data.content?.length || 0
                })
            });
            const result = await res.json();
            if (result.success) {
                setSaved(true);
                toast.success("Document saved to storage.");
            } else {
                toast.error(result.error || "Failed to save document.");
            }
        } catch {
            toast.error("Error saving document.");
        } finally {
            setIsSaving(false);
        }
    };

    const renderIcon = () => {
        switch (data.type) {
            case "url":
                if (data.url?.includes("youtube.com") || data.url?.includes("youtu.be")) {
                    return <PlayCircle className="w-5 h-5 text-red-500" />;
                }
                return <LinkIcon className="w-5 h-5 text-blue-400" />;
            case "markdown":
            case "text":
                return <FileText className="w-5 h-5 text-indigo-400" />;
            case "spreadsheet":
            case "document":
                return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
            case "image":
                return null; // Images use thumbnails instead of icons
            default:
                return <FileText className="w-5 h-5 text-gray-400" />;
        }
    };

    const getThemeClasses = () => {
        switch (data.type) {
            case "image": return "border-border shadow-lg ring-1 ring-white/10 hover:ring-accent-base";
            case "url": return "border-blue-500/30 bg-blue-950/20 hover:border-blue-400";
            case "markdown": return "border-indigo-500/30 bg-indigo-950/20 hover:border-indigo-400";
            case "spreadsheet": return "border-green-500/30 bg-green-950/20 hover:border-green-400";
            default: return "border-border hover:border-accent-base";
        }
    };

    return (
        <div className={`backdrop-blur-md shadow-sm rounded-lg min-w-[200px] transition-colors group relative overflow-hidden bg-background/80 border ${getThemeClasses()}`}>
            
            {/* Image Thumbnail Header */}
            {data.type === "image" && data.imageUrl && (
                <div className="w-full h-24 bg-black/50 border-b border-white/5 relative flex items-center justify-center overflow-hidden">
                    <img src={data.imageUrl} alt={data.title} className="w-full h-full object-cover" />
                </div>
            )}

            <div className={`flex items-center gap-3 pr-8 ${data.type === 'image' ? 'p-2' : 'p-3'}`}>
                {data.type !== 'image' && (
                    <div className="p-2 bg-black/20 rounded-md shrink-0">
                        {renderIcon()}
                    </div>
                )}
                <div className="flex flex-col overflow-hidden w-[130px]">
                    <span className="text-sm font-medium text-foreground truncate">{data.title || "Untitled Attachment"}</span>
                    <span className="text-xs text-muted-foreground truncate">{data.summary || data.url || "Added just now"}</span>
                </div>
            </div>

            {/* Save to Storage Button */}
            {data.type !== 'url' && (
                <div className={`absolute right-2 ${data.type === 'image' ? 'bottom-2' : 'top-1/2 -translate-y-1/2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className={`h-7 w-7 rounded-md bg-black/40 backdrop-blur-sm ${saved ? 'text-emerald-400' : 'text-muted-foreground hover:bg-accent-base hover:text-black'}`}
                        onClick={handleSave}
                        disabled={isSaving || saved}
                        title={saved ? "Saved to Storage" : "Save to Storage"}
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                         saved ? <Check className="w-3.5 h-3.5" /> : 
                         <UploadCloud className="w-3.5 h-3.5" />}
                    </Button>
                </div>
            )}
        </div>
    );
}
