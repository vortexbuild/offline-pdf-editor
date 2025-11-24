import React, { useRef } from 'react';
import { Type, PenTool, Download } from 'lucide-react';
import './Toolbar.css';

interface ToolbarProps {
    onAddText: () => void;
    onAddSignature: (file: File) => void;
    onSave: () => void;
    activeObject: any; // Using any for simplicity, ideally FabricObject
    onUpdateObject: (key: string, value: any) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    onAddText,
    onAddSignature,
    onSave,
    activeObject,
    onUpdateObject
}) => {
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

    const isText = activeObject && (activeObject.type === 'i-text' || activeObject.type === 'text');

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

            {isText && (
                <>
                    <div className="divider"></div>
                    <div className="toolbar-group">
                        <input
                            type="number"
                            className="toolbar-input"
                            value={activeObject.fontSize || 20}
                            onChange={(e) => onUpdateObject('fontSize', parseInt(e.target.value))}
                            min={8}
                            max={72}
                            title="Font Size"
                        />
                        <input
                            type="color"
                            className="toolbar-color"
                            value={activeObject.fill as string || '#000000'}
                            onChange={(e) => onUpdateObject('fill', e.target.value)}
                            title="Text Color"
                        />
                    </div>
                </>
            )}

            <div className="divider"></div>

            <button className="btn btn-primary toolbar-btn" onClick={onSave} title="Save PDF">
                <Download size={20} />
                <span>Save PDF</span>
            </button>
        </div>
    );
};
