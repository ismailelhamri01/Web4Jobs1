import React from 'react';

/**
 * Composant Logo
 * 
 * Vous pouvez modifier ce fichier pour changer votre logo.
 * 1. Importez votre image dans le dossier `public/logo/`
 * 2. Remplacez le contenu du return ci-dessous par :
 *    <img src="/logo/votre-image.png" alt="Logo" className={className} />
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <img src="/logo/logo w4j.png" alt="Logo Web4Jobs" className={className} />
  );
}
