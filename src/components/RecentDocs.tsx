import React, { useState, useEffect } from 'react';
import { Clock, FileText } from 'lucide-react';
import './RecentDocs.css';

interface RecentDoc {
    name: string;
    timestamp: number;
}

interface RecentDocsProps {
    onFileSelect: (file: File) => void;
}

export const RecentDocs: React.FC<RecentDocsProps> = ({ onFileSelect }) => {
    const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('recentDocs');
        if (stored) {
            setRecentDocs(JSON.parse(stored));
        }
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
            {recentDocs.map((doc, index) => (
                <div key={index} className="recent-doc-item">
                    <FileText size={24} />
                    <div className="recent-doc-info">
                        <span className="recent-doc-name">{doc.name}</span>
                        <span className="recent-doc-time">{formatDate(doc.timestamp)}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};
