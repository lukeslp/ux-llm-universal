# dr.eamer.dev API Research Notes

## Base URL
`https://api.dr.eamer.dev/v1`

## Authentication
- X-API-Key header (recommended)
- Bearer token
- Query parameter

## Rate Limit: 10,000 requests/day

## Key Endpoints for Chat Tool Integration:

### Utils (most relevant for chat tools)
- `/utils/search` - Web search
- `/utils/news/*` - News search
- `/utils/books/*` - Book search
- `/utils/tts` - Text-to-speech
- `/utils/images/resize` - Image resize
- `/utils/images/convert` - Image convert
- `/utils/pdf/extract` - PDF extraction
- `/utils/convert` - File conversion

### LLM
- `/llm/chat` - Chat completions
- `/llm/vision` - Vision analysis
- `/llm/embed` - Embeddings
- `/llm/speech` - Speech
- `/llm/models` - List models

### Data
- `/data/sources` - List data sources (17 sources)
- `/data/:source/search` - Search within a data source
- `/data/:source/get/:id` - Get specific item

### DataVis
- `/datavis/list` - List 123+ visualizations
- `/datavis/categories` - Categories
- `/datavis/proxy/:source` - Proxy to visualization

### Corpus Linguistics
- `/corpus/search` - Search corpus
- `/corpus/collocations` - Word collocations
- `/corpus/frequency` - Word frequency

### Etymology
- `/etymology/explore/:word` - Word etymology

### Clinical
- `/clinical/conditions` - Medical conditions
- `/clinical/search` - Clinical search

### Orchestrate (Multi-agent)
- `/orchestrate/dream-cascade` - Cascade orchestration
- `/orchestrate/dream-swarm` - Swarm orchestration

### Swarm
- `/swarm/hive` - Hive mind
- `/swarm/chat` - Swarm chat

### Generate (Smart Templates)
- `/generate/alt-text` - Generate alt text
- `/generate/story` - Generate stories
- `/generate/lesson-plan` - Lesson plans
- `/generate/business-plan` - Business plans
- `/generate/resume` - Resumes
- `/generate/itinerary` - Travel itineraries

### AAC (Accessibility)
- `/aac/symbols/search` - Search AAC symbols
- `/aac/symbols/arasaac` - ARASAAC pictograms
- `/aac/sentence` - Sentence to symbols

## Need to check:
- /utils/search endpoint details
- /utils/news endpoint details
- /capabilities endpoint
