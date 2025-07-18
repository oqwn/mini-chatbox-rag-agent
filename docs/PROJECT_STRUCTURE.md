# Project Structure

## Overview

The Mini-Chatbox RAG Agent follows a monorepo structure with separate backend and frontend applications, organized for scalability and maintainability.

## Directory Structure

```
mini-chatbox-rag-agent/
├── .github/                    # GitHub specific files
│   ├── workflows/             # GitHub Actions CI/CD
│   │   └── ci.yml            # Continuous Integration workflow
│   └── CONTRIBUTING.md        # Contribution guidelines
│
├── backend/                    # Backend Node.js/TypeScript application
│   ├── src/                   # Source code
│   │   ├── config/           # Configuration management
│   │   ├── controllers/      # HTTP request handlers
│   │   ├── services/         # Business logic layer
│   │   ├── models/           # Database models (TypeORM entities)
│   │   ├── middleware/       # Express middleware
│   │   └── utils/            # Utility functions
│   ├── tests/                # Test files
│   ├── scripts/              # Utility scripts
│   ├── Dockerfile            # Production Docker image
│   ├── Dockerfile.dev        # Development Docker image
│   ├── package.json          # Backend dependencies
│   ├── tsconfig.json         # TypeScript configuration
│   └── jest.config.js        # Jest testing configuration
│
├── frontend/                   # Frontend React/TypeScript application
│   ├── src/                   # Source code
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Page-level components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client services
│   │   └── utils/            # Utility functions
│   ├── public/               # Static assets
│   ├── Dockerfile            # Production Docker image
│   ├── Dockerfile.dev        # Development Docker image
│   ├── package.json          # Frontend dependencies
│   ├── tsconfig.json         # TypeScript configuration
│   ├── vite.config.ts        # Vite bundler configuration
│   └── index.html            # HTML entry point
│
├── docker/                     # Docker related files
│   ├── nginx/                # Nginx configurations
│   │   ├── nginx.conf        # Main nginx config
│   │   └── default.conf      # Site configuration
│   ├── postgres/             # PostgreSQL configurations
│   ├── docker-compose.yml    # Production compose file
│   ├── docker-compose.dev.yml # Development compose file
│   └── .dockerignore         # Docker ignore patterns
│
├── config/                     # Shared configuration files
│   ├── .eslintrc.json        # ESLint configuration
│   └── .prettierrc           # Prettier configuration
│
├── scripts/                    # Project-wide scripts
│   └── setup.sh              # Development setup script
│
├── agent-scripts/              # Agent script templates
│   └── examples/             # Example agent scripts
│
├── docs/                       # Documentation
│   ├── PROJECT_STRUCTURE.md  # This file
│   └── ...                   # Other documentation
│
├── logs/                       # Application logs (git-ignored)
├── uploads/                    # File uploads (git-ignored)
│
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore patterns
├── architecture.md            # System architecture documentation
├── DEVELOPMENT.md             # Development guide
├── LICENSE                    # MIT License
├── Makefile                   # Common commands
├── package.json               # Root package.json for workspaces
├── README.md                  # Project overview
└── todo.md                    # Project task tracking
```

## Key Concepts

### Monorepo Structure
- Uses npm workspaces to manage both backend and frontend
- Shared configurations in `config/` directory
- Common scripts and tooling at root level

### Backend Architecture
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic, independent of HTTP layer
- **Models**: Database entities using TypeORM
- **Middleware**: Cross-cutting concerns (auth, logging, etc.)
- **Utils**: Shared utilities and helpers

### Frontend Architecture
- **Components**: Reusable UI components
- **Pages**: Route-specific page components
- **Hooks**: Custom React hooks for logic reuse
- **Services**: API communication layer
- **Utils**: Helper functions and constants

### Docker Organization
- All Docker-related files in `docker/` directory
- Separate development and production configurations
- Symbolic links in root for backward compatibility

### Configuration Management
- Environment variables via `.env` files
- Shared linting/formatting configs in `config/`
- TypeScript configs per workspace

## Development Workflow

1. **Setup**: Run `./scripts/setup.sh` for initial setup
2. **Development**: Use `make dev` or `npm run dev`
3. **Testing**: Run tests with `npm test`
4. **Building**: Build with `npm run build`
5. **Deployment**: Use Docker Compose for deployment

## Best Practices

1. Keep business logic in services, not controllers
2. Use TypeScript strict mode
3. Write tests for critical functionality
4. Follow the established file naming conventions
5. Update documentation when adding new features