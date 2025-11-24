# Offline PDF Editor

A secure, offline-first PDF editor built with React, Vite, and Fabric.js. This application allows users to upload PDFs, add text annotations and signatures, and save the modified documents entirely within the browser—no data leaves your device.

## Features

-   **Offline Processing**: All PDF manipulation happens locally in your browser.
-   **PDF Rendering**: High-fidelity rendering using `pdfjs-dist`.
-   **Text Annotation**:
    -   Insert text boxes anywhere on the page.
    -   **Formatting**: Customize font size and color.
    -   Drag and drop positioning.
-   **Signature Support**:
    -   Upload PNG signatures (transparent backgrounds recommended).
    -   Resize and position signatures freely.
-   **Export**: Download the modified PDF with all annotations merged.

## Tech Stack

-   **Frontend**: React, TypeScript, Vite
-   **PDF Handling**: `pdfjs-dist` (rendering), `pdf-lib` (modification/saving)
-   **Canvas/Interaction**: `fabric` (v6)
-   **Styling**: Vanilla CSS

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/vortexbuild/offline-pdf-editor.git
    cd offline-pdf-editor
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Build for production**:
    ```bash
    npm run build
    ```

## Usage

1.  Open the application in your browser.
2.  Drag and drop a PDF file or click to select one.
3.  Select a page to edit.
4.  Use the toolbar to add **Text** or **Signatures**.
5.  Select text to change its **Font Size** or **Color**.
6.  Click **Save PDF** to download your changes.

## License

GNU GPLv3
