import { useState, useEffect } from "react";
import API from "../api/api";

// Cache for loaded images to prevent duplicate requests
const imageCache = new Map();

/**
 * ProtectedImage Component
 * 
 * Displays images that require authentication by fetching them with JWT tokens.
 * This prevents unauthorized access to sensitive images like profile photos.
 * 
 * @param {string} src - The protected media URL (e.g., /api/auth/media/profile_photos/...)
 * @param {string} alt - Alt text for the image
 * @param {object} style - CSS styles for the img element
 * @param {function} onError - Error handler callback
 * @param {function} onLoad - Load handler callback
 */
export default function ProtectedImage({ 
  src, 
  alt = "", 
  style, 
  onError, 
  onLoad,
  className 
}) {
  const [imageBlobUrl, setImageBlobUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Skip if no src provided or already errored
    if (!src || error) return;

    let cancelled = false;
    let currentBlobUrl = null;

    const fetchImage = async () => {
      try {
        // Check cache first to prevent duplicate requests
        if (imageCache.has(src)) {
          const cachedBlob = imageCache.get(src);
          if (!cancelled) {
            currentBlobUrl = URL.createObjectURL(cachedBlob);
            setImageBlobUrl(currentBlobUrl);
          }
          return;
        }
        
        // Extract the path from the full URL if needed
        const path = src.replace(/.*\/api\/auth\/media\//, '');
        
        // Fetch the image with authentication headers via axios
        const response = await API.get(`/auth/media/${path}`, { 
          responseType: 'blob' 
        });
        
        if (cancelled) return; // Component unmounted during fetch
        
        // Clean up any existing blob URL before setting new one
        if (imageBlobUrl) {
          URL.revokeObjectURL(imageBlobUrl);
        }
        
        // Cache the blob and create a blob URL from the response
        imageCache.set(src, response.data);
        currentBlobUrl = URL.createObjectURL(response.data);
        setImageBlobUrl(currentBlobUrl);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load protected image:', err);
        setError(true);
        if (onError) {
          onError(err);
        }
      }
    };

    fetchImage();

    // Cleanup function to revoke blob URL when component unmounts or src changes
    return () => {
      cancelled = true;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [src]); // Re-run when src changes

  // Show nothing while loading or if there's an error
  if (error) {
    return null;
  }
  
  if (!imageBlobUrl) {
    return null;
  }

  return (
    <img
      src={imageBlobUrl}
      alt={alt}
      style={style}
      className={className}
      onLoad={onLoad}
      onError={(e) => {
        setError(true);
        if (onError) {
          onError(e);
        }
      }}
    />
  );
}
