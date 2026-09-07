import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Upload, Camera, Images, Loader2, AlertCircle, LayoutGrid, Orbit, ChevronLeft, ChevronRight } from 'lucide-react';
import { isConfigured, uploadPhotoBase64, listPhotos, fetchPhotoBlob, genUUID, buildBlobUrl, UploadApiError } from './azure';
import SphereImageGrid, { type ImageData } from '@/src/components/ui/img-sphere';
import ImageLightbox from '@/src/components/ui/image-lightbox';

const hogwartsLogo = buildBlobUrl('static/Hogwarts_logo.jpg');
import PrivacyModal, { getStoredConsent, type ConsentData } from './PrivacyModal';

const WATERMARK_TEXT = 'Nicolas & Giulia · 12.09.2026';
const WATERMARK_ENABLED = import.meta.env.VITE_WATERMARK_ENABLED === 'true';

/** Server upload contract (function/PhotoUpload): accepted content types and size cap. */
const UPLOAD_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const UPLOAD_MAX_SIZE_BYTES = 10 * 1024 * 1024;
/** Longest-edge cap applied when re-encoding; bounds canvas memory on low-end phones. */
const NORMALIZE_MAX_EDGE = 2048;
/**
 * HEIC/HEIF family (incl. sequence variants): not server-accepted, but normalizePhoto
 * re-encodes them to JPEG, so they pass the Phase 3a type gate and are rescued.
 */
const CONVERTIBLE_HEIC_PATTERN = /^image\/hei[cf]/;

