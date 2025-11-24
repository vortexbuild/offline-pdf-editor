import React, { useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Canvas, FabricImage } from 'fabric';
import { renderPageToCanvas } from '../utils/pdfUtils';

interface PageCanvasProps {
    page: pdfjsLib.PDFPageProxy;
    scale?: number;
    onCanvasReady?: (fabricCanvas: Canvas, pageIndex: number) => void;
    pageIndex: number;
}

export const PageCanvas: React.FC<PageCanvasProps> = ({
    page,
    scale = 1.5,
    onCanvasReady,
    pageIndex
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);

    useEffect(() => {
        const render = async () => {
            if (!canvasRef.current || !containerRef.current) return;

            // 1. Render PDF Page to the canvas
            await renderPageToCanvas(page, canvasRef.current, scale);

            // 2. Initialize Fabric.js canvas overlay
            // We need a separate canvas for fabric that sits on top, 
            // OR we can use the same canvas if we want to draw ON the PDF (but usually better to overlay)
            // Fabric.js wraps the canvas element.

            // Dispose previous instance if exists
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
            }

            // Create new Fabric canvas
            const newFabricCanvas = new Canvas(canvasRef.current, {
                height: canvasRef.current.height,
                width: canvasRef.current.width,
                selection: true,
            });

            // We need to set the background image to the PDF page rendering?
            // Actually, renderPageToCanvas draws on the canvas. 
            // Fabric.js will take that canvas and use it. 
            // However, if we want the PDF to be the background that doesn't get erased/moved,
            // we should probably set it as background image or just draw it once.
            // But Fabric's render loop might clear it.

            // Better approach:
            // 1. Create a canvas for PDF rendering (bgCanvas)
            // 2. Create a canvas for Fabric (fgCanvas) on top
            // OR
            // Let Fabric manage the canvas, and set the PDF page as the background image.

            // Let's try setting as background image.
            // We need to convert the rendered PDF page to a data URL or similar to set as background.
            // OR just render it to a temporary canvas and use that as background.

            // Let's try the overlay approach which is cleaner for "editing" (annotations on top).
            // But for this first pass, let's just see if we can get Fabric to work on top of the rendered PDF.
            // If I pass the canvas with content to `new fabric.Canvas`, Fabric might clear it.

            // Let's do this:
            // Render PDF to a temporary canvas.
            // Convert to data URL.
            // Set as Fabric background image.

            const tempCanvas = document.createElement('canvas');
            await renderPageToCanvas(page, tempCanvas, scale);
            const bgImage = tempCanvas.toDataURL();

            const img = await FabricImage.fromURL(bgImage);
            newFabricCanvas.backgroundImage = img;
            newFabricCanvas.requestRenderAll();

            fabricCanvasRef.current = newFabricCanvas;

            if (onCanvasReady) {
                onCanvasReady(newFabricCanvas, pageIndex);
            }
        };

        render();

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
                fabricCanvasRef.current = null;
            }
        };
    }, [page, scale, pageIndex]);

    return (
        <div className="page-canvas-container" ref={containerRef} style={{ marginBottom: '2rem', boxShadow: 'var(--shadow)' }}>
            <canvas ref={canvasRef} />
        </div>
    );
};
