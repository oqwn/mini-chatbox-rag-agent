# Mini-Chatbox RAG Agent - TODO

## Phase 1: Foundation Setup ✅
- [x] Set up project structure and development environment
- [x] Initialize package.json with necessary dependencies
- [x] Configure TypeScript/JavaScript environment
- [x] Set up testing framework
- [x] Create basic project documentation
- [x] Docker environment setup
  - [x] Create multi-stage Dockerfile for production builds
  - [x] Set up docker-compose.yml for local development
  - [x] Configure Docker networks for service communication
  - [x] Create .dockerignore file
  - [x] Set up environment variable management

## Current Status
**Foundation Complete!** The project now has:
- Full TypeScript setup for both frontend and backend
- Docker development and production environments
- Testing frameworks (Jest for backend, Vitest for frontend)
- Linting and formatting tools
- Basic project structure with proper separation of concerns
- Makefile for easy command execution

## Phase 2: Core Components

### 2.0 Basic Chat Functionality (MVP) ✅
- [x] Implement basic chat with AI
  - [x] Create settings page for API configuration
    - [x] OpenAI API key input field
    - [x] API base URL configuration
    - [x] Model selection dropdown
  - [x] Build simple chat interface
    - [x] Message input and send functionality
    - [x] Display chat messages
    - [x] Basic error handling
  - [x] Connect to OpenAI API
    - [x] Implement API client
    - [x] Handle streaming responses
    - [x] Error handling and retry logic
  - [x] Add beautiful markdown rendering for AI responses
    - [x] Implement StreamingMarkdown component
    - [x] Support syntax highlighting for code blocks
    - [x] Handle tables, lists, and other markdown elements
  - [x] Fix HTTP streaming buffering issue
    - [x] Remove throttling mechanism that was causing buffering
    - [x] Optimize real-time streaming performance
    - [x] Add React.memo to prevent unnecessary re-renders

### 2.1 Task Division System
- [ ] Design task parsing and decomposition logic
  - [ ] Create TaskParser class with NLP integration
  - [ ] Define task types and categories
  - [ ] Implement intent detection
- [ ] Implement task queue management
  - [ ] Set up Bull queue with Redis
  - [ ] Create job processors
  - [ ] Implement queue monitoring
- [ ] Create task prioritization algorithm
  - [ ] Define priority scoring system
  - [ ] Implement dynamic reprioritization
- [ ] Build task dependency resolver
  - [ ] Create dependency graph structure
  - [ ] Implement topological sorting
- [ ] Develop subtask generation from complex queries
  - [ ] Build task decomposition rules
  - [ ] Create subtask templates

### 2.2 MCP (Model Context Protocol) Integration
- [x] Research and understand MCP specifications
- [x] Implement MCP server setup
- [x] Create MCP client connections
- [x] Build tool registration system
- [x] Develop MCP message handling
- [x] Support both Claude Desktop and custom MCP JSON formats
  - [x] Handle 'mcpServers' key (Claude Desktop format)
  - [x] Handle 'servers' key (custom format)
  - [x] Auto-detect and normalize configuration formats
  - [x] Default values for missing properties
- [x] Fix MCP tools synchronization
  - [x] Auto-load MCP configuration on app startup
  - [x] Sync tools from global API endpoint to server statuses
  - [x] Add periodic sync to keep tools up to date
  - [x] Fix MCPService singleton issue in backend
- [ ] Fix streaming issues with MCP tool execution
  - [x] Implement proper streaming support for tool calls in OpenAI service
  - [ ] Test and verify streaming works correctly after tool execution
  - [ ] Handle edge cases for multiple tool calls in sequence

### 2.3 RAG (Retrieval-Augmented Generation) System ✅
- [x] Design vector database schema
  - [x] PostgreSQL with pgvector extension setup
  - [x] Documents, document_chunks, knowledge_sources tables
  - [x] Vector similarity search indexes (IVFFlat)
  - [x] Proper foreign key relationships and triggers
- [x] Implement document ingestion pipeline
  - [x] File parsing service for multiple formats (.txt, .md, .json, .csv, .log)
  - [x] Text chunking with overlap (800 token chunks, 80 token overlap)
  - [x] Support for Chinese and international characters
  - [x] Batch processing for better performance
  - [x] Page-aware chunking for multi-page documents
- [x] Create embedding generation system
  - [x] OpenAI text-embedding-3-small integration (1536 dimensions)
  - [x] Batch embedding generation with rate limiting
  - [x] Local embedding service option
  - [x] Factory pattern for multiple embedding providers
  - [x] Token count estimation for mixed language content
- [x] Build similarity search functionality
  - [x] Vector similarity search using pgvector
  - [x] Hybrid search (vector + keyword) with configurable weights
  - [x] Context window expansion (include surrounding chunks)
  - [x] Relevance ranking with multiple factors
- [x] Develop context retrieval logic
  - [x] RAG retrieval service with configurable parameters
  - [x] Document grouping and diversity controls
  - [x] Citation generation with source attribution
  - [x] Timing and performance metrics
