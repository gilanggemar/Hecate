'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { usePromptChunkStore } from '@/store/usePromptChunkStore';
import { PromptChunkColorPicker } from './PromptChunkColorPicker';

export function PromptChunkDialog() {
    const { dialogOpen, closeDialog, editingChunk, createChunk, updateChunk, deleteChunk } = usePromptChunkStore();

    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [color, setColor] = useState('#6B7280');

    useEffect(() => {
        if (editingChunk) {
            setName(editingChunk.name);
            setContent(editingChunk.content);
            setColor(editingChunk.color);
        } else {
            setName('');
            setContent('');
            setColor('#6B7280');
        }
    }, [editingChunk, dialogOpen]);

    const handleSave = async () => {
        if (!name.trim() || !content.trim()) return;
        if (editingChunk) {
            await updateChunk(editingChunk.id, { name: name.trim(), content: content.trim(), color, category: editingChunk.category });
        } else {
            await createChunk({ name: name.trim(), content: content.trim(), color, category: 'Uncategorized' });
        }
    };

    const handleDelete = async () => {
        if (editingChunk) {
            await deleteChunk(editingChunk.id);
        }
    };

    return (
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
            <DialogContent
                className="sm:max-w-[440px]"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
                <DialogHeader>
                    <DialogTitle className="text-foreground">{editingChunk ? 'Edit Prompt Chunk' : 'Create Prompt Chunk'}</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4 mt-2">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value.slice(0, 30))}
                            placeholder="e.g., My Style Tags"
                            className="w-full h-9 rounded-md px-3 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-orange-500/50 transition-all"
                            style={{ background: 'color-mix(in srgb, var(--background) 60%, var(--card) 40%)', border: '1px solid var(--border)' }}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Content</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter the text this chunk will expand to..."
                            rows={4}
                            className="w-full rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-y focus:ring-1 focus:ring-orange-500/50 transition-all"
                            style={{ background: 'color-mix(in srgb, var(--background) 60%, var(--card) 40%)', border: '1px solid var(--border)' }}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Color</label>
                        <PromptChunkColorPicker color={color} onChange={setColor} />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <Button variant="ghost" onClick={closeDialog} className="text-muted-foreground">Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={!name.trim() || !content.trim()}
                            style={{ background: 'rgb(234, 120, 47)', color: '#fff' }}
                        >
                            Save
                        </Button>
                    </div>

                    {editingChunk && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors mt-1"
                        >
                            <Trash2 size={13} />
                            Delete this chunk
                        </button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
