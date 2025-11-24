import React, { useRef } from 'react';
import { Type, PenTool, Download } from 'lucide-react';
import './Toolbar.css';

interface ToolbarProps {
    onAddText: () => void;
    onAddSignature: (file: File) => void;
    onSave: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onAddText, onAddSignature, onSave }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSignatureClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onAddSignature(e.target.files[0]);
            e.target.value = ''; // Reset
        }
    };

    return (
        <div className="toolbar">
            <button className="btn btn-outline toolbar-btn" onClick={onAddText} title="Add Text">
                <Type size={20} />
                <span>Text</span>
            </button>

            <button className="btn btn-outline toolbar-btn" onClick={handleSignatureClick} title="Add Signature">
                <PenTool size={20} />
                <span>Signature</span>
            </button>
            <input
                type="file"
                ref={fileInputRef}
                accept="image/png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <div className="divider"></div>

            <button className="btn btn-primary toolbar-btn" onClick={onSave} title="Save PDF">
                <Download size={20} />
                <span>Save PDF</span>
            </button>
        </div>
    );
};
