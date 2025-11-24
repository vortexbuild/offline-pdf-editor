import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Canvas, IText, FabricImage } from 'fabric';
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

    const handleCanvasReady = (canvas: Canvas, pageIndex: number) => {
        setFabricCanvases(prev => ({
            ...prev,
            [pageIndex]: canvas
        }));

        // Add click listener to set active page
        canvas.on('mouse:down', () => {
            setActivePageIndex(pageIndex);
        });
    };

    const handleAddText = () => {
        const canvas = fabricCanvases[activePageIndex];
        if (!canvas) return;

        const text = new IText('Enter text', {
            left: 100,
            top: 100,
            fontFamily: 'Inter',
            fill: '#000000',
            fontSize: 20,
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
