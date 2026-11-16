# Requirements — MCP Moodle ITESCAM

**Project:** Moodle ITESCAM MCP Server  
**Version:** 1.0.0  
**Status:** Requirements Definition  
**Date:** 2026-11-16  
**Target platform:** https://moodle.itescam.edu.mx/moodle4/  
**Product type:** Model Context Protocol (MCP) Server

---

# 1. Project Overview

## 1.1. Description

Develop an MCP (Model Context Protocol) server that enables AI assistants to interact with the ITESCAM Moodle platform through structured, secure, and reusable tools.

The system will act as an integration layer between AI agents and Moodle, allowing them to retrieve academic information, navigate courses, inspect assignments, monitor activities, and execute authorized operations.

The primary objective is to build an autonomous academic assistant capable of managing Moodle interactions through natural language.

The MCP server must be compatible with MCP clients such as:

- Claude Desktop.
- Claude Code.
- OpenAI Codex.
- Other MCP-compatible clients.

## 1.2. Target Platform

**Moodle instance:**

https://moodle.itescam.edu.mx/moodle4/

**Login endpoint:**

https://moodle.itescam.edu.mx/moodle4/login/index.php

The platform is identified as Administrador de Cursos del ITESCAM and uses Moodle.

The exact Moodle version, enabled services, available endpoints, permissions, and authenticated functionality must be discovered during the initial technical investigation.

## 1.3. Core Vision

Build an AI-accessible interface that allows a student to manage their academic activities without manually navigating Moodle.

Example interactions:

- "Show me my enrolled courses."
- "What assignments do I have pending?"
- "Check the deadlines for this week."
- "Open my Operating Systems course."
- "Show the latest announcements."
- "Submit this assignment."
- "Check my grades."
- "Download the material from my Networking course."

The AI assistant should interpret the request, select the appropriate MCP tools, execute the operation, and return structured results.

---

# 2. Project Objectives

## 2.1. Primary Objectives

1. Integrate Moodle ITESCAM with MCP-compatible AI clients.
2. Provide a structured collection of tools for interacting with Moodle.
3. Automate repetitive academic management tasks.
4. Enable authenticated access to student-specific information.
5. Support both information retrieval and authorized operations.
6. Provide reliable error handling and structured responses.
7. Maintain security and protect user credentials.

## 2.2. Secondary Objectives

- Support multiple Moodle accounts in future versions.
- Provide academic activity summaries.
- Enable intelligent deadline monitoring.
- Support document and resource downloads.
- Enable automated assignment submission.
- Provide an extensible architecture for additional Moodle functionality.

---

# 3. Scope

## 3.1. In Scope

The initial system will focus on the student experience.

| Module         | Description                               |
| -------------- | ----------------------------------------- |
| Authentication | Authenticate and maintain Moodle sessions |
| User Profile   | Retrieve student information              |
| Courses        | List and inspect enrolled courses         |
| Assignments    | Retrieve assignments and deadlines        |
| Grades         | Consult available grades                  |
| Announcements  | Retrieve course announcements             |
| Calendar       | Retrieve academic events                  |
| Resources      | List and download course materials        |
| Submissions    | Manage authorized assignment submissions  |
| Navigation     | Navigate Moodle sections and activities   |

## 3.2. Out of Scope — Initial Release

- Modifying Moodle's internal database.
- Bypassing authentication mechanisms.
- Bypassing CAPTCHA or MFA protections.
- Modifying student grades.
- Changing institutional records.
- Accessing other students' private information.
- Administrative management of Moodle.
- Automatic submission without user authorization.
- Circumventing institutional restrictions.

---

# 4. Technical Investigation

Before implementation, the development team MUST determine the available integration mechanisms.

## 4.1. Integration Strategy

The system will support two possible integration mechanisms.

### Strategy A — Moodle Web Services API

Preferred integration method.

Investigate:

- Whether Web Services are enabled.
- Whether REST is available.
- Whether student accounts can obtain authorized tokens.
- Which external functions are available.
- Whether the required functions have sufficient permissions.

Potential endpoint:

`/moodle4/webservice/rest/server.php`

