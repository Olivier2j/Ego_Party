import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft, Upload, Trash2, Image, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Constants
const MAX_PHOTOS = 250;
const MAX_IMAGE_SIZE = 400; // Max width/height in pixels
const JPEG_QUALITY = 0.6; // Compression quality (0.6 = 60%)
const STORAGE_KEY = 'slotPhotos';

// Generate stable rotations for photos
function getRotation(id) {
  const seed = typeof id === 'number' ? id : String(id).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return ((seed * 9301 + 49297) % 233280) / 233280 * 6 - 3;
}

// Compress and resize image
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > height) {
          if (width > MAX_IMAGE_SIZE) {
            height = Math.round((height * MAX_IMAGE_SIZE) / width);
            width = MAX_IMAGE_SIZE;
          }
        } else {
          if (height > MAX_IMAGE_SIZE) {
            width = Math.round((width * MAX_IMAGE_SIZE) / height);
            height = MAX_IMAGE_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to compressed JPEG
        const compressedBase64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Calculate storage usage
function getStorageUsage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { used: 0, percentage: 0 };
    const bytes = new Blob([data]).size;
    const maxBytes = 5 * 1024 * 1024; // 5MB estimate
    return {
      used: bytes,
      percentage: Math.min(100, Math.round((bytes / maxBytes) * 100))
    };
  } catch {
    return { used: 0, percentage: 0 };
  }
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(2) + ' Mo';
}

