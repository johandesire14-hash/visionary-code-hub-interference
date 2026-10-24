import React, { useMemo, useState } from "react";
import { ChevronLeft, FileText, Plus, Upload } from "lucide-react";
import { saveProductPrivateContent, uploadProjectAsset } from "../../services/dbService";

interface FilesWorkspaceProps {
  creatorId: string;
  companyId: string;
  productIds: string[];
  products: any[];
  onBack: () => void;
}

type FileItem = {
  id: string;
  name: string;
  size: string;
  type: string;
  productIds: string[];
  updatedAt: string;
  downloadUrl?: string;
};

const formatSize = (bytes: number) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const FilesWorkspace: React.FC<FilesWorkspaceProps> = ({ creatorId, companyId, productIds, products, onBack }) => {
  const [screen, setScreen] = useState<"library" | "add">("library");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [files, setFiles] = useState<FileItem[]>(() => {
    const linked = products.filter((product) => productIds.includes(product.id));
    return linked.flatMap((product) => (product.digitalFiles || []).map((file: any) => ({
      id: file.id,
      name: file.name || file.title || "Fichier sans nom",
      size: file.size || "Taille inconnue",
      type: file.type || "application/octet-stream",
      productIds,
      updatedAt: file.updatedAt || new Date().toISOString(),
    })));
  });

  const linkedProductNames = useMemo(
    () => productIds.map((id) => products.find((product) => product.id === id)?.title || products.find((product) => product.id === id)?.name || "Offre sélectionnée"),
    [productIds, products],
  );

  const [isSaving, setIsSaving] = useState(false);

  const handleAddFile = async () => {
    const name = selectedFile?.name || fileName.trim();
    if (!name || !selectedFile || isSaving) return;
    setIsSaving(true);
    try {
      const downloadUrl = await uploadProjectAsset(selectedFile, `${creatorId}/${companyId}/files`);
      const newFile: FileItem = {
      id: `file-${Date.now()}`,
      name,
      size: selectedFile ? formatSize(selectedFile.size) : "Taille inconnue",
      type: selectedFile?.type || "application/octet-stream",
      productIds,
      updatedAt: new Date().toISOString(),
      downloadUrl,
      };
      const nextFiles = [...files, newFile];
      setFiles(nextFiles);

      const key = `mansa_creator_offers_${companyId}`;
      const savedOffers = JSON.parse(localStorage.getItem(key) || "[]");
      const sourceOffers = Array.isArray(savedOffers) && savedOffers.length ? savedOffers : products;
      const updatedOffers = sourceOffers.map((offer: any) => productIds.includes(offer.id)
        ? {
            ...offer,
            digitalFiles: [...(offer.digitalFiles || []), { ...newFile, isFreePreview: false }],
            ebooks: [...(offer.ebooks || []), { id: newFile.id, title: newFile.name, size: newFile.size }],
            includedApps: Array.from(new Set([...(offer.includedApps || []), "Fichiers"])),
          }
        : offer);
      localStorage.setItem(key, JSON.stringify(updatedOffers));
      localStorage.setItem(`mansa_creator_apps_${companyId}`, JSON.stringify([{
        appId: "files",
        productIds,
        files: nextFiles,
        updatedAt: new Date().toISOString(),
      }]));
      await Promise.all(productIds.map(async (productId) => {
        const product = products.find((item) => item.id === productId) || {};
        const existingFiles = product.digitalFiles || [];
        await saveProductPrivateContent(productId, creatorId, companyId, [...existingFiles, { ...newFile, isFreePreview: false }], product.courseModules || []);
      }));

      setFileName("");
      setSelectedFile(null);
      setScreen("library");
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-white">
          <ChevronLeft className="size-5" /> Retour aux applications
        </button>
        <span className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-blue-300">Fichiers</span>
      </div>

      {screen === "library" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Application Fichiers</div>
              <h1 className="mt-1 text-2xl font-bold text-white">Fichiers du produit</h1>
              <p className="mt-1 text-xs text-zinc-400">Gérez les ressources téléchargeables liées aux offres sélectionnées.</p>
            </div>
            <button type="button" onClick={() => setScreen("add")} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-colors hover:bg-blue-500">
              <Plus className="size-4" /> Ajouter un fichier
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {linkedProductNames.map((name, index) => <span key={`${name}-${index}`} className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-blue-300">Lié à {name}</span>)}
          </div>
          {files.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0c0d0e] px-6 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-500/10 text-3xl">📁</div>
              <h2 className="text-sm font-bold text-white">Aucun fichier ajouté</h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">Ajoutez un PDF, un ebook, un template, un logiciel ou une archive à distribuer avec cette offre.</p>
              <button type="button" onClick={() => setScreen("add")} className="mt-5 rounded-xl border border-blue-500/40 px-4 py-2 text-xs font-bold text-blue-300 transition-colors hover:bg-blue-500/10">Ajouter le premier fichier</button>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0c0d0e] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><FileText className="size-5" /></div><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{file.name}</div><div className="mt-1 text-[11px] text-zinc-500">{file.size} · {file.type || "Fichier"}</div></div></div>
                  {file.downloadUrl ? <a href={file.downloadUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20">Télécharger</a> : <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-300">En attente de stockage</span>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <button type="button" onClick={() => setScreen("library")} className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"><ChevronLeft className="size-4" /> Retour aux fichiers</button>
          <div><h1 className="text-2xl font-bold text-white">Ajouter un fichier</h1><p className="mt-1 text-xs text-zinc-400">Sélectionnez la ressource qui sera disponible après l’achat de l’offre.</p></div>
          <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-500/40 bg-blue-500/5 px-6 text-center transition-colors hover:bg-blue-500/10">
            <input type="file" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); if (file) setFileName(file.name); }} />
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300"><Upload className="size-6" /></div>
            <span className="text-sm font-bold text-white">Cliquez pour sélectionner un fichier</span>
            <span className="mt-1 text-[11px] text-zinc-500">PDF, ePub, ZIP, DOCX, MP3, logiciels et templates</span>
          </label>
          <label className="block space-y-1.5"><span className="text-xs font-semibold text-zinc-300">Nom du fichier</span><input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="Ex. Guide PDF premium" className="w-full rounded-xl border border-white/10 bg-[#0c0d0e] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500" /></label>
          {selectedFile && <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-300"><span className="truncate">✓ {selectedFile.name}</span><span className="ml-3 shrink-0 text-[10px]">{formatSize(selectedFile.size)}</span></div>}
          <div className="flex items-center justify-between border-t border-white/10 pt-4"><button type="button" onClick={() => setScreen("library")} className="rounded-xl px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white">Annuler</button><button type="button" disabled={!fileName.trim() || !selectedFile || isSaving} onClick={handleAddFile} className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">{isSaving ? "Enregistrement…" : "Ajouter le fichier"}</button></div>
        </div>
      )}
    </div>
  );
};
