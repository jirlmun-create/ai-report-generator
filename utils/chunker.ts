// A simple text chunker. It's not very sophisticated but works for many use cases.
const MAX_CHUNK_SIZE = 15000; // A conservative chunk size for Gemini models.

export const chunkText = (text: string): string[] => {
    const chunks: string[] = [];
    if (!text) {
        return chunks;
    }

    let currentChunk = '';
    // Split by newlines which often represent paragraph breaks.
    const paragraphs = text.split(/(\n+)/).filter(p => p.trim().length > 0);

    for (const paragraph of paragraphs) {
        if ((currentChunk.length + paragraph.length) > MAX_CHUNK_SIZE) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
            // If a single paragraph is too long, it will be handled by the hard split below.
            currentChunk = paragraph;
        } else {
            currentChunk += paragraph;
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    // If any chunk is still larger than the max size (e.g., a very long paragraph), hard split it.
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
        if (chunk.length > MAX_CHUNK_SIZE) {
            for (let i = 0; i < chunk.length; i += MAX_CHUNK_SIZE) {
                finalChunks.push(chunk.substring(i, i + MAX_CHUNK_SIZE));
            }
        } else {
            finalChunks.push(chunk);
        }
    }

    return finalChunks;
};
