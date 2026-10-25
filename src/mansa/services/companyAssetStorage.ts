import { getDownloadURL, ref, storage, uploadBytes } from "./firebase";

export type CompanyBrandingAsset = "banner" | "logo";

export async function uploadCompanyBrandingAsset(
  companyId: string,
  kind: CompanyBrandingAsset,
  file: File,
): Promise<string> {
  if (!companyId || !file) throw new Error("Choisissez une image valide.");
  if (!storage) {
    throw new Error(
      "Firebase Storage n’est pas configuré. Définissez VITE_FIREBASE_STORAGE_BUCKET puis déployez les règles Storage.",
    );
  }
  if (!file.type.startsWith("image/")) throw new Error("Le fichier doit être une image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("L’image ne doit pas dépasser 5 Mo.");

  const extension =
    file.name
      .split(".")
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, "") || "img";
  const objectPath = `company-branding/${encodeURIComponent(companyId)}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const objectRef = ref(storage, objectPath);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}