The actual availability of this endpoint and its functions must be verified.

Relevant Moodle functions to investigate:

- `core_webservice_get_site_info`
- `core_course_get_courses`
- `core_enrol_get_users_courses`
- `mod_assign_get_assignments`
- `mod_assign_get_submissions`
- `gradereport_user_get_grade_items`
- `core_calendar_get_calendar_events`
- `core_course_get_contents`

These are candidate Moodle external functions, not confirmed capabilities of the ITESCAM installation.

### Strategy B — Browser Automation

Fallback integration method when the required Web Services functionality is unavailable.

Technology:

- Playwright.
- Chromium.
- Persistent browser context.
- DOM-based interaction.
- Session and cookie management.

Browser automation must interact with Moodle through its actual user interface.

Requirements:

1. Authenticate using the user's own credentials.
2. Maintain an authenticated session.
3. Navigate Moodle pages.
4. Extract visible information.
5. Interact with forms and buttons.
6. Download available resources.
7. Detect expired sessions.
8. Handle navigation errors.

Browser automation must not attempt to bypass security controls.

### Integration Priority

1. Moodle Web Services API.
2. Browser automation.
3. Report unavailable functionality when neither mechanism supports the requested operation.

The application must use an abstraction layer so that changing the integration mechanism does not require rewriting MCP tools.

---

# 5. Functional Requirements

## FR-01 — Authentication

The system MUST provide secure authentication to Moodle.

Requirements:

- Authenticate using the user's credentials when using browser authentication.
- Support authorized Web Services tokens when available.
- Persist authenticated sessions securely.
- Detect invalid credentials.
- Detect expired sessions.
- Allow users to disconnect.
- Never expose passwords or authentication tokens to the AI model.

Acceptance criteria:

- The user can establish an authenticated session.
- The server can determine whether the session is valid.
- Invalid authentication returns a structured error.
- Sensitive credentials are never included in tool responses.

## FR-02 — User Profile

The system MUST retrieve the authenticated user's profile.

Expected information:

- Full name.
- Username, when available.
- Email, when available.
- User ID.
- Profile URL.

Acceptance criteria:

- Only the authenticated user's profile is accessible.
- Missing fields are handled gracefully.

## FR-03 — Course Management

The system MUST provide access to the user's enrolled courses.

Capabilities:

- List enrolled courses.
- Retrieve course details.
- Retrieve course sections.
- List course activities.
- Identify course URLs.
- Search courses by name.

Acceptance criteria:

- Return structured course information.
- Support filtering by course name.
- Distinguish between unavailable and inaccessible courses.

## FR-04 — Assignment Management

The system MUST retrieve assignment information.

Capabilities:

- List assignments.
- Retrieve assignment details.
- Check submission status.
- Retrieve submission deadlines.
- Identify overdue assignments.
- Retrieve assignment instructions.
- Inspect available submission information.

Expected fields:

- Assignment ID.
- Course ID.
- Assignment name.
- Description.
- Due date.
- Cut-off date, if available.
- Submission status.
- Grade, if available.
- Submission URL.

Acceptance criteria:

- Dates must be returned in a consistent ISO 8601 format.
- Missing deadlines must not be interpreted as overdue.
- Submission status must distinguish between submitted, pending, overdue, and unknown where the source supports those distinctions.

## FR-05 — Grade Management

The system MUST retrieve available student grades.

Capabilities:

- List grades by course.
- Retrieve individual grade items.
- Retrieve final course grades when available.
- Identify ungraded activities.

The system MUST NOT attempt to modify grades.

## FR-06 — Announcements

The system MUST retrieve course announcements and relevant discussion information.

Capabilities:

- List recent announcements.
- Filter announcements by course.
- Retrieve announcement details.
- Retrieve publication dates.
- Provide links to original Moodle content.

## FR-07 — Calendar

The system MUST retrieve academic events.

Capabilities:

- List upcoming events.
- Filter by date range.
- Retrieve assignment deadlines.
- Retrieve course events.
- Identify events for the current week.

The server must use the Moodle timezone or a verified user timezone when interpreting dates.

## FR-08 — Course Resources

The system MUST allow users to inspect course resources.

