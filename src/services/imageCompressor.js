/**
 * Comprime uma imagem client-side usando Canvas API.
 * Redimensiona para máximo de 1280px mantendo aspect ratio.
 * Output: JPEG com qualidade 0.8
 *
 * @param {File|Blob} file - Arquivo de imagem original
 * @param {number} maxSize - Dimensão máxima em pixels (default: 1280)
 * @param {number} quality - Qualidade JPEG 0-1 (default: 0.8)
 * @returns {Promise<Blob>} - Blob comprimido
 */
export async function compressImage(file, maxSize = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;

            // Redimensionar mantendo aspect ratio
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = Math.round((height * maxSize) / width);
                    width = maxSize;
                } else {
                    width = Math.round((width * maxSize) / height);
                    height = maxSize;
                }
            }

            // Criar canvas e desenhar
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Converter para Blob JPEG
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Falha ao comprimir imagem'));
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Falha ao carregar imagem'));
        };

        img.src = url;
    });
}
