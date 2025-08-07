const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Groq = require('groq-sdk');
require('dotenv').config(); // Carrega o .env com a chave da Groq

const app = express();
const PORT = 3000;

// Configura caminhos do ffmpeg e ffprobe
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Cliente Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Diretórios para uploads e chunks
const uploadDir = path.join(__dirname, 'uploads');
const chunksDir = path.join(__dirname, 'chunks');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(chunksDir, { recursive: true });

// Serve arquivos da pasta 'chunks' estaticamente
app.use('/chunks', express.static(chunksDir));

// Configuração do Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({ storage });

/**
 * Obtém a duração do áudio em segundos
 */
function getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration);
        });
    });
}

/**
 * Divide o áudio em 'parts' pedaços iguais
 */
function splitAudio(filePath, outputBase, duration, parts = 4) {
    const segmentDuration = duration / parts;
    const promises = [];

    for (let i = 0; i < parts; i++) {
        const start = i * segmentDuration;
        const outputPath = path.join(chunksDir, `${outputBase}-part${i + 1}.mp3`);

        const p = new Promise((resolve, reject) => {
            ffmpeg(filePath)
                .setStartTime(start)
                .setDuration(segmentDuration)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', reject)
                .run();
        });

        promises.push(p);
    }

    return Promise.all(promises);
}

/**
 * Endpoint principal: upload e fatiamento
 */
app.post('/split-audio', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('[ERROR 400] Nenhum arquivo foi enviado.');
            return res.status(400).json({ error: 'Nenhum arquivo foi enviado. Esperado campo "audio".' });
        }

        console.log('[INFO] Arquivo recebido:', req.file.originalname);

        const audioPath = req.file.path;
        const audioId = path.parse(req.file.filename).name;

        // Define tamanho máximo de cada parte (em bytes)
        const maxPartSize = 10 * 1024 * 1024; // 10 MB

        // Obtém tamanho do arquivo
        let fileSizeBytes;
        try {
            const stats = await fsPromises.stat(audioPath);
            fileSizeBytes = stats.size;
        } catch (err) {
            console.error('[ERROR 500] Falha ao obter tamanho do arquivo:', err);
            return res.status(500).json({ error: 'Erro ao obter informações do arquivo.' });
        }

        const shouldSplit = fileSizeBytes > maxPartSize;
        const parts = shouldSplit ? Math.ceil(fileSizeBytes / maxPartSize) : 1;

        console.log(`[INFO] Tamanho: ${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB - Dividindo em ${parts} parte(s)`);

        // Obtém duração do áudio
        let duration;
        try {
            duration = await getAudioDuration(audioPath);
        } catch (err) {
            console.error('[ERROR 500] Erro ao obter duração do áudio:', err);
            return res.status(500).json({ error: 'Erro ao obter duração do áudio.' });
        }

        // Faz o fatiamento
        let chunks;
        try {
            chunks = await splitAudio(audioPath, audioId, duration, parts);
        } catch (err) {
            console.error('[ERROR 500] Erro ao dividir o áudio com ffmpeg:', err);
            return res.status(500).json({ error: 'Erro ao dividir o áudio.' });
        }

        // Gera links de acesso
        const links = chunks.map(chunkPath => {
            const filename = path.basename(chunkPath);
            return `${req.protocol}://${req.get('host')}/chunks/${filename}`;
        });

        console.log('[INFO] Divisão concluída. Links gerados:', links);

        return res.json({
            message: `Áudio dividido em ${parts} parte(s) (${Math.round(fileSizeBytes / 1024 / 1024)} MB)`,
            parts: links
        });
    } catch (err) {
        console.error('[ERROR 500] Erro inesperado:', err);
        return res.status(500).json({ error: 'Erro inesperado ao processar o áudio.' });
    }
});

/**
 * Endpoint: transcrever todos os chunks
 */
app.get('/transcribe-all', async (req, res) => {
    try {
        const files = await fsPromises.readdir(chunksDir);
        const audioFiles = files
            .filter(f => /\.(mp3|wav|m4a|mp4)$/i.test(f))
            .sort();

        if (audioFiles.length === 0) {
            console.warn('[WARN] Nenhum arquivo de áudio encontrado para transcrição.');
            return res.status(404).json({ error: 'Nenhum arquivo para transcrever encontrado.' });
        }

        console.log(`[INFO] Iniciando transcrição de ${audioFiles.length} arquivo(s).`);

        const allSegments = [];

        for (const filename of audioFiles) {
            const filePath = path.join(chunksDir, filename);
            console.log(`[INFO] Transcrevendo: ${filename}`);

            try {
                const transcription = await groq.audio.transcriptions.create({
                    file: fs.createReadStream(filePath),
                    model: 'whisper-large-v3-turbo',
                    response_format: 'verbose_json',
                    timestamp_granularities: ['segment'],
                    language: 'pt',
                    temperature: 0
                });

                if (transcription.segments) {
                    allSegments.push(...transcription.segments);
                } else if (transcription.text) {
                    allSegments.push({ text: transcription.text });
                } else {
                    console.warn(`[WARN] Nenhuma transcrição encontrada em ${filename}`);
                }
            } catch (err) {
                console.error(`[ERROR] Falha na transcrição de ${filename}:`, err);
            }
        }

 // Monta uma string única com todo o texto
const fullText = allSegments
  .map(segment => segment.text.trim())  // pega só o texto limpo
  .filter(text => text.length > 0)      // opcional: descarta strings vazias
  .join(' ');                           // une com espaço

// Envia resposta com o texto concatenado
res.json({
  message: 'Transcrição completa das partes da pasta /chunks',
  total_parts: audioFiles.length,
  transcription: fullText
});

        // Cleanup: apaga uploads e chunks
        try {
            const deleteFromDir = async dirPath => {
                const items = await fsPromises.readdir(dirPath);
                await Promise.all(items.map(f => fsPromises.unlink(path.join(dirPath, f))));
            };
            await deleteFromDir(uploadDir);
            await deleteFromDir(chunksDir);
            console.log('[INFO] Pastas /uploads e /chunks limpas com sucesso.');
        } catch (cleanupErr) {
            console.error('[ERROR] Falha ao limpar as pastas:', cleanupErr);
        }
    } catch (err) {
        console.error('[ERROR 500] Erro geral na transcrição:', err);
        res.status(500).json({ error: 'Erro ao transcrever os arquivos da pasta chunks.' });
    }
});

app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
});
