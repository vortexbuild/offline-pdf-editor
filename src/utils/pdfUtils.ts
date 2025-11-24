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

            if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                const textObj = obj as IText; // Textbox shares similar interface for what we need
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

                const xPos = x;
                // Adjust Y for sub/super
                // For Textbox, we might have multiple lines.
                // Fabric's top is top-left. pdf-lib drawText y is bottom-left of the first line? No, it depends.
                // pdf-lib drawText y is the baseline of the text.
                // If we use drawText with multiple lines (newlines), y is the baseline of the first line?
                // Actually pdf-lib supports newlines.

                // However, Fabric's Textbox wrapping might not exactly match pdf-lib's wrapping if we just pass the text.
                // Fabric wraps based on width. pdf-lib drawText with maxWidth might work but font metrics differ.
                // Best approach: Use the lines Fabric calculated.

                // Fabric v6: textObj.textLines might be available or we can split textObj.text by newline if it's already wrapped?
                // Textbox in Fabric inserts newlines? Or just renders them?
                // textObj.text contains the full text.
                // If it's a Textbox, it might have soft wraps.
                // We can use `textObj.get('textLines')` or similar?
                // Actually, let's just trust pdf-lib to handle newlines if we pass them,
                // BUT Fabric's soft wraps are not in `text` property usually unless we use `dynamicMinWidth` etc?
                // Wait, Fabric's `text` property DOES NOT contain soft wraps.
                // We need to get the lines as rendered.
                // `textObj._textLines` is internal.
                // `textObj.getCheckSplitText()`?

                // Let's try a simpler approach first: Just pass the text and let pdf-lib handle it?
                // But pdf-lib doesn't auto-wrap unless we use a library or calculate it.
                // Fabric has already calculated the wrapping.
                // We can access `textObj._textLines` (2D array of chars) or `textObj.textLines` (array of strings)?
                // In Fabric 6, `textObj.getLines()` returns array of objects?

                // Let's look at `textObj._wrappedLines`?
                // Actually, for now, let's assume the user manually adds newlines or we accept that pdf-lib won't wrap exactly the same
                // UNLESS we pass the width to pdf-lib's drawText options?
                // pdf-lib `drawText` has `maxWidth` option.

                const width = (textObj.width || 0) * (textObj.scaleX || 1) / scale;

                // Calculate Y position.
                // Fabric top is top of the bounding box.
                // pdf-lib y is bottom of the text (baseline).
                // We need to account for height.
                // y_pdf = height - (top / scale) - (fontSize * lineCorrection?)
                // Let's stick to the previous approximation which worked for single line.
                // y_pdf = height - (top / scale) - (textObj.height * scaleY / scale) + (height correction?)
                // Actually, for multiline, pdf-lib draws from top-left if we don't specify? No, always bottom-left origin for page.
                // But `drawText` y is where the text starts.

                // Let's use `maxWidth` and `lineHeight`.
                const lineHeight = (textObj.lineHeight || 1.16) * finalFontSize;

                // Adjust Y. The previous formula:
                // y = height - (top/scale) - (objHeight/scale)
                // This assumes y is the bottom of the object.
                // But drawText y is the baseline of the FIRST line (or last? documentation says "y coordinate of the text").
                // Usually baseline.
                // If we have multiple lines, pdf-lib draws them downwards.
                // So we want y to be the baseline of the first line.
                // y = topY - fontSize; (approx)

                const pageHeight = page.getHeight();
                const topY = pageHeight - (top / scale); // Top of the text box in PDF coords

                // pdf-lib draws text starting at y and going up? No, y is baseline.
                // If we pass multiple lines, it draws downwards.
                // So we want y to be the baseline of the first line.
                // y = topY - fontSize; (approx)

                page.drawText(text, {
                    x: xPos,
                    y: topY - finalFontSize + yOffset, // Start from top, adjust for baseline and sub/super
                    size: finalFontSize,
                    font: pdfFont,
                    color: pdfColor,
                    maxWidth: width,
                    lineHeight: lineHeight,
                });

                // Underline handling (simplified for now, might not work perfectly with wrapping)
                if (textObj.underline) {
                    // We'd need to draw lines for each line of text.
                    // Skipping complex underline for wrapped text for now or implementing later.
                    page.drawLine({
                        start: { x: xPos, y: topY - finalFontSize - 2 + yOffset },
                        end: { x: xPos + width, y: topY - finalFontSize - 2 + yOffset },
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
