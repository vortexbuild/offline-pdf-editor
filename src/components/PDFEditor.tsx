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
    const [originalFileName, setOriginalFileName] = useState<string>('document.pdf');
    const lastMousePos = React.useRef<{ x: number, y: number }>({ x: 100, y: 100 });

    // History Management
    const undoStack = React.useRef<{ pageIndex: number, json: any }[]>([]);
    const redoStack = React.useRef<{ pageIndex: number, json: any }[]>([]);

    const saveState = (pageIndex: number) => {
        const canvas = fabricCanvases[pageIndex];
        if (!canvas) return;

        const json = canvas.toObject(['id', 'selectable', 'lockUniScaling', 'lockScalingX', 'lockScalingY', 'script', 'fontFamily', 'fontSize', 'fill', 'fontWeight', 'fontStyle', 'underline']);
        undoStack.current.push({ pageIndex, json });
        redoStack.current = []; // Clear redo stack on new action
    };

    const handleUndo = () => {
        if (undoStack.current.length === 0) return;
        const lastState = undoStack.current.pop();
        if (!lastState) return;

        const canvas = fabricCanvases[lastState.pageIndex];
        if (!canvas) return;

        // Save current state to redo stack before undoing
        const currentJson = canvas.toObject(['id', 'selectable', 'lockUniScaling', 'lockScalingX', 'lockScalingY', 'script', 'fontFamily', 'fontSize', 'fill', 'fontWeight', 'fontStyle', 'underline']);
        redoStack.current.push({ pageIndex: lastState.pageIndex, json: currentJson });

        canvas.loadFromJSON(lastState.json, () => {
            canvas.requestRenderAll();
            // Re-bind events if necessary? Fabric usually handles this.
            // But we might lose active object selection
            setActiveObject(null);
        });
    };

    const handleRedo = () => {
        if (redoStack.current.length === 0) return;
        const nextState = redoStack.current.pop();
        if (!nextState) return;

        const canvas = fabricCanvases[nextState.pageIndex];
        if (!canvas) return;

        // Save current state to undo stack before redoing
        const currentJson = canvas.toObject(['id', 'selectable', 'lockUniScaling', 'lockScalingX', 'lockScalingY', 'script', 'fontFamily', 'fontSize', 'fill', 'fontWeight', 'fontStyle', 'underline']);
        undoStack.current.push({ pageIndex: nextState.pageIndex, json: currentJson });

        canvas.loadFromJSON(nextState.json, () => {
            canvas.requestRenderAll();
            setActiveObject(null);
        });
    };

    // Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                handleRedo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Only delete if canvas has active object
                const canvas = fabricCanvases[activePageIndex];
                if (canvas && canvas.getActiveObject()) {
                    handleDeleteObject();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fabricCanvases, activePageIndex]); // Re-bind when canvases change to ensure we have latest refs

    const handleFileSelect = async (file: File) => {
        try {
            setOriginalFileName(file.name);
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

        // Track mouse position
        canvas.on('mouse:move', (e) => {
            if (e.pointer) {
                lastMousePos.current = { x: e.pointer.x, y: e.pointer.y };
            }
        });

        // Capture state for history
        canvas.on('object:modified', () => {
            // We need to save state BEFORE modification? 
            // Actually, usually we save state on 'object:modified' which is AFTER.
            // But for undo, we need the state BEFORE.
            // Strategy: Save state on 'mouse:down' if target exists? Or 'object:moving'?
            // Better: Save state to undo stack *before* applying changes?
            // Standard way: 
            // 1. On 'object:modified', push the *previous* state? No, that's hard to track.
            // 2. Push current state to undo stack *before* making a change.
            // 3. When 'object:modified' fires, it means a change happened.

            // Let's try: Save state on 'mouse:down' if we hit an object?
            // But we don't know if it will be modified.

            // Alternative: Snapshot the whole page on every 'object:modified'.
            // Then Undo pops the previous snapshot.
            // But we need the snapshot *before* the modification.

            // Let's use 'before:transform' to capture state?
        });

        // Let's simplify: 
        // We need to save the state *before* a change happens.
        // For add/delete, we call saveState() manually before the action.
        // For modifications (drag/resize), we can hook into 'object:modified'.
        // But 'object:modified' is post-facto.
        // So we need to capture state when an object *starts* being modified.
        // 'object:modified' gives us the end result.
        // If we save state on 'object:modified', we are saving the *new* state.
        // That's wrong for Undo. Undo needs the *old* state.

        // Correct approach:
        // 1. On 'object:modified', we want to be able to go back.
        // So we should have saved the state *before* the modification started.
        // We can save state on 'mouse:down' or 'object:selected'? Too frequent.

        // Let's try this:
        // Keep a 'currentState' ref for the active page.
        // When 'object:modified' happens, push 'currentState' to undoStack, then update 'currentState'.
        // But we have multiple pages.

        // Let's just use a simple approach:
        // On 'object:modified', we assume the *previous* state is lost unless we saved it.
        // So we must save on 'before:transform' or similar?
        // Fabric has 'object:modified'.

        // Let's try saving state *before* we perform actions in our handlers (add/delete/update).
        // For drag/resize (canvas interactions), we need to hook into canvas events.

        // Let's use a temp variable to store state on 'mouse:down' or 'transform:start'?
        // 'before:transform' is good.

        canvas.on('before:transform', () => {
            saveState(pageIndex);
        });

        // Also need to handle 'text:editing:entered' -> save state?
        // 'text:changed' -> save state?

    }, []);

    const handleUpdateObject = (key: string, value: any) => {
        saveState(activePageIndex); // Save before update

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
        saveState(activePageIndex); // Save before delete
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
        saveState(activePageIndex); // Save before add
        const canvas = fabricCanvases[activePageIndex];
        if (!canvas) return;

        const text = new Textbox('Enter text', {
            left: lastMousePos.current.x,
            top: lastMousePos.current.y,
            fontFamily: 'Helvetica',
            fill: '#000000',
            fontSize: 14,
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
        saveState(activePageIndex); // Save before add
        const canvas = fabricCanvases[activePageIndex];
        if (!canvas) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (e.target?.result) {
                const img = await FabricImage.fromURL(e.target.result as string);
                img.set({
                    left: lastMousePos.current.x,
                    top: lastMousePos.current.y,
                    scaleX: 0.3,
                    scaleY: 0.3,
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
            link.download = originalFileName;
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
                        onClose={() => setPdfDocument(null)}
                    />
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
