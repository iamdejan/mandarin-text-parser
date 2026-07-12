# SolidJS-Axum Template

A simple full-stack web application template, using SolidJS as frontend and Axum as backend.

## Prerequisites

Before running this project, ensure you have the following installed:
1. **Node.js** (v24 or higher)
2. **PNPM** - Package manager
    ```bash
    npm install -g pnpm
    ```
3. **Rust programming language**, installed using [rustup](https://rustup.rs/).

## Getting Started

1. **Install dependencies:**
    Frontend:
    ```bash
    pnpm run frontend:deps
    ```

    Backend:
    ```bash
    pnpm run backend:build
    ```

2. **Copy and adjust environment variables:**
    In each `backend` and `frontend` packages, there is `.env.example` package. Copy to `.env`, then adjust the values as needed.

3. **Start the development server:**
    Backend:
    ```bash
    pnpm run backend:start
    ```

     Frontend (must wait until the backend starts):
     ```bash
     pnpm run frontend:start
     ```
