import React, { useState, useEffect } from 'react';
import { Clock, FileText, Trash2 } from 'lucide-react';
import { getAllPDFs, deletePDFFromDB } from '../utils/dbUtils';
import type { StoredPDF } from '../utils/dbUtils';
import './RecentDocs.css';

interface RecentDocsProps {
    onLoadPDF: (pdfId: number) => void;
}

export const RecentDocs: React.FC<RecentDocsProps> = ({ onLoadPDF }) => {
    const [recentDocs, setRecentDocs] = useState<StoredPDF[]>([]);
    const [loading, setLoading] = useState(true);

    const loadDocs = async () => {
        try {
            const pdfs = await getAllPDFs();
            setRecentDocs(pdfs);
        } catch (error) {
            console.error('Error loading PDFs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocs();
    }, []);

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Delete this PDF from storage?')) {
            await deletePDFFromDB(id);
            loadDocs();
        }
    };

    if (loading) {
        return <div className="recent-docs-empty"><p>Loading...</p></div>;
    }

    if (recentDocs.length === 0) {
        return (
            <div className="recent-docs-empty">
                <Clock size={48} />
                <p>No recent documents</p>
                <span>Your recently edited PDFs will appear here</span>
            </div>
        );
    }

    return (
        <div className="recent-docs-list">
            {recentDocs.map((doc) => (
                <div key={doc.id} className="recent-doc-item" onClick={() => onLoadPDF(doc.id!)}>
                    <FileText size={24} />
                    <div className="recent-doc-info">
                        <span className="recent-doc-name">{doc.name}</span>
                        <div className="recent-doc-meta">
                            <span className="recent-doc-time">{formatDate(doc.timestamp)}</span>
                            <span className="recent-doc-size">{formatSize(doc.data.byteLength)}</span>
                        </div>
                    </div>
                    <button
                        className="recent-doc-delete"
                        onClick={(e) => handleDelete(e, doc.id!)}
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};