/** Minimum loaded photos before the 3D sphere view is offered; below this the grid is shown. */
const SPHERE_MIN_PHOTOS = 6;
const GRID_PAGE_SIZE = 12;

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function applyWatermark(imageBitmap: ImageBitmap): string {
  const canvas = document.createElement('canvas');
  canvas.width  = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(imageBitmap, 0, 0);

  const fontSize = Math.max(14, Math.min(28, imageBitmap.width / 24));
  ctx.font      = `${fontSize}px serif`;
  ctx.fillStyle = 'rgba(253,250,241,0.45)';
  ctx.strokeStyle = 'rgba(26,74,46,0.25)';
  ctx.lineWidth = 0.8;

  const diagLen = Math.sqrt(imageBitmap.width ** 2 + imageBitmap.height ** 2);
  const step    = fontSize * 6;

  ctx.save();
  ctx.translate(imageBitmap.width / 2, imageBitmap.height / 2);
  ctx.rotate(-Math.PI / 6);
  for (let x = -diagLen; x < diagLen; x += step) {
    for (let y = -diagLen; y < diagLen; y += step * 1.5) {
      ctx.fillText(WATERMARK_TEXT, x, y);
      ctx.strokeText(WATERMARK_TEXT, x, y);
    }
  }
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Normalize a picked photo to the server upload contract before upload.
 * Fast path: already an accepted type (jpeg/png/webp) within 10 MB → returned unchanged.
 * Otherwise (HEIC, oversized, other types): decode, downscale to ≤ 2048 px on the longest
 * edge (never upscale), flatten transparency onto white, and re-encode as JPEG.
 */
async function normalizePhoto(file: File): Promise<File> {
  if (UPLOAD_ALLOWED_TYPES.has(file.type) && file.size <= UPLOAD_MAX_SIZE_BYTES) {
    return file;
  }

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Impossibile leggere "${file.name}": formato immagine non supportato dal browser.`);
  }

  try {
    const scale = Math.min(1, NORMALIZE_MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d')!;
    // White background so transparent PNGs don't turn black when flattened into JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) {
      throw new Error(`Impossibile convertire "${file.name}" in JPEG.`);
    }
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally {
    bmp.close();
  }
}

interface GalleryItem {
  blobPath: string;
  dataUrl: string | null;
  loading: boolean;
  error: boolean;
}

/** Why a file was excluded from upload in handleFiles (Phase 3a validation). */
type ExclusionReason = 'format' | 'size';

/** Italian reason text used in the per-file exclusion part of the batch summary. */
const EXCLUSION_REASON_TEXT: Record<ExclusionReason, string> = {
  format: 'formato non supportato',
  size: 'supera i 10 MB anche dopo la compressione',
};

/**
 * Compose the post-batch summary line from exclusion counts and upload successes.
 * Examples: "1 foto esclusa (formato non supportato). Le altre 2 sono state caricate."
 *           "2 foto escluse (supera i 10 MB anche dopo la compressione)."
 *           "3 foto caricate." / "1 foto caricata."
 */
function buildBatchSummary(exclusions: { reason: ExclusionReason; count: number }[], successCount: number): string {
  const parts: string[] = [];

  for (const { reason, count } of exclusions) {
    parts.push(count === 1
      ? `1 foto esclusa (${EXCLUSION_REASON_TEXT[reason]})`
      : `${count} foto escluse (${EXCLUSION_REASON_TEXT[reason]})`);
  }

  if (successCount > 0) {
    if (exclusions.length === 0) {
      parts.push(successCount === 1 ? '1 foto caricata' : `${successCount} foto caricate`);
    } else if (successCount === 1) {
      parts.push('L\'altra è stata caricata');
    } else {
      parts.push(`Le altre ${successCount} sono state caricate`);
    }
  }

  return parts.length > 0 ? parts.join('. ') + '.' : '';
}

interface Props {
  onClose: () => void;
}

export default function PhotoAlbum({ onClose }: Props) {
  const configured = isConfigured();

  const [consent, setConsent]         = useState<ConsentData | null>(() => getStoredConsent());
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [gallery, setGallery]         = useState<GalleryItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError]     = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Phase 3b: per-run progress (X di Y), success line, retryable failures.
  const [uploadDone, setUploadDone]     = useState(0);
  const [uploadTotal, setUploadTotal]   = useState(0);
  const [successCount, setSuccessCount] = useState<number | null>(null); // null = hidden
  const [failedFiles, setFailedFiles]   = useState<File[]>([]);
  // Phase 3a: batch result line shown after the upload loop (exclusions + successes).
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  // Which upload button the guest tapped before the consent gate fired; used only
  // to render the post-consent nudge line (never to auto-click the input — P0-3b).
  const [pendingSource, setPendingSource] = useState<'camera' | 'library' | null>(null);
  // Phase 4a: the guest closed the consent modal without accepting. Shows the
  // declined-consent hint until consent is accepted (mutually exclusive with the
  // post-consent nudge, which requires consent to be set).
  const [declinedConsent, setDeclinedConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  // Phase 3b: auto-fade timer for the success line. Clears ONLY successCount —
  // it must never touch failedFiles (the retry line persists until resolved).
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [view, setView]           = useState<'grid' | 'sphere'>('grid');
  const [sphereSize, setSphereSize] = useState(0);
  const [gridPage, setGridPage]   = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Photos that finished loading + watermarking, ready to feed the sphere and lightbox.
  const loadedImages = useMemo<ImageData[]>(
    () =>
      gallery
        .filter((g) => g.dataUrl)
        .map((g) => ({ id: g.blobPath, src: g.dataUrl as string, alt: '' })),
    [gallery],
  );

  const openLightbox = useCallback((blobPath: string) => {
    const idx = loadedImages.findIndex((img) => img.id === blobPath);
    if (idx !== -1) setLightboxIndex(idx);
  }, [loadedImages]);

  const canShowSphere = loadedImages.length >= SPHERE_MIN_PHOTOS;
  // Fall back to grid if the sphere no longer has enough photos.
  const effectiveView = view === 'sphere' && canShowSphere ? 'sphere' : 'grid';

  // Grid pagination
  const pageCount = Math.ceil(gallery.length / GRID_PAGE_SIZE);
  const safePage = Math.min(gridPage, Math.max(0, pageCount - 1));
  const pagedGallery = gallery.slice(safePage * GRID_PAGE_SIZE, (safePage + 1) * GRID_PAGE_SIZE);

  // Keep the sphere sized to the available width (responsive, capped on desktop).
  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;
    const measure = () => setSphereSize(Math.min(el.clientWidth, 560));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadGallery = useCallback(async () => {
    if (!configured) return;
    setLoadingList(true);
    setListError(null);
    try {
      const names = await listPhotos();
      setGallery(names.map(n => ({ blobPath: n, dataUrl: null, loading: true, error: false })));
    } catch {
      setListError('Impossibile caricare la galleria. Riprova tra poco.');
    } finally {
      setLoadingList(false);
    }
  }, [configured]);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  // Phase 3b: clear any pending success-fade timer when the overlay unmounts.
  useEffect(() => () => {
    if (successTimerRef.current !== null) clearTimeout(successTimerRef.current);
  }, []);

  // Load each image blob → (optionally watermark) → dataUrl
  useEffect(() => {
    gallery.forEach((item, idx) => {
      if (item.dataUrl !== null || !item.loading || item.error) return;
      fetchPhotoBlob(item.blobPath)
        .then(blob =>
          WATERMARK_ENABLED
            ? createImageBitmap(blob).then(bmp => { const d = applyWatermark(bmp); bmp.close(); return d; })
            : toDataUrl(blob)
        )
        .then(dataUrl => {
          setGallery(prev => prev.map((g, i) => i === idx ? { ...g, dataUrl, loading: false } : g));
        })
        .catch(() => {
          setGallery(prev => prev.map((g, i) => i === idx ? { ...g, loading: false, error: true } : g));
        });
    });
  }, [gallery]);

  const requestFiles = (source: 'camera' | 'library') => {
    if (!consent) {
      setPendingSource(source);
      setShowPrivacy(true);
    } else {
      setPendingSource(null);
      (source === 'camera' ? cameraInputRef : fileInputRef).current?.click();
    }
  };

  const onPrivacyAccepted = (data: ConsentData) => {
    setConsent(data);
    setShowPrivacy(false);
    setDeclinedConsent(false); // Phase 4a: consent accepted — hide the declined hint
    // No .click() here: iOS WebKit consumes the transient user activation during
    // the awaited consent save, so a programmatic picker click would silently
    // fail (P0-3b). pendingSource stays set so the nudge line shows instead.
  };

  // Phase 4a: modal closed without acceptance (backdrop/X) while still
  // unconsented — explain the dead-end instead of leaving it silent.
  const onPrivacyClosed = () => {
    setShowPrivacy(false);
    if (!consent) setDeclinedConsent(true);
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.onerror = () => reject(new Error(`Lettura file fallita: ${file.name}`));
      reader.readAsDataURL(file);
    });

  const clearSuccessTimer = () => {
    if (successTimerRef.current !== null) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  };

  const armSuccessTimer = () => {
    clearSuccessTimer();
    successTimerRef.current = setTimeout(() => {
      successTimerRef.current = null;
      setSuccessCount(null); // fades the line via AnimatePresence exit; failedFiles untouched
    }, 5000);
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return; // cancelled picker: NOT a new selection — keep prior results
    setUploading(true);
    // Phase 3b: reset ALL result state on every new selection.
    setUploadError(null);
    setUploadDone(0);
    setUploadTotal(files.length);
    setBatchSummary(null);
    setSuccessCount(null);
    clearSuccessTimer();
    setFailedFiles([]);
    setPendingSource(null);

    // Phase 3a: per-reason exclusion counts, composed into a summary after the loop.
    const excluded: { reason: ExclusionReason; count: number }[] = [];
    const countExclusion = (reason: ExclusionReason) => {
      const entry = excluded.find((x) => x.reason === reason);
      if (entry) entry.count++;
      else excluded.push({ reason, count: 1 });
    };

    let done = 0;
    const failed: File[] = [];
    for (const file of files) {
      // Type gate on the ORIGINAL file: anything outside {jpeg, png, webp} that
      // normalizePhoto cannot rescue (only HEIC is convertible) would be rejected
      // by the server — exclude it up front, keep the batch going.
      if (!UPLOAD_ALLOWED_TYPES.has(file.type) && !CONVERTIBLE_HEIC_PATTERN.test(file.type)) {
        countExclusion('format');
        continue;
      }

      let up: File;
      try {
        up = await normalizePhoto(file);
      } catch (err) {
        // Decode/normalize failure (e.g. HEIC on Chrome desktop): the server would
        // reject the file anyway — exclude it with a clear reason, keep the batch going.
        countExclusion('format');
        setUploadError(err instanceof Error ? err.message : `Impossibile leggere "${file.name}".`);
        continue;
      }

      // Size gate on the NORMALIZED file: oversized originals were downscaled by
      // Phase 1, so only files still over the cap after compression are excluded.
      if (up.size > UPLOAD_MAX_SIZE_BYTES) {
        countExclusion('size');
        continue;
      }

      try {
        const id = genUUID();
        const base64 = await readFileAsBase64(up);
        await uploadPhotoBase64(base64, up.name, up.type, id);
        done++;
        setUploadDone(done);
      } catch (err) {
        // Phase 3b: collect the NORMALIZED file for retry — it already passed all
        // gates, so retry must not re-run normalizePhoto or the exclusion gates.
        failed.push(up);
        // Server rejections (UploadApiError) carry the server's Italian message
        // verbatim; other failures fall back to the generic connection hint.
        setUploadError(err instanceof UploadApiError
          ? err.message
          : `Errore nel caricamento di "${file.name}". Verifica la connessione e riprova.`);
      }
    }

    // Batch summary: exclusions + successes, e.g. "1 foto esclusa (formato non
    // supportato). Le altre 2 sono state caricate." Never blocks valid files.
    const summary = buildBatchSummary(excluded, done);
    if (summary) setBatchSummary(summary);

    // Phase 3b: success line (auto-fades ~5 s) + retryable-failure list.
    // The timer clears ONLY successCount, never failedFiles.
    if (done > 0) {
      setSuccessCount(done);
      armSuccessTimer();
    }
    setFailedFiles(failed);

    setUploading(false);
    e.target.value = '';
    await loadGallery();
  };

  // Phase 3b: re-run the upload loop over exactly failedFiles. They already passed
  // the type gate, normalizePhoto, and the size gate in handleFiles, so this loop
  // has NO gates and NO normalizePhoto. Iterating only the failures guarantees
  // succeeded files are never uploaded twice.
  const retryFailed = async (): Promise<void> => {
    if (uploading || failedFiles.length === 0) return;
    const batch = failedFiles; // snapshot BEFORE clearing state (setState is async)
    setUploading(true);
    setUploadError(null);
    setUploadDone(0);
    setUploadTotal(batch.length);
    setBatchSummary(null);
    setSuccessCount(null);
    clearSuccessTimer();
    setFailedFiles([]); // hides the retry line during the run; repopulated below

    let done = 0;
    const stillFailed: File[] = [];
    for (const up of batch) {
      try {
        const id = genUUID();
        const base64 = await readFileAsBase64(up);
        await uploadPhotoBase64(base64, up.name, up.type, id);
        done++;
        setUploadDone(done);
      } catch (err) {
        stillFailed.push(up);
        setUploadError(err instanceof UploadApiError
          ? err.message
          : `Errore nel caricamento di "${up.name}". Verifica la connessione e riprova.`);
      }
    }

    if (done > 0) {
      setSuccessCount(done);
      armSuccessTimer();
    }
    setFailedFiles(stillFailed); // merge: only files that failed AGAIN stay retryable

    setUploading(false);
    await loadGallery();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ duration: 0.5, type: 'spring', bounce: 0.18 }}
        className="fixed inset-0 z-[150] paper-surface overflow-y-auto text-[#1a4a2e] flex flex-col"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Back button */}
        <button
          onClick={onClose}
          className="absolute top-6 left-6 sm:top-10 sm:left-10 flex items-center gap-2 text-[#1a4a2e]/60 hover:text-[#1a4a2e] transition-colors font-cinzel text-xs uppercase tracking-widest z-[160]"
          aria-label="Chiudi album"
        >
          <ArrowLeft size={18} />
          <span className="hidden sm:inline">Indietro</span>
        </button>

        {/* Header */}
        <div className="flex flex-col items-center pt-16 pb-6 px-6 shrink-0">
          <img
            src={hogwartsLogo}
            alt="Hogwarts"
            className="w-16 sm:w-20 h-auto mb-4 object-contain mix-blend-multiply"
            draggable={false}
          />
          <h1 className="font-cinzel text-xl sm:text-2xl uppercase tracking-[0.25em] font-bold text-center">
            Album della Magia
          </h1>
          <p className="font-body text-sm text-[#1a4a2e]/70 mt-2 text-center">
            I ricordi magici di Nicolas &amp; Giulia · 12 settembre 2026
          </p>
          <div className="w-32 h-px bg-[#d4af37] mt-4" />
        </div>

        {/* Upload area */}
        <div className="flex flex-col items-center px-6 pb-6 shrink-0">
          {!configured ? (
            <div className="flex items-center gap-2 text-[#8b1a1a]/80 font-body text-sm bg-[#8b1a1a]/10 border border-[#8b1a1a]/20 rounded-sm px-4 py-3 max-w-md text-center">
              <AlertCircle size={16} className="shrink-0" />
              <span>La galleria non è ancora configurata. Torna a breve!</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button
                  onClick={() => requestFiles('camera')}
                  disabled={uploading}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] hover:-translate-y-0.5 transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(26,74,46,0.3)]"
                >
                  {uploading
                    ? <Loader2 size={18} className="text-[#d4af37] animate-spin" />
                    : <Camera size={18} className="text-[#d4af37]" />
                  }
                  <span>{uploading ? `Caricamento… ${uploadDone} di ${uploadTotal}` : 'Scatta una foto'}</span>
                </button>
                <button
                  onClick={() => requestFiles('library')}
                  disabled={uploading}
                  className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] hover:-translate-y-0.5 transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(26,74,46,0.3)]"
                >
                  {uploading
                    ? <Loader2 size={18} className="text-[#d4af37] animate-spin" />
                    : <Upload size={18} className="text-[#d4af37]" />
                  }
                  <span>{uploading ? `Caricamento… ${uploadDone} di ${uploadTotal}` : 'Carica le tue foto'}</span>
                </button>
              </div>
              {pendingSource && consent && (
                <p className="text-xs text-[#1a4a2e]/70 font-body text-center max-w-xs">
                  Ora tocca «{pendingSource === 'camera' ? 'Scatta una foto' : 'Carica le tue foto'}» per iniziare.
                </p>
              )}
              {declinedConsent && !consent && (
                <p className="text-xs text-[#1a4a2e]/70 font-body text-center max-w-xs">
                  Per caricare le foto serve accettare il Patto sulla Privacy ·{' '}
                  <button
                    type="button"
                    onClick={() => setShowPrivacy(true)}
                    className="underline underline-offset-2 font-semibold hover:text-[#1a4a2e] transition-colors"
                  >
                    Rivedi il patto
                  </button>
                </p>
              )}
              {uploadError && (
                <p className="text-xs text-[#8b1a1a] font-body max-w-sm text-center">{uploadError}</p>
              )}
              {batchSummary && (
                <p className="text-xs text-[#1a4a2e]/80 font-body max-w-sm text-center">{batchSummary}</p>
              )}
              <AnimatePresence>
                {successCount !== null && (
                  <motion.p
                    key="upload-success"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    role="status"
                    className="text-xs text-[#1a4a2e] font-body max-w-sm text-center"
                  >
                    ✓ {successCount === 1 ? '1 foto caricata!' : `${successCount} foto caricate!`} Grazie per aver condiviso i tuoi ricordi.
                  </motion.p>
                )}
              </AnimatePresence>
              {failedFiles.length > 0 && !uploading && (
                <p className="text-xs text-[#8b1a1a] font-body max-w-sm text-center">
                  {failedFiles.length === 1
                    ? '1 foto non è stata caricata — '
                    : `${failedFiles.length} foto non sono state caricate — `}
                  <button
                    type="button"
                    onClick={retryFailed}
                    className="underline underline-offset-2 font-semibold hover:text-[#8b1a1a]/70 transition-colors"
                  >
                    Riprova
                  </button>
                </p>
              )}
              <p className="text-xs text-[#1a4a2e]/50 font-body text-center max-w-xs">
                JPG, PNG o WebP · max 10 MB per foto
              </p>
              <p className="text-xs text-[#1a4a2e]/50 font-body text-center max-w-xs">
                Le foto saranno visibili a tutti gli invitati. Carica solo immagini di cui possiedi i diritti.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFiles}
          />
        </div>

        {/* Grid / Sphere view toggle */}
        {canShowSphere && (
          <div className="flex items-center justify-center pb-6 shrink-0">
            <div className="inline-flex rounded-sm border border-[#d4af37]/40 bg-[#1a4a2e]/5 p-1 gap-1" role="group" aria-label="Modalità di visualizzazione">
              <button
                onClick={() => setView('grid')}
                aria-pressed={effectiveView === 'grid'}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm font-cinzel text-xs uppercase tracking-widest transition-colors ${
                  effectiveView === 'grid'
                    ? 'bg-[#1a4a2e] text-[#fdfaf1]'
                    : 'text-[#1a4a2e]/70 hover:text-[#1a4a2e]'
                }`}
              >
                <LayoutGrid size={16} className={effectiveView === 'grid' ? 'text-[#d4af37]' : ''} />
                <span>Griglia</span>
              </button>
              <button
                onClick={() => setView('sphere')}
                aria-pressed={effectiveView === 'sphere'}
                className={`flex items-center gap-2 px-4 py-2 rounded-sm font-cinzel text-xs uppercase tracking-widest transition-colors ${
                  effectiveView === 'sphere'
                    ? 'bg-[#1a4a2e] text-[#fdfaf1]'
                    : 'text-[#1a4a2e]/70 hover:text-[#1a4a2e]'
                }`}
              >
                <Orbit size={16} className={effectiveView === 'sphere' ? 'text-[#d4af37]' : ''} />
                <span>Sfera</span>
              </button>
            </div>
          </div>
        )}

        {/* Gallery */}
        <div ref={galleryRef} className="flex-grow px-4 sm:px-8 pb-12">
          {effectiveView === 'sphere' && sphereSize > 0 && (
            <div className="flex flex-col items-center">
              <SphereImageGrid
                images={loadedImages}
                containerSize={sphereSize}
                autoRotate
                autoRotateSpeed={0.18}
                dragSensitivity={0.8}
                momentumDecay={0.96}
                baseImageScale={0.16}
                onImageClick={(img) => openLightbox(img.id)}
              />
              <p className="font-body text-xs text-[#1a4a2e]/50 text-center mt-2">
                Trascina per ruotare · tocca una foto per ingrandirla
              </p>
            </div>
          )}

          {effectiveView === 'grid' && (
          <>
          {listError && (
            <div className="flex items-center justify-center gap-2 text-[#8b1a1a]/80 font-body text-sm py-8">
              <AlertCircle size={16} />
              <span>{listError}</span>
            </div>
          )}

          {loadingList && (
            <div className="flex items-center justify-center gap-3 py-16 text-[#1a4a2e]/50 font-body text-sm">
              <Loader2 size={22} className="animate-spin text-[#d4af37]" />
              <span>Invocazione degli incantesimi fotografici…</span>
            </div>
          )}

          {!loadingList && !listError && gallery.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-[#1a4a2e]/40">
              <Images size={48} strokeWidth={1} />
              <p className="font-cinzel text-sm uppercase tracking-widest text-center">
                Nessuna foto ancora. Sii il primo ad aggiungere un ricordo!
              </p>
            </div>
          )}

          {gallery.length > 0 && (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <AnimatePresence>
                {pagedGallery.map((item, idx) => (
                  <motion.div
                    key={item.blobPath}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                    className={`relative aspect-square bg-[#1a4a2e]/5 rounded-sm overflow-hidden border border-[#d4af37]/30 ${item.dataUrl ? 'cursor-pointer hover:border-[#d4af37] transition-colors' : ''}`}
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                    role={item.dataUrl ? 'button' : undefined}
                    tabIndex={item.dataUrl ? 0 : undefined}
                    aria-label={item.dataUrl ? 'Visualizza foto ingrandita' : undefined}
                    onClick={() => item.dataUrl && openLightbox(item.blobPath)}
                    onKeyDown={(e) => { if (item.dataUrl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLightbox(item.blobPath); } }}
                  >
                    {item.loading && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 size={20} className="animate-spin text-[#d4af37]/60" />
                      </div>
                    )}
                    {item.error && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <AlertCircle size={20} className="text-[#8b1a1a]/40" />
                      </div>
                    )}
                    {item.dataUrl && (
                      <img
                        src={item.dataUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ userSelect: 'none', WebkitUserDrag: 'none' } as CSSProperties}
                      />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Grid pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setGridPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="w-10 h-10 flex items-center justify-center rounded-sm border border-[#d4af37]/40 text-[#1a4a2e] hover:bg-[#1a4a2e]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Pagina precedente"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="font-cinzel text-xs uppercase tracking-widest text-[#1a4a2e]/70">
                  Pagina {safePage + 1} / {pageCount}
                </span>
                <button
                  onClick={() => setGridPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage === pageCount - 1}
                  className="w-10 h-10 flex items-center justify-center rounded-sm border border-[#d4af37]/40 text-[#1a4a2e] hover:bg-[#1a4a2e]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Pagina successiva"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            </>
          )}
          </>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showPrivacy && (
          <PrivacyModal
            onAccepted={onPrivacyAccepted}
            onClose={onPrivacyClosed}
          />
        )}
      </AnimatePresence>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={loadedImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(idx) => setLightboxIndex(idx)}
        />
      )}
    </>
  );
}