Capabilities:

- List downloadable resources.
- Retrieve resource metadata.
- Identify resource types.
- Download authorized files.
- Return file names and metadata.

Supported formats should initially include:

- PDF.
- DOCX.
- XLSX.
- PPTX.
- ZIP.
- Images.
- Other files supported by Moodle.

## FR-09 — Assignment Submission

The system SHOULD support authorized assignment submissions.

Capabilities:

- Upload files.
- Submit assignments.
- Inspect submission status.
- Confirm successful submission.

Security requirements:

- The user must explicitly approve the submission.
- The system must validate the destination assignment.
- The system must verify the uploaded file.
- The system must confirm the final submission state.

The agent must never claim that an assignment was submitted without receiving confirmation from Moodle.

## FR-10 — Intelligent Academic Summary

The system SHOULD provide consolidated academic information.

Example:

"Give me a summary of my academic activities this week."

The agent should combine:

- Upcoming assignments.
- Overdue assignments.
- Upcoming events.
- Recent announcements.
- Available grades.

The summary must be based on actual Moodle data.

---

# 6. MCP Server Specification

## 6.1. MCP Architecture

The application MUST expose Moodle functionality through MCP tools.

Each tool must have:

- A unique name.
- A clear description.
- A validated input schema.
- A structured output.
- Error handling.
- Authentication requirements.

## 6.2. Initial MCP Tools

The following tools define the proposed initial interface.

### Authentication Tools

| Tool                 | Description                        |
| -------------------- | ---------------------------------- |
| `moodle_login`       | Establish an authenticated session |
| `moodle_logout`      | Terminate the session              |
| `moodle_auth_status` | Check authentication status        |

### User Tools

| Tool                 | Description                         |
| -------------------- | ----------------------------------- |
| `moodle_get_profile` | Retrieve authenticated user profile |

### Course Tools

| Tool                         | Description                       |
| ---------------------------- | --------------------------------- |
| `moodle_get_courses`         | List enrolled courses             |
| `moodle_get_course`          | Retrieve course details           |
| `moodle_get_course_contents` | Retrieve sections and activities  |
| `moodle_search_courses`      | Search available enrolled courses |

### Assignment Tools

| Tool                           | Description                     |
| ------------------------------ | ------------------------------- |
| `moodle_get_assignments`       | List assignments                |
| `moodle_get_assignment`        | Retrieve assignment details     |
| `moodle_get_submission_status` | Inspect submission status       |
| `moodle_submit_assignment`     | Submit an authorized assignment |

### Grade Tools

| Tool                       | Description                           |
| -------------------------- | ------------------------------------- |
| `moodle_get_grades`        | Retrieve student grades               |
| `moodle_get_course_grades` | Retrieve grades for a specific course |

### Calendar Tools

| Tool                            | Description                 |
| ------------------------------- | --------------------------- |
| `moodle_get_calendar_events`    | Retrieve calendar events    |
| `moodle_get_upcoming_deadlines` | Retrieve upcoming deadlines |

### Announcement Tools

| Tool                       | Description                   |
| -------------------------- | ----------------------------- |
| `moodle_get_announcements` | Retrieve announcements        |
| `moodle_get_announcement`  | Retrieve announcement details |

### Resource Tools

| Tool                       | Description                     |
| -------------------------- | ------------------------------- |
| `moodle_get_resources`     | List course resources           |
| `moodle_download_resource` | Download an authorized resource |

**Important:** These tools represent the target MCP interface. Their implementation must depend on verified Moodle capabilities.

---

# 7. Non-Functional Requirements

## NFR-01 — Security

- Credentials must never be hardcoded.
- Secrets must be stored outside source code.
- Use environment variables or an appropriate secure credential store.
- Authentication tokens must never appear in logs.
- HTTPS must be used for remote communication.
- Validate all tool inputs.
- Prevent unauthorized access to other users' data.
- Apply least-privilege principles.
- Restrict file downloads to authorized Moodle resources.

## NFR-02 — Reliability

- Detect Moodle connection failures.
- Handle session expiration.
- Implement reasonable timeouts.
- Retry only safe, idempotent operations.
- Avoid duplicate assignment submissions.
- Return meaningful errors.

