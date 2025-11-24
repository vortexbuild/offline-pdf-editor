const DB_NAME = 'pdfEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

export interface StoredPDF {
    id?: number;
    name: string;
    data: ArrayBuffer;
    timestamp: number;
    editedData?: ArrayBuffer;
    canvasStates?: { [pageIndex: number]: any }; // Fabric.js canvas JSON for each page
}

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                objectStore.createIndex('name', 'name', { unique: false });
            }
        };
    });
};

export const savePDFToDB = async (pdf: Omit<StoredPDF, 'id'>): Promise<number> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(pdf);

        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
    });
};

export const updatePDFInDB = async (id: number, editedData: ArrayBuffer, canvasStates?: { [pageIndex: number]: any }): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const pdf = getRequest.result;
            if (pdf) {
                pdf.editedData = editedData;
                pdf.timestamp = Date.now();
                if (canvasStates) {
                    pdf.canvasStates = canvasStates;
                }
                const updateRequest = store.put(pdf);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                reject(new Error('PDF not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

export const getPDFFromDB = async (id: number): Promise<StoredPDF | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getAllPDFs = async (): Promise<StoredPDF[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        const request = index.openCursor(null, 'prev'); // Most recent first

        const pdfs: StoredPDF[] = [];
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor) {
                pdfs.push(cursor.value);
                cursor.continue();
            } else {
                resolve(pdfs.slice(0, 10)); // Return last 10
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const deletePDFFromDB = async (id: number): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const clearAllPDFs = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
