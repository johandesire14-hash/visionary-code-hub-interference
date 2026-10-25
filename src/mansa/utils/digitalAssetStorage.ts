const DATABASE_NAME = "mansa-digital-assets";
const DATABASE_VERSION = 1;
const ASSET_STORE = "assets";

export interface StoredDigitalAsset {
  storageKey: string;
  companyId: string;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
  blob: Blob;
}

function openAssetDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("Le stockage local des fichiers n’est pas disponible dans ce navigateur."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: "storageKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Impossible d’ouvrir le stockage des fichiers."));
    request.onblocked = () =>
      reject(new Error("Le stockage des fichiers est bloqué par un autre onglet."));
  });
}

export function createDigitalAssetKey(companyId: string, assetId: string): string {
  return `${encodeURIComponent(companyId)}:${encodeURIComponent(assetId)}`;
}

export async function saveDigitalAsset(
  companyId: string,
  assetId: string,
  file: Blob & { name?: string },
): Promise<StoredDigitalAsset> {
  if (!companyId || !assetId || !file)
    throw new Error("Les informations du fichier sont incomplètes.");
  const record: StoredDigitalAsset = {
    storageKey: createDigitalAssetKey(companyId, assetId),
    companyId,
    name: file.name || assetId,
    type: file.type || "application/octet-stream",
    size: file.size,
    updatedAt: new Date().toISOString(),
    blob: file,
  };
  const database = await openAssetDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ASSET_STORE, "readwrite");
      transaction.objectStore(ASSET_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("Le fichier n’a pas pu être enregistré."));
      transaction.onabort = () =>
        reject(transaction.error || new Error("L’enregistrement du fichier a été annulé."));
    });
  } finally {
    database.close();
  }
  return record;
}

export async function getDigitalAsset(storageKey: string): Promise<StoredDigitalAsset | null> {
  if (!storageKey) return null;
  const database = await openAssetDatabase();
  try {
    return await new Promise<StoredDigitalAsset | null>((resolve, reject) => {
      const request = database
        .transaction(ASSET_STORE, "readonly")
        .objectStore(ASSET_STORE)
        .get(storageKey);
      request.onsuccess = () => resolve((request.result as StoredDigitalAsset | undefined) || null);
      request.onerror = () =>
        reject(request.error || new Error("Impossible de lire le fichier enregistré."));
    });
  } finally {
    database.close();
  }
}

export async function downloadDigitalAsset(
  storageKey: string,
  downloadName?: string,
): Promise<void> {
  const asset = await getDigitalAsset(storageKey);
  if (!asset?.blob)
    throw new Error(
      "Le fichier original n’est pas disponible sur cet appareil. Demandez au créateur de le téléverser à nouveau.",
    );
  const objectUrl = URL.createObjectURL(asset.blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = downloadName || asset.name;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

export async function getDigitalAssetObjectUrl(storageKey: string): Promise<string> {
  const asset = await getDigitalAsset(storageKey);
  if (!asset?.blob)
    throw new Error(
      "La vidéo n’est pas disponible sur cet appareil. Demandez au créateur de la téléverser à nouveau.",
    );
  return URL.createObjectURL(asset.blob);
}