## NFR-03 — Performance

- Avoid unnecessary browser navigation.
- Reuse authenticated sessions.
- Use API requests whenever available.
- Implement pagination when necessary.
- Cache non-sensitive data only when appropriate.

## NFR-04 — Maintainability

- Modular architecture.
- Clear separation of responsibilities.
- Typed interfaces.
- Centralized error handling.
- Automated testing.
- Documented MCP tools.

## NFR-05 — Compatibility

The server should support:

- Claude Desktop.
- Claude Code.
- Codex.
- Other compatible MCP clients.

## NFR-06 — Observability

The system should provide:

- Structured logs.
- Operation status.
- Error classification.
- Execution timing.
- Debug mode.

Logs must not contain credentials, tokens, or unnecessary personal information.

---

# 8. Proposed Technology Stack

| Component          | Technology                            |
| ------------------ | ------------------------------------- |
| Runtime            | Node.js                               |
| Language           | TypeScript                            |
| MCP implementation | Official MCP TypeScript SDK           |
| Browser automation | Playwright                            |
| Input validation   | Zod                                   |
| HTTP client        | Native fetch / compatible HTTP client |
| Testing            | Vitest                                |
| Browser testing    | Playwright Test                       |
| Logging            | Pino                                  |
| Configuration      | dotenv                                |
| Package manager    | npm                                   |
| Version control    | Git                                   |

The exact dependency versions must be selected during project initialization and locked in the package lockfile.

---

# 9. Proposed Architecture

The application MUST implement a modular architecture.

```text
MCP CLIENT
    |
    v
MCP SERVER
    |
    v
TOOL REGISTRY
    |
    v
APPLICATION SERVICES
    |
    v
MOODLE ADAPTER
    |
    +---------------------+
    |                     |
    v                     v
MOODLE API           PLAYWRIGHT
    |                     |
    +----------+----------+
               |
               v
        MOODLE ITESCAM
```

## 9.1. Architectural Layers

### MCP Layer

Responsibilities:

- Register MCP tools.
- Validate tool inputs.
- Serialize responses.
- Handle MCP protocol communication.

### Application Layer

Responsibilities:

- Implement academic use cases.
- Coordinate operations.
- Apply authorization rules.
- Handle business logic.

### Domain Layer

Responsibilities:

- Define core entities.
- Define application interfaces.
- Define business rules.
- Define error types.

### Infrastructure Layer

Responsibilities:

- Implement Moodle API integration.
- Implement browser automation.
- Manage authentication sessions.
- Manage downloads.
- Handle external communication.

## 9.2. Moodle Adapter Interface

All Moodle integrations must implement a common interface.

The application must not depend directly on Playwright or Moodle HTTP endpoints from the MCP tool definitions.

Example conceptual interface:

```typescript
interface MoodleAdapter {
  authenticate(): Promise<AuthResult>;

  getProfile(): Promise<UserProfile>;

  getCourses(): Promise<Course[]>;

  getCourseContents(courseId: number): Promise<CourseSection[]>;

  getAssignments(): Promise<Assignment[]>;

  getGrades(courseId?: number): Promise<Grade[]>;

  getCalendarEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
}
```

Additional methods can be introduced as new requirements are implemented.

---

# 10. Suggested Project Structure

```text
moodle-itescam-mcp/
│
├── src/
│   ├── index.ts
│   │
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── tool-registry.ts
│   │   └── schemas/
│   │
│   ├── application/
│   │   ├── services/
│   │   └── use-cases/
│   │
│   ├── domain/
│   │   ├── entities/
│   │   ├── interfaces/
│   │   └── errors/
│   │
│   ├── infrastructure/
│   │   ├── moodle/
│   │   │   ├── api/
│   │   │   ├── browser/
│   │   │   └── adapters/
│   │   │
│   │   ├── authentication/
│   │   ├── browser/
│   │   └── logging/
│   │
│   ├── shared/
│   │   ├── config/
│   │   ├── types/
│   │   └── utils/
│   │
│   └── config/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── architecture.md
│   ├── moodle-investigation.md
│   └── mcp-tools.md
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── requirements.md
└── LICENSE
```

