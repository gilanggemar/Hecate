"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Plus, Trash2, Check, X, ChevronLeft, ChevronRight,
    BookOpen, Loader2,
} from "lucide-react";

/* ─── Types ─── */
interface KnowledgeDocument {
    id: string;
    file_name: string;
    file_type: string | null;
    content: string | null;
    text: string | null;
    source: string | null;
    source_type: string | null;
    author: string | null;
    published_at: string | null;
    credibility_tier: string | null;
}

interface PaginatedResponse {
    data: KnowledgeDocument[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

const COLUMNS: { key: keyof KnowledgeDocument; label: string; minW: string }[] = [
    { key: "file_name", label: "File Name", minW: "200px" },
    { key: "file_type", label: "Type", minW: "80px" },
    { key: "source", label: "Source", minW: "120px" },
    { key: "source_type", label: "Source Type", minW: "100px" },
    { key: "author", label: "Author", minW: "120px" },
    { key: "credibility_tier", label: "Credibility", minW: "100px" },
    { key: "content", label: "Content", minW: "260px" },
    { key: "text", label: "Text", minW: "260px" },
    { key: "published_at", label: "Published", minW: "120px" },
];

const PAGE_SIZES = [10, 20, 50, 100];

export default function KnowledgePage() {
    const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const editRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        searchTimer.current = setTimeout(() => setDebouncedSearch(search), 350);
        return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
    }, [search]);

    useEffect(() => { setPage(1); }, [debouncedSearch]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (debouncedSearch) params.set("search", debouncedSearch);
            const res = await fetch(`/api/knowledge-documents?${params}`);
            if (res.ok) {
                const json: PaginatedResponse = await res.json();
                setDocuments(json.data);
                setTotal(json.total);
                setTotalPages(json.totalPages);
            }
        } catch (e) {
            console.error("Fetch failed:", e);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, debouncedSearch]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDelete = async (id: string) => {
        try {
            await fetch(`/api/knowledge-documents?id=${id}`, { method: "DELETE" });
            setDeleteConfirm(null);
            fetchData();
        } catch (e) { console.error("Delete failed:", e); }
    };

