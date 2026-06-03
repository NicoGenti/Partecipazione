import { useState, useEffect, useRef, useCallback, type CSSProperties, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Upload, Images, Loader2, AlertCircle } from 'lucide-react';
import hogwartsLogo from '../assets/Hogwarts_logo.jpg';
import { isConfigured, uploadPhoto, listPhotos, fetchPhotoBlob, genUUID } from './azure';
import PrivacyModal, { getStoredConsent, type ConsentData } from './PrivacyModal';

const WATERMARK_TEXT = 'Nicolas & Giulia · 12.09.2026';

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

interface GalleryItem {
  blobPath: string;
  dataUrl: string | null;
  loading: boolean;
  error: boolean;
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
  const [uploadCount, setUploadCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load each image blob → watermark → dataUrl
  useEffect(() => {
    gallery.forEach((item, idx) => {
      if (item.dataUrl !== null || !item.loading || item.error) return;
      fetchPhotoBlob(item.blobPath)
        .then(blob => createImageBitmap(blob))
        .then(bmp => {
          const dataUrl = applyWatermark(bmp);
          bmp.close();
          setGallery(prev => prev.map((g, i) => i === idx ? { ...g, dataUrl, loading: false } : g));
        })
        .catch(() => {
          setGallery(prev => prev.map((g, i) => i === idx ? { ...g, loading: false, error: true } : g));
        });
    });
  }, [gallery]);

  const triggerUpload = () => {
    if (!consent) {
      setShowPrivacy(true);
    } else {
      fileInputRef.current?.click();
    }
  };

  const onPrivacyAccepted = (data: ConsentData) => {
    setConsent(data);
    setShowPrivacy(false);
    fileInputRef.current?.click();
  };

  const handleFiles = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;
    setUploading(true);
    setUploadError(null);
    setUploadCount(0);

    let done = 0;
    for (const file of files) {
      try {
        const id = genUUID();
        await uploadPhoto(file, id);
        done++;
        setUploadCount(done);
      } catch {
        setUploadError(`Errore nel caricamento di "${file.name}". Verifica la connessione e riprova.`);
      }
    }

    setUploading(false);
    e.target.value = '';
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
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={triggerUpload}
                disabled={uploading}
                className="flex items-center gap-3 px-8 py-3 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] hover:-translate-y-0.5 transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(26,74,46,0.3)]"
              >
                {uploading
                  ? <Loader2 size={18} className="text-[#d4af37] animate-spin" />
                  : <Upload size={18} className="text-[#d4af37]" />
                }
                <span>{uploading ? `Caricamento… (${uploadCount})` : 'Carica le tue foto'}</span>
              </button>
              {uploadError && (
                <p className="text-xs text-[#8b1a1a] font-body max-w-sm text-center">{uploadError}</p>
              )}
              <p className="text-xs text-[#1a4a2e]/50 font-body text-center max-w-xs">
                Le foto saranno visibili a tutti gli invitati. Carica solo immagini di cui possiedi i diritti.
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
        </div>

        {/* Gallery */}
        <div className="flex-grow px-4 sm:px-8 pb-12">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <AnimatePresence>
                {gallery.map((item, idx) => (
                  <motion.div
                    key={item.blobPath}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04, duration: 0.3 }}
                    className="relative aspect-square bg-[#1a4a2e]/5 rounded-sm overflow-hidden border border-[#d4af37]/30"
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
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
                    {/* Transparent overlay to block pointer interactions on the image */}
                    <div className="absolute inset-0 pointer-events-none select-none" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showPrivacy && (
          <PrivacyModal
            onAccepted={onPrivacyAccepted}
            onClose={() => setShowPrivacy(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