export default function PhotoManager() {
  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [storageUsage, setStorageUsage] = useState({ used: 0, percentage: 0 });

  // Load photos from localStorage
  useEffect(() => {
    const savedPhotos = localStorage.getItem(STORAGE_KEY);
    if (savedPhotos) {
      try {
        setPhotos(JSON.parse(savedPhotos));
      } catch {
        setPhotos([]);
      }
    }
    setStorageUsage(getStorageUsage());
  }, []);

  // Save photos to localStorage with error handling
  const savePhotos = useCallback((newPhotos) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPhotos));
      setPhotos(newPhotos);
      setStorageUsage(getStorageUsage());
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        toast.error('Stockage plein ! Supprimez des photos pour en ajouter.');
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
      return false;
    }
  }, []);

  const handleFileChange = async (files) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // Check photo limit
    const remainingSlots = MAX_PHOTOS - photos.length;
    if (remainingSlots <= 0) {
      toast.error(`Limite atteinte ! Maximum ${MAX_PHOTOS} photos.`);
      return;
    }
    
    const filesToProcess = fileArray.slice(0, remainingSlots);
    if (filesToProcess.length < fileArray.length) {
      toast.warning(`Seules ${filesToProcess.length} photos seront ajoutées (limite: ${MAX_PHOTOS})`);
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: filesToProcess.length });
    
    const newPhotos = [...photos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setUploadProgress({ current: i + 1, total: filesToProcess.length });
      
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} n'est pas une image valide`);
        errorCount++;
        continue;
      }

      try {
        // Compress the image
        const compressedBase64 = await compressImage(file);
        
        newPhotos.push({
          id: Date.now() + Math.random(),
          src: compressedBase64,
          name: file.name,
          addedAt: new Date().toISOString(),
        });
        
        successCount++;
        
        // Save incrementally every 10 photos to avoid losing progress
        if (successCount % 10 === 0) {
          const saved = savePhotos(newPhotos);
          if (!saved) {
            // Storage full, stop processing
            toast.error(`Stockage plein après ${successCount} photos`);
            break;
          }
        }
      } catch (error) {
        console.error('Error processing image:', file.name, error);
        errorCount++;
      }
    }

    // Final save
    if (successCount > 0) {
      const saved = savePhotos(newPhotos);
      if (saved) {
        toast.success(`${successCount} photo(s) ajoutée(s)`);
      }
    }
    
    if (errorCount > 0) {
      toast.error(`${errorCount} photo(s) n'ont pas pu être traitées`);
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileChange(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, savePhotos]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const deletePhoto = (id) => {
    const newPhotos = photos.filter((p) => p.id !== id);
    savePhotos(newPhotos);
    toast.success('Photo supprimée');
  };

  const clearAllPhotos = () => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer toutes les photos ?')) {
      savePhotos([]);
      toast.success('Toutes les photos ont été supprimées');
    }
  };

  const storageBarColor = storageUsage.percentage > 90 
    ? 'bg-red-500' 
    : storageUsage.percentage > 70 
      ? 'bg-yellow-500' 
      : 'bg-green-500';

  return (
    <div className="min-h-screen velvet-texture p-4 sm:p-8">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-gold/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-pink/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/">
            <Button variant="ghost" className="text-primary hover:text-primary/80 gap-2">
              <ArrowLeft className="h-5 w-5" />
              <span className="font-display text-lg">RETOUR</span>
            </Button>
          </Link>
          <h1 className="font-display text-3xl sm:text-4xl text-primary neon-text-gold">
            GESTION DES PHOTOS
          </h1>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Storage Usage Bar */}
        <Card className="mb-4 p-4 bg-card/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Stockage utilisé: {formatBytes(storageUsage.used)}
            </span>
            <span className="text-sm text-muted-foreground">
              {photos.length} / {MAX_PHOTOS} photos
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${storageBarColor} transition-all duration-300`}
              style={{ width: `${storageUsage.percentage}%` }}
            />
          </div>
          {storageUsage.percentage > 90 && (
            <div className="flex items-center gap-2 mt-2 text-yellow-500 text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>Stockage presque plein</span>
            </div>
          )}
        </Card>

        {/* Upload Area */}
        <Card
          className={`mb-8 border-2 border-dashed transition-all duration-300 ${
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : 'border-border bg-card/50 hover:border-primary/50'
          } ${isUploading ? 'pointer-events-none opacity-70' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <label className="flex flex-col items-center justify-center p-12 cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files)}
              disabled={isUploading || photos.length >= MAX_PHOTOS}
            />
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            
            {isUploading ? (
              <>
                <p className="font-display text-2xl text-foreground mb-2">
                  TRAITEMENT EN COURS...
                </p>
                <p className="text-muted-foreground text-center">
                  {uploadProgress.current} / {uploadProgress.total} photos
                </p>
                <div className="w-48 h-2 bg-muted rounded-full mt-4 overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  />
                </div>
              </>
            ) : photos.length >= MAX_PHOTOS ? (
              <>
                <p className="font-display text-2xl text-foreground mb-2">
                  LIMITE ATTEINTE
                </p>
                <p className="text-muted-foreground text-center">
                  Supprimez des photos pour en ajouter
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl text-foreground mb-2">
                  {isDragging ? 'DÉPOSEZ ICI' : 'AJOUTER DES PHOTOS'}
                </p>
                <p className="text-muted-foreground text-center">
                  Glissez-déposez vos images ou cliquez pour sélectionner
                </p>
                <p className="text-muted-foreground/60 text-sm mt-2">
                  Formats acceptés: JPG, PNG, GIF, WebP • Auto-compressées
                </p>
              </>
            )}
          </label>
        </Card>

        {/* Photos Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Image className="h-6 w-6 text-primary" />
            <h2 className="font-display text-2xl text-foreground">
              VOS PHOTOS ({photos.length})
            </h2>
          </div>
          {photos.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllPhotos}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              TOUT SUPPRIMER
            </Button>
          )}
        </div>

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative polaroid-frame transform hover:rotate-0 hover:scale-105 transition-transform duration-300"
                style={{ transform: `rotate(${getRotation(photo.id)}deg)` }}
              >
                <div className="aspect-[3/4] overflow-hidden rounded-sm bg-gray-200">
                  <img
                    src={photo.src}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Delete Button */}
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-110"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center bg-card/50">
            <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
              <Image className="h-12 w-12 text-muted-foreground" />
            </div>
            <p className="font-display text-2xl text-muted-foreground mb-2">
              AUCUNE PHOTO
            </p>
            <p className="text-muted-foreground">
              Ajoutez des photos pour commencer à jouer
            </p>
          </Card>
        )}

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            Les photos sont compressées et stockées localement dans votre navigateur.
            <br />
            Capacité maximale: {MAX_PHOTOS} photos
          </p>
        </div>
      </div>
    </div>
  );
}