    const handleEditSave = async () => {
        if (!editingCell) return;
        setSaving(true);
        try {
            await fetch("/api/knowledge-documents", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: editingCell.id, [editingCell.key]: editValue || null }),
            });
            setEditingCell(null);
            fetchData();
        } catch (e) { console.error("Edit failed:", e); }
        finally { setSaving(false); }
    };

    const startEdit = (doc: KnowledgeDocument, key: keyof KnowledgeDocument) => {
        setEditingCell({ id: doc.id, key });
        setEditValue((doc[key] as string) || "");
        setTimeout(() => editRef.current?.focus(), 50);
    };

    const cancelEdit = () => setEditingCell(null);
    const pageNumbers = getPageNumbers(page, totalPages);

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
            
            {/* ─── Top Bar: Search + Controls ─── */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingBottom: "16px" }}>
                {/* Search */}
                <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
                    <Search style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", width: "15px", height: "15px", color: "#666", pointerEvents: "none" }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search knowledge..."
                        style={{
                            width: "100%", height: "38px", paddingLeft: "40px", paddingRight: "14px",
                            fontSize: "13px", fontWeight: 400, letterSpacing: "-0.01em",
                            borderRadius: "10px", border: "1px solid #222", background: "#0c0c0c",
                            color: "#e0e0e0", outline: "none", transition: "border-color 0.2s",
                        }}
                        onFocus={(e) => e.target.style.borderColor = "#FF6A00"}
                        onBlur={(e) => e.target.style.borderColor = "#222"}
                    />
                </div>

                <div style={{ flex: 1 }} />

                {/* Page Size */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#777", fontWeight: 500 }}>Show</span>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        style={{
                            height: "34px", padding: "0 10px", fontSize: "12px", fontWeight: 600,
                            borderRadius: "8px", border: "1px solid #222", background: "#0c0c0c",
                            color: "#ccc", cursor: "pointer", outline: "none",
                        }}
                    >
                        {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                {/* Add Button */}
                <button
                    onClick={() => setAddDialogOpen(true)}
                    style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "0 16px", height: "36px", borderRadius: "10px",
                        fontSize: "12px", fontWeight: 700, letterSpacing: "0.02em",
                        background: "#FF6A00", color: "#000", border: "none", cursor: "pointer",
                        transition: "all 0.15s", textTransform: "uppercase",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#FF8220"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#FF6A00"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                    <Plus style={{ width: "13px", height: "13px" }} />
                    ADD
                </button>
            </div>

            {/* ─── Table ─── */}
            <div style={{
                flex: 1, minHeight: 0, overflow: "hidden",
                borderRadius: "12px", border: "1px solid #1a1a1a",
                background: "#080808",
            }}>
                <div style={{ overflow: "auto", height: "100%" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1300px" }}>
                        <thead>
                            <tr style={{ borderBottom: "1px solid #1a1a1a" }}>
                                {COLUMNS.map((col) => (
                                    <th
                                        key={col.key}
                                        style={{
                                            textAlign: "left", padding: "12px 16px",
                                            fontSize: "10px", fontWeight: 700,
                                            textTransform: "uppercase", letterSpacing: "0.1em",
                                            color: "#FF8C33", background: "#0e0e0e",
                                            minWidth: col.minW, whiteSpace: "nowrap",
                                            position: "sticky", top: 0, zIndex: 2,
                                        }}
                                    >
                                        {col.label}
                                    </th>
                                ))}
                                <th style={{
                                    textAlign: "center", padding: "12px 16px",
                                    fontSize: "10px", fontWeight: 700,
                                    textTransform: "uppercase", letterSpacing: "0.1em",
                                    color: "#FF8C33", background: "#0e0e0e",
                                    width: "70px", position: "sticky", top: 0, zIndex: 2,
                                }}>
                                    &nbsp;
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={COLUMNS.length + 1} style={{ textAlign: "center", padding: "80px 0" }}>
                                        <Loader2 style={{ width: "18px", height: "18px", margin: "0 auto", color: "#FF6A00", animation: "spin 1s linear infinite" }} />
                                        <p style={{ fontSize: "12px", color: "#555", marginTop: "10px" }}>Loading...</p>
                                    </td>
                                </tr>
                            ) : documents.length === 0 ? (
                                <tr>
                                    <td colSpan={COLUMNS.length + 1} style={{ textAlign: "center", padding: "80px 0" }}>
                                        <BookOpen style={{ width: "28px", height: "28px", margin: "0 auto", color: "#333" }} />
                                        <p style={{ fontSize: "13px", color: "#555", marginTop: "12px", fontWeight: 500 }}>No knowledge documents found</p>
                                        <p style={{ fontSize: "11px", color: "#444", marginTop: "4px" }}>Try adjusting your search or add new knowledge</p>
                                    </td>
                                </tr>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {documents.map((doc, i) => (
                                        <motion.tr
                                            key={doc.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ delay: i * 0.015 }}
                                            style={{ borderBottom: "1px solid #141414" }}
                                            className="knowledge-row"
                                        >
                                            {COLUMNS.map((col) => {
                                                const isEditing = editingCell?.id === doc.id && editingCell?.key === col.key;
                                                const cellValue = doc[col.key];
                                                const displayValue = col.key === "published_at" && cellValue
                                                    ? new Date(cellValue as string).toLocaleDateString()
                                                    : (cellValue as string) || "";

                                                return (
                                                    <td key={col.key} style={{ padding: "10px 16px", fontSize: "12px", color: "#bbb", maxWidth: col.minW, verticalAlign: "top" }}>
                                                        {isEditing ? (
                                                            <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
                                                                {(col.key === "content" || col.key === "text") ? (
                                                                    <textarea
                                                                        ref={editRef as any}
                                                                        value={editValue}
                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                        onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                                                                        rows={3}
                                                                        style={{
                                                                            flex: 1, fontSize: "12px", padding: "6px 8px",
                                                                            borderRadius: "6px", border: "1px solid #FF6A00",
                                                                            background: "#0a0a0a", color: "#ddd", outline: "none", resize: "vertical",
                                                                            fontFamily: "inherit",
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <input
                                                                        ref={editRef as any}
                                                                        value={editValue}
                                                                        onChange={(e) => setEditValue(e.target.value)}
                                                                        onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") cancelEdit(); }}
                                                                        style={{
                                                                            flex: 1, height: "28px", fontSize: "12px", padding: "0 8px",
                                                                            borderRadius: "6px", border: "1px solid #FF6A00",
                                                                            background: "#0a0a0a", color: "#ddd", outline: "none",
                                                                            fontFamily: "inherit",
                                                                        }}
                                                                    />
                                                                )}
                                                                <button onClick={handleEditSave} disabled={saving} style={{ padding: "4px", borderRadius: "4px", border: "none", background: "transparent", cursor: "pointer", color: "#FF6A00" }}>
                                                                    <Check style={{ width: "13px", height: "13px" }} />
                                                                </button>
                                                                <button onClick={cancelEdit} style={{ padding: "4px", borderRadius: "4px", border: "none", background: "transparent", cursor: "pointer", color: "#ff4444" }}>
                                                                    <X style={{ width: "13px", height: "13px" }} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => startEdit(doc, col.key)}
                                                                title={String(cellValue || "—")}
                                                                style={{
                                                                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                                    cursor: "pointer", padding: "2px 0",
                                                                    color: displayValue ? "#bbb" : "#333",
                                                                    fontStyle: displayValue ? "normal" : "italic",
                                                                }}
                                                                className="knowledge-cell"
                                                            >
                                                                {displayValue || "—"}
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td style={{ padding: "10px 16px", textAlign: "center", verticalAlign: "top" }}>
                                                {deleteConfirm === doc.id ? (
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                                                        <button onClick={() => handleDelete(doc.id)} style={{ padding: "4px", borderRadius: "4px", border: "none", background: "transparent", cursor: "pointer", color: "#ff4444" }}>
                                                            <Check style={{ width: "13px", height: "13px" }} />
                                                        </button>
                                                        <button onClick={() => setDeleteConfirm(null)} style={{ padding: "4px", borderRadius: "4px", border: "none", background: "transparent", cursor: "pointer", color: "#777" }}>
                                                            <X style={{ width: "13px", height: "13px" }} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirm(doc.id)}
                                                        className="knowledge-delete-btn"
                                                        style={{ padding: "5px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", color: "#333", transition: "color 0.15s" }}
                                                    >
                                                        <Trash2 style={{ width: "13px", height: "13px" }} />
                                                    </button>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Pagination ─── */}
            {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "14px" }}>
                    <span style={{ fontSize: "11px", color: "#666", fontWeight: 500 }}>
                        {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <PaginationBtn onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                            <ChevronLeft style={{ width: "14px", height: "14px" }} />
                        </PaginationBtn>
                        {pageNumbers.map((p, i) =>
                            p === "..." ? (
                                <span key={`e-${i}`} style={{ padding: "0 6px", fontSize: "11px", color: "#444" }}>…</span>
                            ) : (
                                <PaginationBtn key={p} onClick={() => setPage(p as number)} active={page === p}>
                                    {p}
                                </PaginationBtn>
                            )
                        )}
                        <PaginationBtn onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
                            <ChevronRight style={{ width: "14px", height: "14px" }} />
                        </PaginationBtn>
                    </div>
                </div>
            )}

            {/* ─── Add Dialog ─── */}
            <AnimatePresence>
                {addDialogOpen && <AddKnowledgeDialog onClose={() => setAddDialogOpen(false)} onAdded={() => { setAddDialogOpen(false); fetchData(); }} />}
            </AnimatePresence>

            {/* ─── Inline Styles ─── */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .knowledge-row:hover { background: #0f0f0f !important; }
                .knowledge-row:hover .knowledge-delete-btn { color: #ff4444 !important; }
                .knowledge-cell:hover { color: #FF8C33 !important; }
            `}</style>
        </div>
    );
}

/* ─── Pagination Button ─── */
function PaginationBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minWidth: "30px", height: "30px", padding: "0 4px",
                borderRadius: "8px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "12px", fontWeight: active ? 700 : 500,
                background: active ? "#FF6A00" : "transparent",
                color: active ? "#000" : disabled ? "#333" : "#888",
                opacity: disabled ? 0.4 : 1,
                transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={(e) => { if (!active && !disabled) e.currentTarget.style.background = "transparent"; }}
        >
            {children}
        </button>
    );
}

/* ─── Page Numbers ─── */
function getPageNumbers(current: number, total: number): (number | string)[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | string)[] = [1];
    if (current > 3) pages.push("...");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
}

/* ─── Add Knowledge Dialog ─── */
function AddKnowledgeDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
    const [form, setForm] = useState({
        file_name: "", file_type: "", content: "", text: "", source: "", source_type: "", author: "", credibility_tier: "",
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.file_name.trim()) return;
        setSaving(true);
        try {
            const res = await fetch("/api/knowledge-documents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) onAdded();
        } catch (e) { console.error("Add failed:", e); }
        finally { setSaving(false); }
    };

    const inputFields = [
        { key: "file_name", label: "File Name *" },
        { key: "file_type", label: "File Type" },
        { key: "source", label: "Source" },
        { key: "source_type", label: "Source Type" },
        { key: "author", label: "Author" },
        { key: "credibility_tier", label: "Credibility Tier" },
    ];
    const textareaFields = [
        { key: "content", label: "Content" },
        { key: "text", label: "Text" },
    ];

    const inputStyle: React.CSSProperties = {
        width: "100%", height: "36px", fontSize: "13px", padding: "0 12px",
        borderRadius: "8px", border: "1px solid #222", background: "#0a0a0a",
        color: "#ddd", outline: "none", fontFamily: "inherit",
    };
    const textareaStyle: React.CSSProperties = {
        ...inputStyle, height: "auto", padding: "10px 12px", resize: "vertical",
    };
    const labelStyle: React.CSSProperties = {
        display: "block", fontSize: "10px", fontWeight: 700, color: "#888",
        marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em",
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} />
            <motion.div
                initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: "relative", width: "100%", maxWidth: "480px", maxHeight: "85vh",
                    overflow: "auto", borderRadius: "16px", border: "1px solid #1a1a1a",
                    background: "#0c0c0c", padding: "28px", boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                    <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#eee", letterSpacing: "-0.02em" }}>Add Knowledge</h2>
                    <button onClick={onClose} style={{ padding: "6px", borderRadius: "6px", border: "none", background: "transparent", cursor: "pointer", color: "#666" }}>
                        <X style={{ width: "16px", height: "16px" }} />
                    </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                    {inputFields.map(({ key, label }) => (
                        <div key={key} style={key === "file_name" ? { gridColumn: "span 2" } : {}}>
                            <label style={labelStyle}>{label}</label>
                            <input
                                value={form[key as keyof typeof form]}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                style={inputStyle}
                                onFocus={(e) => e.target.style.borderColor = "#FF6A00"}
                                onBlur={(e) => e.target.style.borderColor = "#222"}
                            />
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "14px" }}>
                    {textareaFields.map(({ key, label }) => (
                        <div key={key}>
                            <label style={labelStyle}>{label}</label>
                            <textarea
                                value={form[key as keyof typeof form]}
                                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                                rows={3}
                                style={textareaStyle}
                                onFocus={(e) => e.target.style.borderColor = "#FF6A00"}
                                onBlur={(e) => e.target.style.borderColor = "#222"}
                            />
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                    <button onClick={onClose} style={{ padding: "0 16px", height: "34px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, border: "1px solid #222", background: "transparent", color: "#999", cursor: "pointer" }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !form.file_name.trim()}
                        style={{
                            padding: "0 20px", height: "34px", borderRadius: "8px",
                            fontSize: "12px", fontWeight: 700, border: "none",
                            background: !form.file_name.trim() ? "#333" : "#FF6A00",
                            color: !form.file_name.trim() ? "#666" : "#000",
                            cursor: !form.file_name.trim() ? "not-allowed" : "pointer",
                        }}
                    >
                        {saving ? "Saving..." : "Add"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
