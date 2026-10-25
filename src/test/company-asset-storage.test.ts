import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  storage: { bucket: "test-bucket" },
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  uploadBytes: vi.fn().mockResolvedValue(undefined),
  getDownloadURL: vi.fn().mockResolvedValue("https://storage.test/brand-image"),
}));

vi.mock("../mansa/services/firebase", () => firebaseMocks);

import {
  COMPANY_BRANDING_IMAGE_MAX_BYTES,
  uploadCompanyBrandingAsset,
  validateCompanyBrandingImage,
} from "../mansa/services/companyAssetStorage";

const makeImage = (size: number, name = "banner.png", type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  firebaseMocks.uploadBytes.mockResolvedValue(undefined);
  firebaseMocks.getDownloadURL.mockResolvedValue("https://storage.test/brand-image");
});

describe("company branding asset storage", () => {
  it("valide les fichiers et respecte la limite stricte des règles Storage", () => {
    expect(validateCompanyBrandingImage(makeImage(12))).toBeNull();
    expect(validateCompanyBrandingImage(makeImage(12, "text.txt", "text/plain"))).toBe(
      "Choisissez un fichier image.",
    );
    expect(validateCompanyBrandingImage(makeImage(COMPANY_BRANDING_IMAGE_MAX_BYTES))).toBe(
      "L’image doit faire moins de 5 Mo.",
    );
  });

  it("upload l'image avec le bon chemin et le type MIME, puis retourne son URL de téléchargement", async () => {
    const file = makeImage(12, "new-logo.png");

    await expect(uploadCompanyBrandingAsset("company-123", "logo", file)).resolves.toBe(
      "https://storage.test/brand-image",
    );

    expect(firebaseMocks.ref).toHaveBeenCalledWith(
      firebaseMocks.storage,
      expect.stringMatching(/^company-branding\/company-123\/logo-\d+-.*\.png$/),
    );
    const objectRef = firebaseMocks.ref.mock.results[0]!.value;
    expect(firebaseMocks.uploadBytes).toHaveBeenCalledWith(objectRef, file, {
      contentType: "image/png",
    });
    expect(firebaseMocks.getDownloadURL).toHaveBeenCalledWith(objectRef);
  });

  it("n'envoie pas les images refusées aux services Firebase", async () => {
    await expect(
      uploadCompanyBrandingAsset(
        "company-123",
        "banner",
        makeImage(COMPANY_BRANDING_IMAGE_MAX_BYTES),
      ),
    ).rejects.toThrow("L’image doit faire moins de 5 Mo.");
    expect(firebaseMocks.uploadBytes).not.toHaveBeenCalled();
  });
});
