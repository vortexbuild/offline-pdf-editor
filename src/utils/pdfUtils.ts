import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Canvas, IText, FabricImage } from 'fabric';

// Set worker source
// In a real production app, you might want to bundle the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const loadPDF = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    return loadingTask.promise;
};

export const renderPageToCanvas = async (
    page: pdfjsLib.PDFPageProxy,
    canvas: HTMLCanvasElement,
    scale: number = 1.5
) => {
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
        canvasContext: canvas.getContext('2d')!,
        viewport: viewport,
    } as any;

    await page.render(renderContext).promise;
};

export const savePDF = async (
    originalPdfBytes: ArrayBuffer,
    fabricCanvases: { [pageIndex: number]: Canvas },
    scale: number
) => {
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    for (let i = 0; i < pages.length; i++) {
        const canvas = fabricCanvases[i];
        if (!canvas) continue;

        const page = pages[i];
        const { height } = page.getSize();

        // Get all objects from fabric canvas
        const objects = canvas.getObjects();

        for (const obj of objects) {
            // Skip background image if it's the PDF page itself
            // In Fabric v6, background image is separate property usually, but getObjects() returns objects on canvas.
            // If we added text/images, they are in getObjects().

            const { left, top } = obj;

            // Convert coordinates
            // Fabric: (0,0) is top-left
            // PDF-lib: (0,0) is bottom-left

            // We need to handle scaling
            // The canvas was rendered at 'scale' (e.g. 1.5)
            // So 1 unit in fabric = 1/scale unit in PDF

            if (left === undefined || top === undefined) continue;

            const x = left / scale;
            // y in PDF is from bottom.
            // fabric top is from top.
            // y_pdf = page_height - (top / scale) - (height_of_object_in_pdf)
            // But it depends on the object type and how pdf-lib draws it.

            if (obj.type === 'i-text' || obj.type === 'text') {
                const textObj = obj as IText;
                const text = textObj.text;
                const fontSize = (textObj.fontSize || 16) * (textObj.scaleY || 1) / scale;
                const color = textObj.fill ? textObj.fill.toString() : '#000000';

                // pdf-lib drawText y is the baseline? No, it's usually bottom-left of the text box.
                // Fabric text top is top-left of the bounding box.
                // So y_pdf = height - (top / scale) - (fontSize?)
                // Actually, pdf-lib drawText y is the bottom of the text.
                // Let's approximate: y_pdf = height - (top / scale) - (objHeight * scaleY / scale)

                const pdfFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

                // Simple color parsing (assuming hex or simple name, defaulting to black)
                // For now just black or blue
                let pdfColor = rgb(0, 0, 0);
                if (color === 'red') pdfColor = rgb(1, 0, 0);
                if (color === 'blue') pdfColor = rgb(0, 0, 1);
                // TODO: Better color parsing

                page.drawText(text, {
                    x: x,
                    y: height - (top / scale) - (textObj.height! * (textObj.scaleY || 1) / scale), // Approximate
                    size: fontSize,
                    font: pdfFont,
                    color: pdfColor,
                });
            } else if (obj.type === 'image') {
                const imgObj = obj as FabricImage;
                const imgBytes = await (await fetch(imgObj.getSrc())).arrayBuffer();
                // Check if png or jpg
                const isPng = imgObj.getSrc().endsWith('.png') || imgObj.getSrc().startsWith('data:image/png');

                let pdfImage;
                try {
                    if (isPng) {
                        pdfImage = await pdfDoc.embedPng(imgBytes);
                    } else {
                        pdfImage = await pdfDoc.embedJpg(imgBytes);
                    }

                    const objWidth = (imgObj.width || 0) * (imgObj.scaleX || 1) / scale;
                    const objHeight = (imgObj.height || 0) * (imgObj.scaleY || 1) / scale;

                    page.drawImage(pdfImage, {
                        x: x,
                        y: height - (top / scale) - objHeight,
                        width: objWidth,
                        height: objHeight,
                    });
                } catch (e) {
                    console.error("Failed to embed image", e);
                }
            }
        }
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};
