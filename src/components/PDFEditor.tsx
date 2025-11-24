import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Canvas, FabricImage, Textbox } from 'fabric';
import { PDFUploader } from './PDFUploader';
import { PageCanvas } from './PageCanvas';
import { Toolbar } from './Toolbar';
import { loadPDF, savePDF } from '../utils/pdfUtils';
import './PDFEditor.css';

export const PDFEditor: React.FC = () => {
    const [pdfDocument, setPdfDocument] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [originalPdfBytes, setOriginalPdfBytes] = useState<ArrayBuffer | null>(null);
    const [pages, setPages] = useState<pdfjsLib.PDFPageProxy[]>([]);
    const [fabricCanvases, setFabricCanvases] = useState<{ [key: number]: Canvas }>({});
    const [activePageIndex, setActivePageIndex] = useState<number>(0);
    const [activeObject, setActiveObject] = useState<any>(null);

    const handleFileSelect = async (file: File) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            setOriginalPdfBytes(arrayBuffer);

            const pdf = await loadPDF(file);
            setPdfDocument(pdf);

            const loadedPages: pdfjsLib.PDFPageProxy[] = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                loadedPages.push(page);
            }
            setPages(loadedPages);
        } catch (error) {
            console.error("Error loading PDF:", error);
            alert("Failed to load PDF. Please try again.");
        }
    };

    const handleCanvasReady = React.useCallback((canvas: Canvas, pageIndex: number) => {
        setFabricCanvases(prev => ({
            ...prev,
            [pageIndex]: canvas
        }));

        // Add click listener to set active page
        canvas.on('mouse:down', () => {
            setActivePageIndex(pageIndex);
        });

        canvas.on('selection:created', (e) => {
            setActiveObject(e.selected ? e.selected[0] : null);
        });

        canvas.on('selection:updated', (e) => {
            setActiveObject(e.selected ? e.selected[0] : null);
        });

        canvas.on('selection:cleared', () => {
            setActiveObject(null);
        });
    }, []);

    const handleUpdateObject = (key: string, value: any) => {
        // Find the canvas that has an active object
        let canvas = fabricCanvases[activePageIndex];
        let activeObj = canvas?.getActiveObject();

        if (!activeObj) {
            // Fallback: search all canvases
            const foundIndex = Object.keys(fabricCanvases).find(index =>
                fabricCanvases[parseInt(index)].getActiveObject()
            );
            if (foundIndex) {
                canvas = fabricCanvases[parseInt(foundIndex)];
                activeObj = canvas.getActiveObject();
                setActivePageIndex(parseInt(foundIndex));
            }
        }

        if (!canvas || !activeObj) return;

        if (key === 'fontSize' && isNaN(value)) return;

        if (key === 'script') {
            // Handle sub/superscript logic
            // If value is 'super', set subscript to false/normal
            // We need to store this state. Fabric doesn't have native sub/super property on IText that renders automatically like HTML?
            // Actually Fabric supports subscript/superscript via setSelectionStyles if selecting text, 
            // or we can simulate it by changing fontSize and deltaY.
            // But for the whole object, we can just store a custom property and handle it in rendering/saving.
            // Let's just store it as a property on the object for now.

            if (value === 'super') {
                activeObj.set('subscript', false);
                activeObj.set('superscript', true);
            } else if (value === 'sub') {
                activeObj.set('superscript', false);
                activeObj.set('subscript', true);
            } else {
                activeObj.set('superscript', false);
                activeObj.set('subscript', false);
            }
            // Visual feedback in fabric? 
            // We might need to adjust fontSize/deltaY manually if we want WYSIWYG.
            // For simplicity, let's just rely on the property for PDF generation
            // OR we can actually use Fabric's support if we use setSelectionStyles but that's for selected text range.
            // Let's try to just set a custom property 'script' for now and maybe adjust fontSize visually?
            activeObj.set('script', value);
        } else {
            activeObj.set(key, value);
        }

        canvas.requestRenderAll();
        // Ensure type is preserved and merge with existing state to be safe
        setActiveObject((prev: any) => ({
            ...prev,
            ...activeObj.toObject(),
            script: (activeObj as any).script,
            type: activeObj.type // Explicitly ensure type is present
        }));
    };

    const handleDeleteObject = () => {
        const canvas = fabricCanvases[activePageIndex];
        if (!canvas) return;

        const activeObj = canvas.getActiveObject();
        if (!activeObj) return;

        canvas.remove(activeObj);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setActiveObject(null);
    };

    const handleAddText = () => {
        const canvas = fabricCanvases[activePageIndex];
        if (!canvas) return;

        const text = new Textbox('Enter text', {
            left: 100,
            top: 100,
            fontFamily: 'Inter',
            fill: '#000000',
            fontSize: 20,
            width: 200,
            splitByGrapheme: true,
            lockScalingY: true,
            lockScalingX: true,
        });

        text.setControlsVisibility({
            mt: false,
            mb: false,
            ml: true,
            mr: true,
            bl: false,
            br: false,
            tl: false,
            tr: false,
            mtr: true,
        });

        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.requestRenderAll();
    };

    const handleAddSignature = async (file: File) => {
        const canvas = fabricCanvases[activePageIndex];
        if (!canvas) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (e.target?.result) {
                const img = await FabricImage.fromURL(e.target.result as string);
                img.scaleToWidth(200);
                img.set({
                    left: 100,
                    top: 100,
                });
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!originalPdfBytes) return;

        try {
            const modifiedPdfBytes = await savePDF(originalPdfBytes, fabricCanvases, 1.5);
            const blob = new Blob([modifiedPdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'modified_document.pdf';
            link.click();
        } catch (error) {
            console.error("Error saving PDF:", error);
            alert("Failed to save PDF.");
        }
    };

    if (!pdfDocument) {
        return (
            <div className="container">
                <h1 className="app-title">Offline PDF Editor</h1>
                <PDFUploader onFileSelect={handleFileSelect} />
            </div>
        );
    }

    return (
        <div className="editor-container">
            <header className="editor-header">
                <div className="header-content">
                    <h1>Editing PDF</h1>
                    <Toolbar
                        onAddText={handleAddText}
                        onAddSignature={handleAddSignature}
                        onSave={handleSave}
                        activeObject={activeObject}
                        onUpdateObject={handleUpdateObject}
                        onDeleteObject={handleDeleteObject}
                    />
                    <button className="btn btn-outline" onClick={() => setPdfDocument(null)}>Close</button>
                </div>
            </header>

            <main className="editor-main">
                <div className="pages-list">
                    {pages.map((page, index) => (
                        <div
                            key={index}
                            onClick={() => setActivePageIndex(index)}
                            className={`page-wrapper ${activePageIndex === index ? 'active-page' : ''}`}
                        >
                            <PageCanvas
                                page={page}
                                pageIndex={index}
                                onCanvasReady={handleCanvasReady}
                            />
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};
