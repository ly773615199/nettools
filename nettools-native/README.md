# NetTools

A comprehensive network tool that integrates file management, tunneling, and proxy services into a single application.

## Features

- **File Management**: Manage files across different storage services with ease. Upload, download, and organize your files efficiently.
- **Network Tools**: Create and manage TCP tunnels for port forwarding and proxy services for network optimization.
- **Settings**: Configure system settings, manage storage services, and customize your NetTools experience.

## Project Structure

```
nettools-native/
├── frontend/            # React frontend application
│   ├── src/
│   │   ├── core/        # Core services and utilities
│   │   │   ├── config/  # Configuration service
│   │   │   ├── network/ # Network services (Bore, Clash)
│   │   │   ├── storage/ # Storage services (OpenList)
│   │   │   └── types/   # Type definitions
│   │   ├── pages/       # React components for different pages
│   │   │   ├── HomePage.tsx
│   │   │   ├── FileManagementPage.tsx
│   │   │   ├── NetworkToolsPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── App.tsx      # Main application component
│   │   └── main.tsx     # Application entry point
│   ├── package.json     # Frontend dependencies
│   └── tsconfig.json    # TypeScript configuration
└── README.md           # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm (v9+)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd nettools-native/frontend
```

2. Install dependencies:

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### Build for Production

Build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Core Services

### OpenList Service

- **Description**: A file management service that allows users to manage files across different storage services.
- **Features**: Upload, download, list, delete, and organize files.

### Bore Service

- **Description**: A TCP tunneling service for port forwarding.
- **Features**: Create, start, stop, and delete tunnels.

### Clash Service

- **Description**: A proxy service for network optimization.
- **Features**: Manage proxy connections, test proxy performance, and configure proxy settings.

## Technology Stack

- **Frontend**: React 19, TypeScript, Material UI 7
- **Routing**: React Router
- **Data Management**: React Query
- **Styling**: Material UI
- **Build Tool**: Vite

## License

MIT