This structure is a starting proposal and may evolve as implementation decisions are validated.

---

# 11. Authorization and Autonomy Model

The agent must distinguish between read operations and write operations.

## 11.1. Read Operations

Examples:

- View courses.
- Check grades.
- Read announcements.
- Inspect assignments.
- Download resources.

These operations can execute without additional confirmation once the user has authenticated and granted access.

## 11.2. Write Operations

Examples:

- Submit assignments.
- Upload files.
- Post messages.
- Modify editable content.

These operations require explicit user confirmation before execution.

## 11.3. Prohibited Operations

The agent must never:

- Modify grades.
- Change academic records.
- Access another student's account.
- Bypass authentication.
- Circumvent institutional security controls.
- Execute destructive actions without authorization.

## 11.4. Human-in-the-Loop

The server must provide sufficient information for the AI client to request confirmation.

Example:

User: "Submit my Networking assignment."

Agent:

1. Identify the course.
2. Identify the assignment.
3. Verify the selected file.
4. Present the destination and file to the user.
5. Request explicit confirmation.
6. Execute the submission.
7. Verify the resulting Moodle status.

---

# 12. Error Handling

The system MUST implement standardized error categories.

| Error                     | Description                               |
| ------------------------- | ----------------------------------------- |
| `AUTH_REQUIRED`           | Authentication required                   |
| `AUTH_FAILED`             | Invalid credentials                       |
| `SESSION_EXPIRED`         | Moodle session expired                    |
| `MOODLE_UNAVAILABLE`      | Moodle cannot be reached                  |
| `RESOURCE_NOT_FOUND`      | Requested resource not found              |
| `PERMISSION_DENIED`       | Insufficient permissions                  |
| `VALIDATION_ERROR`        | Invalid tool parameters                   |
| `OPERATION_FAILED`        | Moodle operation failed                   |
| `CONFIRMATION_REQUIRED`   | Explicit authorization required           |
| `INTEGRATION_UNSUPPORTED` | Required Moodle functionality unavailable |

Every error must provide:

- Error code.
- Human-readable message.
- Operation context.
- Recovery suggestion when appropriate.

Sensitive information must never be included in error messages.

---

# 13. Testing Strategy

## Unit Testing

Test:

- Input validation.
- Application services.
- Domain logic.
- Error handling.
- Data transformations.

## Integration Testing

Test:

- Moodle API communication.
- Authentication.
- Session management.
- Adapter implementations.
- MCP tool execution.

## End-to-End Testing

Test complete user workflows:

1. Authenticate.
2. Retrieve user profile.
3. List enrolled courses.
4. Retrieve course contents.
5. Retrieve assignments.
6. Inspect grades.
7. Retrieve calendar events.
8. Download a resource.
9. Submit an assignment with explicit authorization.

## Security Testing

Test:

- Credential exposure.
- Unauthorized operations.
- Session expiration.
- Invalid tool parameters.
- Cross-user data isolation.
- File access restrictions.
- Duplicate write operations.

Use test accounts and authorized environments. Never perform destructive tests against real academic records.

---

# 14. Development Roadmap

## Phase 0 — Discovery and Feasibility

Objective: Understand the actual Moodle ITESCAM environment.

Tasks:

- Inspect the login page.
- Identify Moodle version if possible.
- Investigate Web Services availability.
- Determine available REST functions.
- Evaluate authentication options.
- Inspect the authenticated student interface using an authorized account.
- Identify browser automation constraints.
- Document integration decisions.

Deliverable: `docs/moodle-investigation.md`

Exit criteria:

- A verified authentication strategy.
- A verified integration strategy.
- A list of supported Moodle capabilities.

## Phase 1 — MCP Foundation

Objective: Establish a functional MCP server.

Tasks:

- Initialize TypeScript project.
- Configure MCP SDK.
- Implement server initialization.
- Implement tool registration.
- Implement standardized errors.
- Configure logging.
- Configure environment variables.
- Test connection using an MCP client.

Deliverable: Functional MCP server with an authentication status tool.

