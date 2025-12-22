import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft, Upload, Trash2, Image, X } from 'lucide-react';
import { toast } from 'sonner';

// Generate stable rotations for photos
function getRotation(id) {
  const seed = typeof id === 'number' ? id : String(id).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return ((seed * 9301 + 49297) % 233280) / 233280 * 6 - 3;
}

export default function PhotoManager() {
  const [photos, setPhotos] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Load photos from localStorage
  useEffect(() => {
    const savedPhotos = localStorage.getItem('slotPhotos');
    if (savedPhotos) {
      setPhotos(JSON.parse(savedPhotos));
    }
  }, []);

  // Save photos to localStorage
  const savePhotos = useCallback((newPhotos) => {
    localStorage.setItem('slotPhotos', JSON.stringify(newPhotos));
    setPhotos(newPhotos);
  }, []);

  const handleFileChange = async (files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newPhotos = [...photos];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} n'est pas une image valide`);
        continue;
      }

      // Convert to base64
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      newPhotos.push({
        id: Date.now() + Math.random(),
        src: base64,
        name: file.name,
        addedAt: new Date().toISOString(),
      });
    }

    savePhotos(newPhotos);
    setIsUploading(false);
    toast.success(`${files.length} photo(s) ajoutée(s)`);
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

        {/* Upload Area */}
        <Card
          className={`mb-8 border-2 border-dashed transition-all duration-300 ${
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.02]'
              : 'border-border bg-card/50 hover:border-primary/50'
          }`}
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
              disabled={isUploading}
            />
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Upload className="h-10 w-10 text-primary" />
            </div>
            <p className="font-display text-2xl text-foreground mb-2">
              {isDragging ? 'DÉPOSEZ ICI' : 'AJOUTER DES PHOTOS'}
            </p>
            <p className="text-muted-foreground text-center">
              Glissez-déposez vos images ou cliquez pour sélectionner
            </p>
            <p className="text-muted-foreground/60 text-sm mt-2">
              Formats acceptés: JPG, PNG, GIF, WebP
            </p>
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
            Les photos sont stockées localement dans votre navigateur.
            <br />
            Capacité maximale recommandée: ~250 photos
          </p>
        </div>
      </div>
    </div>
  );
}
