/**
 * Fichiers de l'utilisateur : enregistrer un JSON (téléchargement du navigateur), choisir un fichier à lire. Les deux
 * sont à lancer dans le clic de l'utilisateur : le navigateur refuse d'ouvrir le sélecteur hors d'un geste.
 */

/** Propose d'enregistrer `value` en JSON lisible sous `name`. */
export function downloadJson(name: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  // Sous <html> : <body> peut manquer au tout début du chargement.
  document.documentElement.append(link);
  link.click();
  link.remove();
  // Le téléchargement a lu l'adresse au clic : libérée une fois qu'il est parti.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Ouvre le sélecteur de fichiers ; `undefined` si l'utilisateur l'a fermé sans rien choisir. */
export function chooseFile(accept: string): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    const done = (file: File | undefined) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => done(input.files?.[0]), { once: true });
    input.addEventListener('cancel', () => done(undefined), { once: true });
    // Dans la page le temps du choix : certains navigateurs ne préviennent pas d'un champ détaché.
    document.documentElement.append(input);
    input.click();
  });
}