- [x] Implement relevance ranking algorithm
  - [x] Multi-factor scoring: similarity (60%), keywords (10%), length (10%), position (10%), recency (10%)
  - [x] Configurable similarity thresholds
  - [x] Support for knowledge source filtering
- [x] Dockerize vector database (PostgreSQL + pgvector)
  - [x] PostgreSQL 15 with pgvector extension
  - [x] Persistent data volumes
  - [x] Health checks and proper networking
- [x] Create data volume management for embeddings
  - [x] Persistent PostgreSQL data storage
  - [x] Backup-friendly volume configuration
  - [x] Development and production environment support

### 2.4 Multimodal Support ✅
- [x] Image processing pipeline
  - [x] Image upload handling with multimodal detection
  - [x] Image analysis integration (Sharp + Tesseract OCR)
  - [x] OCR capabilities for text extraction (supports English + Chinese)
  - [x] Thumbnail generation and image metadata extraction
  - [x] Color analysis and content classification
  - [x] Document detection from images
- [x] Video processing
  - [x] Video frame extraction at configurable intervals
  - [x] Video analysis tools (FFmpeg integration)
  - [x] Thumbnail generation from video frames
  - [x] Audio extraction from video files
  - [x] Video metadata analysis (duration, resolution, codecs)
  - [x] Preview generation for large video files
- [x] Audio processing
  - [x] Audio transcription framework (ready for Whisper/Google Cloud integration)
  - [x] Audio analysis features (volume, frequency analysis)
  - [x] Audio format conversion (WAV, MP3, M4A)
  - [x] Waveform visualization generation
  - [x] Audio segmentation based on silence detection
  - [x] Speech vs music detection heuristics

### 2.5 Context Memory System
- [x] Design conversation memory structure
  - [x] Created PostgreSQL schema with memory-specific tables
  - [x] Added conversation summaries and context windows
  - [x] Designed memory cache and pruning system
- [x] Implement short-term memory cache
  - [x] In-memory cache with TTL support
  - [x] Persistent cache backup in PostgreSQL
  - [x] Automatic cache cleanup and expiration
- [x] Build long-term memory persistence
  - [x] PostgreSQL-based conversation storage
  - [x] Message persistence with metadata and embeddings
  - [x] Conversation metadata tracking (token counts, importance scores)
- [x] Create memory retrieval system
  - [x] Context window management for token limits
  - [x] Important message filtering by score
  - [x] Recent message retrieval with pagination
- [x] Develop memory pruning strategies
  - [x] Automatic old message pruning
  - [x] Conversation summarization support
  - [x] Memory usage statistics and monitoring
- [x] Implement context window management
  - [x] Token-based context window sizing
  - [x] Dynamic context window adjustment
  - [x] Context window persistence and tracking
- [x] Add sidebar for /chat functionality
  - [x] Created ConversationSidebar component
  - [x] Conversation history browsing and search
  - [x] New conversation creation
  - [x] Conversation archiving and management
  - [x] Memory statistics display
  - [x] PostgreSQL integration for conversation persistence

### 2.6 Agent Scripts & Quick Implementation
- [ ] Design agent script DSL/format
- [ ] Create agent template system
- [ ] Build script parser and validator
- [ ] Implement hot-reload for agent scripts
- [ ] Develop agent orchestration system
- [ ] Create agent debugging tools

## Phase 3: Integration & Testing
- [ ] Integrate all components
- [ ] Build comprehensive test suite
- [ ] Performance optimization
- [ ] Error handling and recovery
- [ ] Logging and monitoring setup

## Phase 4: UI/UX
- [ ] Design chatbox interface
- [ ] Implement real-time messaging
- [ ] Add file upload capabilities
- [ ] Create response streaming
- [ ] Build conversation management UI

## Phase 5: Deployment & Documentation
- [x] Containerize application
  - [x] Create production-ready Dockerfile
  - [x] Optimize image size with multi-stage builds
  - [x] Implement health checks
  - [x] Configure resource limits
- [x] Docker Compose configurations
  - [x] Development environment (hot-reload enabled)
  - [x] Production environment (optimized)
  - [ ] Testing environment (isolated)
- [ ] Container orchestration
  - [ ] Create Kubernetes manifests (optional)
  - [ ] Set up Docker Swarm configs (alternative)
  - [ ] Configure auto-scaling policies
- [ ] Docker registry setup
  - [ ] Push images to Docker Hub
  - [ ] Set up GitHub Container Registry
  - [ ] Create versioning strategy
- [x] Create deployment scripts
  - [x] One-command setup script (Makefile)
  - [ ] Database migration in containers
  - [ ] Backup and restore procedures
- [x] Write API documentation (README.md)
- [ ] Create user guides
  - [x] Docker quick start guide
  - [x] Environment configuration guide (.env.example)
  - [ ] Troubleshooting Docker issues
- [ ] Build example agent scripts
- [ ] Performance benchmarking
  - [ ] Container resource usage monitoring
  - [ ] Load testing with containerized environment