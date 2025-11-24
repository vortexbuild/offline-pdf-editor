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

                // Font selection logic
                let fontToEmbed = StandardFonts.Helvetica;
                const fontFamily = textObj.fontFamily;
                const isBold = textObj.fontWeight === 'bold';
                const isItalic = textObj.fontStyle === 'italic';

                if (fontFamily === 'Times New Roman') {
                    if (isBold && isItalic) fontToEmbed = StandardFonts.TimesRomanBoldItalic;
                    else if (isBold) fontToEmbed = StandardFonts.TimesRomanBold;
                    else if (isItalic) fontToEmbed = StandardFonts.TimesRomanItalic;
                    else fontToEmbed = StandardFonts.TimesRoman;
                } else if (fontFamily === 'Courier') {
                    if (isBold && isItalic) fontToEmbed = StandardFonts.CourierBoldOblique;
                    else if (isBold) fontToEmbed = StandardFonts.CourierBold;
                    else if (isItalic) fontToEmbed = StandardFonts.CourierOblique;
                    else fontToEmbed = StandardFonts.Courier;
                } else {
                    // Default to Helvetica
                    if (isBold && isItalic) fontToEmbed = StandardFonts.HelveticaBoldOblique;
                    else if (isBold) fontToEmbed = StandardFonts.HelveticaBold;
                    else if (isItalic) fontToEmbed = StandardFonts.HelveticaOblique;
                    else fontToEmbed = StandardFonts.Helvetica;
                }

                const pdfFont = await pdfDoc.embedFont(fontToEmbed);

                // Color parsing
                let pdfColor = rgb(0, 0, 0);
                if (color.startsWith('#')) {
                    const r = parseInt(color.slice(1, 3), 16) / 255;
                    const g = parseInt(color.slice(3, 5), 16) / 255;
                    const b = parseInt(color.slice(5, 7), 16) / 255;
                    pdfColor = rgb(r, g, b);
                } else if (color === 'red') pdfColor = rgb(1, 0, 0);
                else if (color === 'blue') pdfColor = rgb(0, 0, 1);

                // Sub/Superscript handling
                // We stored 'script' property on the object
                const script = (textObj as any).script;
                let yOffset = 0;
                let finalFontSize = fontSize;

                if (script === 'super') {
                    yOffset = fontSize * 0.4;
                    finalFontSize = fontSize * 0.6;
                } else if (script === 'sub') {
                    yOffset = -fontSize * 0.2;
                    finalFontSize = fontSize * 0.6;
                }

                const textWidth = pdfFont.widthOfTextAtSize(text, finalFontSize);

                const xPos = x;
                // Adjust Y for sub/super
                const yPos = height - (top / scale) - (textObj.height! * (textObj.scaleY || 1) / scale) + yOffset;

                page.drawText(text, {
                    x: xPos,
                    y: yPos,
                    size: finalFontSize,
                    font: pdfFont,
                    color: pdfColor,
                });

                // Underline handling
                if (textObj.underline) {
                    page.drawLine({
                        start: { x: xPos, y: yPos - 2 },
                        end: { x: xPos + textWidth, y: yPos - 2 },
                        thickness: 1,
                        color: pdfColor,
                    });
                }
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
