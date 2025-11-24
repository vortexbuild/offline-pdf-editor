import React, { useRef } from 'react';
import { Type, PenTool, Download, Trash2, Bold, Italic, Underline, Superscript, Subscript } from 'lucide-react';
import './Toolbar.css';

interface ToolbarProps {
    onAddText: () => void;
    onAddSignature: (file: File) => void;
    onSave: () => void;
    activeObject: any; // Using any for simplicity, ideally FabricObject
    onUpdateObject: (key: string, value: any) => void;
    onDeleteObject: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    onAddText,
    onAddSignature,
    onSave,
    activeObject,
    onUpdateObject,
    onDeleteObject
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

    // const isText = activeObject && (activeObject.type === 'i-text' || activeObject.type === 'text' || activeObject.type === 'textbox');

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
            <div className="toolbar-group">
                <select
                    className="toolbar-select"
                    value={activeObject?.fontFamily || 'Helvetica'}
                    onChange={(e) => onUpdateObject('fontFamily', e.target.value)}
                    title="Font Family"
                >
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier">Courier</option>
                </select>

                <input
                    type="number"
                    className="toolbar-input"
                    value={activeObject?.fontSize || 20}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                            onUpdateObject('fontSize', val);
                        }
                    }}
                    min={8}
                    max={72}
                    title="Font Size"
                />
                <input
                    type="color"
                    className="toolbar-color"
                    value={activeObject?.fill as string || '#000000'}
                    onChange={(e) => onUpdateObject('fill', e.target.value)}
                    title="Text Color"
                />

                <button
                    className={`btn btn-icon ${activeObject?.fontWeight === 'bold' ? 'active' : ''}`}
                    onClick={() => onUpdateObject('fontWeight', activeObject?.fontWeight === 'bold' ? 'normal' : 'bold')}
                    title="Bold"
                >
                    <Bold size={16} />
                </button>

                <button
                    className={`btn btn-icon ${activeObject?.fontStyle === 'italic' ? 'active' : ''}`}
                    onClick={() => onUpdateObject('fontStyle', activeObject?.fontStyle === 'italic' ? 'normal' : 'italic')}
                    title="Italic"
                >
                    <Italic size={16} />
                </button>

                <button
                    className={`btn btn-icon ${activeObject?.underline ? 'active' : ''}`}
                    onClick={() => onUpdateObject('underline', !activeObject?.underline)}
                    title="Underline"
                >
                    <Underline size={16} />
                </button>

                {/* Sub/Superscript - simplified as toggles that are mutually exclusive */}
                <button
                    className={`btn btn-icon ${activeObject?.script === 'super' ? 'active' : ''}`}
                    onClick={() => onUpdateObject('script', activeObject?.script === 'super' ? 'normal' : 'super')}
                    title="Superscript"
                >
                    <Superscript size={16} />
                </button>
                <button
                    className={`btn btn-icon ${activeObject?.script === 'sub' ? 'active' : ''}`}
                    onClick={() => onUpdateObject('script', activeObject?.script === 'sub' ? 'normal' : 'sub')}
                    title="Subscript"
                >
                    <Subscript size={16} />
                </button>
            </div>


            {activeObject && (
                <>
                    <div className="divider"></div>
                    <button className="btn btn-danger toolbar-btn-icon" onClick={onDeleteObject} title="Delete">
                        <Trash2 size={20} />
                    </button>
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
