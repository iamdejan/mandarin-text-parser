# AGENTS.md

This project is a PNPM workspace, split into 2 packages:

## Backend

- Location: `./apps/backend`
- Programming language: Rust
- Package manager: Cargo
  - Cargo file: `./apps/backend/Cargo.toml`
  - Cargo lock file: `./apps/backend/Cargo.lock`
- Framework: Axum

### Code Generation

Make sure you adhere to the guide on this file to generate the code.

#### Rules of engagement

1. You're allowed to create functions, structs and impl blocks to generate the code.
2. With the exception of import statements and Cargo macros (allow and deny), explain the flow of the program using comments. Make sure that you write not only what the program is doing, but why. It will help me to judge your work.
3. You have to add Rustdoc. The Rustdoc should contain what is the function for (basically the description), a brief summary of the steps, and input and output parameters. If your function has the ability to throw panic, please state it in the Rustdoc as well.
4. You're not allowed to add `#[allow(dead_code)]`.
5. You have to add unit tests as well.

### Code Validation

After generating the code, make sure you validate the code you generated.

#### Steps to Validate

Run these commands in sequence:
1. `cargo fmt`: format your code. This ensures that the code written by human and by you (coding agent) are consistent, following the style that Rust has provided.
2. `cargo clippy -- -D warnings`: ensure no linter errors.
3. `cargo clippy --fix --allow-dirty`: if there is any linter error, fix it with this command.
4. `cargo clippy -- -D warnings`: recheck again, maybe there are linter errors that need manual fix.
5. `cargo test`: build the code, then run all unit tests. This ensures that the code you generate pass all the unit tests.

### Update Documentation

After code validation is finished, update the project tree structure and file descriptions in README.md if needed. This is to ensure we always have updated documentation.

### Tooling

You're allowed to use skills provided in `./skills` folder, especially `rust-skill`.

## Frontend

- Location: `./apps/frontend`
- Programming language: TypeScript
  - TypeScript configuration files:
    - `./apps/frontend/tsconfig.json`
- Package manager: PNPM
  - Monorepo package file: `./package.json`
  - Package file: `./apps/frontend/package.json`
  - Lock file: `./apps/frontend/pnpm.lock`
- Framework: SolidJS
- Bundler: Vite
  - Configuration file: `./apps/frontend/vite.config.ts`

### Code Generation

Make sure you adhere to the guide on this file to generate the code.

#### Rules of engagement

1. You're allowed to create functions, structs and impl blocks to generate the code.
2. With the exception of import statements and Cargo macros (allow and deny), explain the flow of the program using comments. Make sure that you write not only what the program is doing, but why. It will help me to judge your work.
3. You have to add JSDoc. The JSDoc should contain what is the function for (basically the description), a brief summary of the steps, and input and output parameters. If your function has the ability to throw error, please state it in the JSDoc as well.
4. You're not allowed to add `// @ts-ignore` and/or `// @ts-nocheck`.
5. You have to add unit tests as well. Follow the examples from `https://github.com/iamdejan/solidjs-typescript-template/blob/main/src/App.test.tsx` for more information.

### Code Validation

After generating the code, make sure you validate the code you generated.

#### Steps to Validate

Run these commands in sequence:
1. `pnpm run lint`: ensure no linter errors.
2. `pnpm run lint:fix`: if there is any linter error, fix it with this command.
3. `pnpm run lint`: recheck again, maybe there are linter errors that need manual fix.
4. `pnpm run build`: build the code. This ensures that there are no build errors.
5. `pnpm run test:ci`: run all unit tests.

### Update Documentation

After the validation is finished, update the project tree structure and file descriptions in README.md if needed. This is to ensure we always have updated documentation.
