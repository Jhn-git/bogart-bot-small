### **Project Plan: Bogart 2.0 Architectural Refactor**

**Project Lead:** Jhn
**Version:** 1.0
**Date:** June 21, 2024

#### **1. Vision & Core Philosophy**

**Objective:** To refactor the Bogart codebase from a monolithic structure into a modular "Core Platform with Pluggable Feature Modules."

**Guiding Principle:** This initiative addresses the feature bloat and tight coupling identified in Bogart 1.0. By separating concerns, we will increase maintainability, improve scalability, and create a stable foundation for future feature development without compromising the bot's core identity.

---

#### **2. Target Architecture**

The end-state architecture will consist of a central **Core Platform** and distinct **Feature Modules**.

*   **Core Platform:** Responsible for fundamental, shared operations:
    *   Application Startup (`main.ts`)
    *   Dependency Injection (`container.ts`)
    *   Core Services (`services/`): Logging, Database, Discord API Interaction, Configuration.
    *   Global Types (`types.ts`)

*   **Feature Modules (`modules/`):** Self-contained units of functionality.
    *   Each module will reside in its own subdirectory (e.g., `modules/wandering/`).
    *   Each module will be responsible for its own logic, services, and commands.
    *   Modules will be loaded dynamically at startup.
    *   **Crucially, modules will not directly import from each other.** All cross-module communication will be handled via core services from the DI container.

---

#### **3. Key Implementation Phases & Requirements**

This refactor will be executed in the following phases:

**Phase 1: Establish the Core Persistence Layer**

*   **Requirement:** Replace all direct file system I/O for state persistence with a centralized database service.
*   **Action Items:**
    1.  **Introduce SQLite:** Integrate `better-sqlite3` or a similar lightweight SQLite library into the project.
    2.  **Create `DatabaseService`:** Implement a new core service at `src/services/database.service.ts`. This service will abstract all database operations (e.g., `get`, `set`, `runQuery`).
    3.  **Update `.gitignore`:** Ensure the new database file (e.g., `data/bogart.sqlite`) and any related journal files are added to `.gitignore`.

**Phase 2: Modularize the "Wandering" Feature**

*   **Requirement:** Migrate the existing Wandering feature to be the first official feature module.
*   **Action Items:**
    1.  **Create Module Directory:** Create a new directory: `src/modules/wandering/`.
    2.  **Move `WanderingService`:** Relocate `src/services/wandering.service.ts` to `src/modules/wandering/wandering.service.ts`.
    3.  **Refactor Persistence:** Remove all `fs` and `path` imports from the new `wandering.service.ts`. All logic related to loading and saving cooldowns (`loadCooldowns`, `saveCooldowns`) must be rewritten to use the new core `DatabaseService`.
    4.  **Update Tests:** Relocate `wandering.service.test.ts` to `src/modules/wandering/__tests__/` and refactor all tests to mock the `DatabaseService` instead of the `fs` module.
    5.  **Create Initializer:** Create `src/modules/wandering/index.ts`. This file will export an `initialize(container)` function responsible for registering the `WanderingService` and any related wandering commands with the DI container.

**Phase 3: Refactor the Core Application for Dynamic Module Loading**

*   **Requirement:** Update the application's core to support the new modular architecture.
*   **Action Items:**
    1.  **Refactor DI Container (`container.ts`):** Modify the `Container` class to allow services to be registered dynamically after its initial construction. The direct instantiation of `WanderingService` and other future module services in the constructor must be removed.
    2.  **Refactor Entry Point (`main.ts`):**
        *   Implement a module loader that scans the `src/modules/` directory.
        *   For each module found, import its `index.ts` and call the exported `initialize(container)` function.
        *   Remove all direct calls to feature-specific services like `wanderingService.start()`. This will now be handled within the module's own initialization logic if needed.

**Phase 4: Cleanup and Verification**

*   **Requirement:** Ensure all remnants of the old architecture are removed and the new system is fully integrated.
*   **Action Items:**
    1.  **Delete Obsolete Files:**
        *   The original `src/services/wandering.service.ts` and its test file.
        *   The `data/cooldowns.json` file.
    2.  **Code-wide Search:** Perform a global search for any remaining import paths pointing to the old service location and update them.
    3.  **Full Test Suite Execution:** Run the entire test suite to ensure all unit and integration tests pass with the new architecture.

---

#### **IV. Proof of Concept: "Movie Night" Module**

Following the successful refactor of the "Wandering" module, the "Movie Night" feature will be re-integrated as a new module to validate the architecture.

*   **Requirement:** Create a `src/modules/movie-night/` module.
*   **Acceptance Criteria:**
    *   It will contain its own services (e.g., `SuggestionService`) and commands (`/add_ingredient`).
    *   All of its data persistence will use the core `DatabaseService`.
    *   It will be loaded and initialized via the new dynamic module loader in `main.ts`.

By completing these phases, Bogart 2.0 will have a robust, decoupled, and scalable architecture, ready for sustainable growth.