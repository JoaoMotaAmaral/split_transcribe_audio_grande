# 🎵 API de Transcrição de Áudio

Uma API REST para divisão automática e transcrição de arquivos de áudio usando FFmpeg e o modelo Whisper da Groq.

## 📋 Funcionalidades

- ✅ **Upload de arquivos de áudio** (MP3, WAV, M4A, MP4)
- ✅ **Divisão automática** em chunks menores (10MB máximo por parte)
- ✅ **Transcrição com IA** usando Whisper Large V3 Turbo (Groq)
- ✅ **Processamento inteligente** baseado no tamanho do arquivo
- ✅ **Limpeza automática** dos arquivos temporários
- ✅ **API RESTful** com documentação Swagger

## 🚀 Instalação e Configuração

### Pré-requisitos

- Node.js (versão 16 ou superior)
- Conta na [Groq](https://console.groq.com/) para obter API key

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd audio-transcription-api
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
GROQ_API_KEY=sua_chave_da_groq_aqui
```

### 4. Execute a aplicação

```bash
node index.js
```

A API estará disponível em `http://localhost:3000`

## 📚 Como Usar

### Fluxo básico de uso:

1. **Faça upload do áudio** → `POST /split-audio`
2. **Execute a transcrição** → `GET /transcribe-all`

### Exemplo prático com curl:

```bash
# 1. Upload e divisão do áudio
curl -X POST \
  -F "audio=@meu-audio.mp3" \
  http://localhost:3000/split-audio

# 2. Transcrição completa
curl http://localhost:3000/transcribe-all
```

## 🔗 Endpoints da API

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/split-audio` | Upload e divisão de arquivo de áudio |
| `GET` | `/transcribe-all` | Transcrição de todos os chunks |
| `GET` | `/chunks/{filename}` | Download de chunk específico |

### POST /split-audio

Faz upload e divide automaticamente o arquivo de áudio.

**Request:**
```bash
curl -X POST \
  -F "audio=@arquivo.mp3" \
  http://localhost:3000/split-audio
```

**Response:**
```json
{
  "message": "Áudio dividido em 3 parte(s) (25 MB)",
  "parts": [
    "http://localhost:3000/chunks/uuid-filename-part1.mp3",
    "http://localhost:3000/chunks/uuid-filename-part2.mp3",
    "http://localhost:3000/chunks/uuid-filename-part3.mp3"
  ]
}
```

### GET /transcribe-all

Transcreve todos os chunks e retorna o texto completo.

**Request:**
```bash
curl http://localhost:3000/transcribe-all
```

**Response:**
```json
{
  "message": "Transcrição completa das partes da pasta /chunks",
  "total_parts": 3,
  "transcription": "Este é o texto transcrito completo do áudio..."
}
```

## 📁 Estrutura do Projeto

```
audio-transcription-api/
├── index.js              # Arquivo principal da API
├── package.json          # Dependências do projeto
├── .env                  # Variáveis de ambiente (criar)
├── .gitignore           # Arquivos ignorados pelo Git
├── swagger.yaml         # Documentação da API
├── README.md            # Este arquivo
├── uploads/             # Pasta temporária (criada automaticamente)
└── chunks/              # Chunks processados (criada automaticamente)
```

## ⚙️ Configurações Técnicas

### Divisão de Arquivos
- **Limite por chunk:** 10MB
- **Cálculo automático:** Número de partes = tamanho_total / 10MB
- **Duração proporcional:** Cada chunk mantém a proporção temporal

### Transcrição
- **Modelo:** Whisper Large V3 Turbo (Groq)
- **Idioma:** Português (configurável)
- **Formato:** Verbose JSON com timestamps
- **Temperatura:** 0 (máxima precisão)

### Limpeza Automática
- Após a transcrição, todas as pastas (`uploads/` e `chunks/`) são limpas automaticamente

## 🔧 Dependências

| Pacote | Versão | Descrição |
|--------|--------|-----------|
| `express` | ^5.1.0 | Framework web |
| `multer` | ^2.0.1 | Upload de arquivos |
| `fluent-ffmpeg` | ^2.1.3 | Manipulação de áudio/vídeo |
| `ffmpeg-static` | ^5.2.0 | Binário do FFmpeg |
| `ffprobe-static` | ^3.1.0 | Binário do FFprobe |
| `groq-sdk` | ^0.26.0 | SDK da Groq para transcrição |
| `uuid` | ^11.1.0 | Geração de IDs únicos |
| `dotenv` | ^17.0.1 | Carregamento de variáveis de ambiente |

## 📖 Documentação da API

### Swagger UI (Recomendado)

Para uma documentação interativa, instale o Swagger UI:

```bash
npm install swagger-ui-express yamljs
```

Adicione ao seu `index.js`:

```javascript
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

Acesse: `http://localhost:3000/api-docs`

## 🐛 Tratamento de Erros

A API retorna códigos HTTP apropriados e mensagens descritivas:

| Código | Descrição |
|--------|-----------|
| `200` | Sucesso |
| `400` | Erro na requisição (arquivo não enviado) |
| `404` | Nenhum arquivo encontrado para transcrição |
| `500` | Erro interno do servidor |

### Exemplo de resposta de erro:
```json
{
  "error": "Nenhum arquivo foi enviado. Esperado campo \"audio\"."
}
```

## 🔒 Segurança e Considerações

- ⚠️ **Não use em produção sem autenticação**
- ⚠️ **Configure limites de upload apropriados**
- ⚠️ **Mantenha sua GROQ_API_KEY segura**
- ✅ **A limpeza automática previne acúmulo de arquivos**

## 🤝 Contribuindo

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Se você encontrar algum problema ou tiver dúvidas:

1. Verifique os logs da aplicação
2. Confirme se sua GROQ_API_KEY está configurada
3. Teste com arquivos de áudio menores primeiro
4. Abra uma issue no GitHub