## Phase 2 — Authentication and Courses

Objective: Enable authenticated academic information retrieval.

Tasks:

- Implement Moodle authentication.
- Implement session persistence.
- Implement profile retrieval.
- Implement enrolled course retrieval.
- Implement course details.
- Implement course contents.

Deliverable: The AI assistant can authenticate and navigate enrolled courses.

## Phase 3 — Academic Information

Objective: Implement core academic functionality.

Tasks:

- Assignment retrieval.
- Submission status.
- Grades.
- Announcements.
- Calendar events.
- Deadline filtering.

Deliverable: Complete academic information retrieval.

## Phase 4 — Resources and Documents

Objective: Enable resource management.

Tasks:

- Resource discovery.
- File metadata.
- Authorized downloads.
- Download validation.
- File handling.

Deliverable: The agent can locate and retrieve course resources.

## Phase 5 — Authorized Operations

Objective: Enable controlled academic actions.

Tasks:

- Assignment uploads.
- Submission workflows.
- Explicit authorization.
- Submission verification.
- Duplicate operation protection.

Deliverable: Controlled assignment submission.

## Phase 6 — Optimization and Release

Objective: Prepare the server for regular use.

Tasks:

- Improve performance.
- Improve error handling.
- Expand automated tests.
- Improve documentation.
- Test Claude Code integration.
- Test Codex integration.
- Prepare installation instructions.

Deliverable: Stable, documented MCP server.

---

# 15. Definition of Done

The project MVP will be considered complete when:

- [ ] The MCP server starts successfully.
- [ ] The server connects to at least one MCP client.
- [ ] Authentication works with an authorized account.
- [ ] Session management works.
- [ ] The user profile can be retrieved.
- [ ] Enrolled courses can be listed.
- [ ] Course contents can be inspected.
- [ ] Assignments can be retrieved.
- [ ] Assignment deadlines can be identified.
- [ ] Grades can be retrieved where accessible.
- [ ] Announcements can be retrieved where accessible.
- [ ] Calendar events can be retrieved where accessible.
- [ ] Structured errors are returned.
- [ ] Credentials are protected.
- [ ] Automated tests cover implemented functionality.
- [ ] Documentation explains installation and configuration.

Assignment submission and file uploads are additional release capabilities, not mandatory MVP blockers.

---

# 16. Engineering Principles

The development process MUST follow these principles:

1. Understand the existing Moodle behavior before implementing automation.
2. Prefer official APIs over browser automation.
3. Keep MCP tools independent of the integration mechanism.
4. Avoid unnecessary abstractions.
5. Use TypeScript types and runtime validation.
6. Keep responsibilities separated.
7. Implement small, testable features.
8. Never assume an operation succeeded without verification.
9. Never expose credentials to the language model.
10. Document discovered Moodle behavior.
11. Do not implement functionality that has not been verified.
12. Prioritize reliability over the number of available tools.

---

# 17. Initial Development Instructions

The first development task is NOT to implement all MCP tools.

The first task is to investigate Moodle ITESCAM and establish technical feasibility.

The development agent must:

1. Inspect the public Moodle login page.
2. Identify the Moodle version if possible.
3. Investigate whether Web Services are enabled.
4. Determine whether an authorized student token can be obtained.
5. Identify the required external functions.
6. Evaluate Playwright as a fallback.
7. Document authentication and session behavior.
8. Produce an integration feasibility report.
9. Recommend the initial architecture based on verified findings.

Do not begin implementing the entire system until the integration strategy is established.

---

# 18. References

- ITESCAM Moodle: https://moodle.itescam.edu.mx/moodle4/
- Moodle External Services API: https://moodledev.io/docs/4.5/apis/subsystems/external
- Moodle Web Services Documentation: https://docs.moodle.org/400/en/Web_services_FAQ
- Moodle REST Web Services: https://docs.moodle.org/400/en/Using_web_services
- Model Context Protocol: https://modelcontextprotocol.io/
- Playwright: https://playwright.dev/docs/intro

---

**End of Requirements Specification**

**Document status:** Initial baseline.  
**Next milestone:** Technical Discovery and Integration Feasibility.
