# Requirements Document

## Introduction

This document defines the requirements for a Multi-Tenant Chatbot Platform, an intelligent rule-based conversational system that enables users to create, manage, and deploy multiple domain-specific chatbots. The platform leverages lightweight Natural Language Processing (NLP Lite) techniques including text normalization, tokenization, stemming, and similarity matching to provide smart intent recognition beyond simple keyword matching.

The platform provides user authentication, multi-chatbot project management, and a web-based dashboard where authenticated users can create and manage multiple chatbot projects. Each chatbot project is isolated with its own intents, PDF knowledge base, NLP configuration, and embeddable widget. The system supports optional multi-user collaboration with role-based access control, allowing chatbot owners to invite editors and viewers to their projects.

The platform includes a unified dashboard for managing all chatbot projects, and each chatbot can be independently embedded into external websites via a widget, similar to IBM Watson Assistant. The system is domain-agnostic and can be easily adapted for various use cases including customer service, FAQ systems, academic support, general information bots, and other conversational applications.

**Key Platform Features:**
- User registration, authentication, and profile management
- Multi-chatbot project creation and management (one user can own multiple chatbots)
- Data isolation per chatbot project
- Role-based access control (Owner, Editor, Viewer)
- Unified dashboard showing all user's chatbots with quick stats
- Independent widget embedding per chatbot project

**Technology Stack:**
- Backend: Node.js with Express
- Authentication: JWT or secure session management, bcrypt for password hashing
- NLP Processing: `natural`, `compromise`, or `string-similarity` libraries
- Storage: JSON file-based storage (default), with optional SQLite, MongoDB, or PostgreSQL/MySQL backends
- PDF Processing: `pdf-parse` or `pdf.js` for text extraction
- No paid APIs, no training required, no cloud dependencies

## Glossary

### Platform & User Management Terms
- **Platform**: The multi-tenant chatbot hosting system that manages users and chatbot projects
- **User**: An authenticated individual who can create and manage chatbot projects
- **User_Account**: The stored credentials and profile information for a User
- **Authentication_System**: The component that validates user credentials and manages sessions
- **Session_Token**: A JWT or session identifier used to maintain authenticated user state
- **Password_Hash**: The bcrypt-hashed password stored in the Database
- **User_Profile**: The user's personal information including name, email, and account settings
- **Dashboard**: The main web interface showing all chatbot projects owned by or shared with the User

### Chatbot Project Terms
- **Chatbot_Project**: An isolated chatbot instance with its own intents, knowledge base, configuration, and widget
- **Project_Owner**: The User who created the Chatbot_Project and has full control over it
- **Chatbot_Engine**: The core rule-based matching system that processes user messages and returns responses (scoped per project)
- **Widget**: The embeddable chat interface that can be integrated into external websites (unique per project)
- **Chatbot_Identifier**: A unique ID used to route widget API requests to the correct Chatbot_Project

### Collaboration & Access Control Terms
- **Collaborator**: A User invited to access a Chatbot_Project they don't own
- **Access_Role**: The permission level assigned to a Collaborator (Owner, Editor, or Viewer)
- **Owner_Role**: Full access including project deletion and collaborator management
- **Editor_Role**: Can manage intents, upload PDFs, and configure settings but cannot delete project
- **Viewer_Role**: Read-only access to view intents and configuration
- **Invitation**: A request sent by the Project_Owner to add a Collaborator

### NLP & Intent Management Terms
- **NLP_Processor**: The text processing component that normalizes, tokenizes, stems, and analyzes user input
- **Intent**: A predefined pattern consisting of keywords and a corresponding response (scoped per project)
- **Keyword**: A text pattern used to match user messages to intents
- **Token**: An individual word or meaningful unit extracted from text during tokenization
- **Stemming**: The process of reducing words to their base or root form
- **Stop_Word**: Common words (e.g., "the", "is", "at") removed during text processing to improve matching
- **Similarity_Score**: A numeric value indicating how closely user input matches intent keywords

### Storage & Data Terms
- **Database**: The storage system for users, projects, intents, and responses
- **Storage_Backend**: The underlying database technology used to persist platform data
- **Data_Isolation**: The enforcement of access boundaries ensuring users only access their own or shared projects
- **Knowledge_Base**: The collection of extracted PDF content used for answering user questions (scoped per project)
- **PDF_Processor**: The component that extracts text content from uploaded PDF files
- **Document_Library**: The collection of uploaded PDF files (scoped per project)
- **Content_Excerpt**: A relevant text passage retrieved from the Knowledge_Base
- **Source_Reference**: The document name and location information for a Content_Excerpt

### Widget & Embedding Terms
- **Embed_Code**: The JavaScript snippet that allows external websites to integrate the Widget
- **Widget_API_Endpoint**: The API endpoint that accepts the Chatbot_Identifier to route requests

## Requirements

## Platform Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to register for an account, so that I can create and manage my own chatbot projects

#### Acceptance Criteria

1. THE Platform SHALL provide a registration form accepting email, password, and full name
2. WHEN a registration form is submitted, THE Authentication_System SHALL validate that the email format is valid
3. WHEN a registration form is submitted, THE Authentication_System SHALL validate that the password is at least 8 characters long
4. WHEN a valid registration form is submitted, THE Authentication_System SHALL check if the email is already registered
5. IF the email is already registered, THEN THE Authentication_System SHALL return an error message
6. WHEN registration validation passes, THE Authentication_System SHALL hash the password using bcrypt with a cost factor of 10
7. WHEN password hashing completes, THE Database SHALL store the User_Account with email, Password_Hash, full name, and creation timestamp
8. WHEN User_Account creation succeeds, THE Authentication_System SHALL return a success message

### Requirement 2: User Login

**User Story:** As a registered user, I want to log in to my account, so that I can access my chatbot projects

#### Acceptance Criteria

1. THE Platform SHALL provide a login form accepting email and password
2. WHEN login credentials are submitted, THE Authentication_System SHALL retrieve the User_Account matching the email
3. IF no User_Account matches the email, THEN THE Authentication_System SHALL return an "Invalid credentials" error
4. WHEN a User_Account is found, THE Authentication_System SHALL compare the provided password with the stored Password_Hash using bcrypt
5. IF the password comparison fails, THEN THE Authentication_System SHALL return an "Invalid credentials" error
6. WHEN password verification succeeds, THE Authentication_System SHALL generate a Session_Token with user ID and email
7. THE Session_Token SHALL expire after 24 hours of inactivity
8. WHEN token generation succeeds, THE Authentication_System SHALL return the Session_Token to the client
9. THE authentication process SHALL complete within 2 seconds

### Requirement 3: Session Management

**User Story:** As a logged-in user, I want my session to persist across page refreshes, so that I don't have to log in repeatedly

#### Acceptance Criteria

1. THE Platform SHALL validate the Session_Token on every authenticated API request
2. WHEN a Session_Token is provided, THE Authentication_System SHALL verify the token signature and expiration
3. IF the Session_Token is invalid or expired, THEN THE Authentication_System SHALL return a 401 Unauthorized error
4. WHEN the Session_Token is valid, THE Authentication_System SHALL extract the user ID and attach it to the request context
5. THE Platform SHALL provide a logout endpoint that invalidates the Session_Token
6. WHEN a user logs out, THE Authentication_System SHALL blacklist the Session_Token until its expiration

### Requirement 4: Password Reset

**User Story:** As a user who forgot my password, I want to reset it, so that I can regain access to my account

#### Acceptance Criteria

1. THE Platform SHALL provide a "Forgot Password" form accepting an email address
2. WHEN a password reset is requested, THE Authentication_System SHALL generate a unique reset token with 1-hour expiration
3. WHEN the reset token is generated, THE Database SHALL store the token associated with the User_Account
4. THE Platform SHALL provide a password reset form accepting the reset token and new password
5. WHEN a new password is submitted, THE Authentication_System SHALL validate that the reset token exists and is not expired
6. IF the reset token is invalid or expired, THEN THE Authentication_System SHALL return an error
7. WHEN the reset token is valid, THE Authentication_System SHALL hash the new password using bcrypt
8. WHEN hashing completes, THE Database SHALL update the User_Account with the new Password_Hash and invalidate the reset token

### Requirement 5: User Profile Management

**User Story:** As a user, I want to view and update my profile information, so that I can keep my account details current

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to retrieve the authenticated User_Profile
2. WHEN profile information is requested, THE Platform SHALL return the user's full name, email, and account creation date
3. THE Platform SHALL exclude the Password_Hash from profile responses
4. THE Platform SHALL provide an API endpoint to update the User_Profile
5. WHEN profile update is requested, THE Platform SHALL allow updating full name only
6. THE Platform SHALL prevent email changes without email verification
7. WHEN profile update succeeds, THE Database SHALL save the changes and return the updated User_Profile

### Requirement 6: Change Password

**User Story:** As a logged-in user, I want to change my password, so that I can maintain account security

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to change password accepting current password and new password
2. WHEN password change is requested, THE Authentication_System SHALL verify the current password against the stored Password_Hash
3. IF current password verification fails, THEN THE Authentication_System SHALL return an "Current password incorrect" error
4. WHEN current password is verified, THE Authentication_System SHALL validate that the new password is at least 8 characters long
5. WHEN new password validation passes, THE Authentication_System SHALL hash the new password using bcrypt
6. WHEN hashing completes, THE Database SHALL update the Password_Hash for the User_Account

## Chatbot Project Management Requirements

### Requirement 7: Create Chatbot Project

**User Story:** As a user, I want to create a new chatbot project, so that I can build a chatbot for my specific use case

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to create a Chatbot_Project requiring authentication
2. WHEN project creation is requested, THE Platform SHALL accept a project name, description, and optional domain selection
3. THE Platform SHALL validate that the project name is between 3 and 100 characters
4. WHEN validation passes, THE Platform SHALL generate a unique Chatbot_Identifier for the project
5. WHEN Chatbot_Identifier is generated, THE Database SHALL store the Chatbot_Project with name, description, domain, Chatbot_Identifier, Project_Owner ID, and creation timestamp
6. THE Database SHALL initialize an empty Intent collection for the Chatbot_Project
7. THE Database SHALL initialize an empty Document_Library for the Chatbot_Project
8. THE Database SHALL create default NLP configuration for the Chatbot_Project
9. WHEN project creation succeeds, THE Platform SHALL return the Chatbot_Project details including Chatbot_Identifier

### Requirement 8: List User's Chatbot Projects

**User Story:** As a user, I want to see all my chatbot projects in one place, so that I can quickly access the one I need

#### Acceptance Criteria

1. THE Dashboard SHALL provide an API endpoint to list all Chatbot_Projects owned by or shared with the authenticated user
2. WHEN projects are requested, THE Database SHALL retrieve all projects where the user is the Project_Owner or a Collaborator
3. THE Dashboard SHALL return project name, description, creation date, Access_Role, and quick stats for each project
4. THE quick stats SHALL include the number of Intents, number of PDFs, and total messages handled
5. THE Dashboard SHALL sort projects by last modified date (most recent first)
6. THE Dashboard SHALL complete project listing within 1 second

### Requirement 9: View Chatbot Project Details

**User Story:** As a user, I want to view the details of a specific chatbot project, so that I can manage its configuration

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to retrieve Chatbot_Project details requiring authentication and Chatbot_Identifier
2. WHEN project details are requested, THE Platform SHALL verify the user has access to the Chatbot_Project (Owner, Editor, or Viewer)
3. IF the user lacks access, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN access is verified, THE Database SHALL retrieve project name, description, domain, Chatbot_Identifier, NLP configuration, and collaborators list
5. THE Platform SHALL return the complete project details with the user's Access_Role

### Requirement 10: Update Chatbot Project

**User Story:** As a project owner or editor, I want to update my chatbot project settings, so that I can refine its configuration

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to update a Chatbot_Project requiring authentication and Chatbot_Identifier
2. WHEN project update is requested, THE Platform SHALL verify the user has Owner_Role or Editor_Role
3. IF the user has Viewer_Role, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN access is verified, THE Platform SHALL allow updating project name, description, and domain
5. THE Platform SHALL validate that updated name is between 3 and 100 characters
6. WHEN validation passes, THE Database SHALL save the changes and update the last modified timestamp

### Requirement 11: Delete Chatbot Project

**User Story:** As a project owner, I want to delete a chatbot project, so that I can remove projects I no longer need

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to delete a Chatbot_Project requiring authentication and Chatbot_Identifier
2. WHEN project deletion is requested, THE Platform SHALL verify the user has Owner_Role
3. IF the user lacks Owner_Role, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN Owner_Role is verified, THE Database SHALL delete all Intents associated with the Chatbot_Project
5. THE Database SHALL delete all PDF files and Knowledge_Base content associated with the Chatbot_Project
6. THE Database SHALL delete all collaborator access records for the Chatbot_Project
7. THE Database SHALL delete the Chatbot_Project record
8. THE Platform SHALL confirm deletion was successful

### Requirement 12: Search and Filter Projects

**User Story:** As a user with many chatbot projects, I want to search and filter them, so that I can quickly find the one I need

#### Acceptance Criteria

1. THE Dashboard SHALL provide search functionality accepting a text query
2. WHEN a search query is provided, THE Dashboard SHALL filter projects by name or description containing the query text
3. THE Dashboard SHALL provide filter functionality for project domain
4. WHEN a domain filter is applied, THE Dashboard SHALL show only projects matching the selected domain
5. THE Dashboard SHALL provide filter functionality for Access_Role
6. WHEN role filter is applied, THE Dashboard SHALL show only projects where the user has the specified role

## Multi-User Collaboration Requirements

### Requirement 13: Invite Collaborator

**User Story:** As a project owner, I want to invite other users to collaborate on my chatbot, so that my team can work together

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to invite a Collaborator requiring authentication, Chatbot_Identifier, and target user email
2. WHEN invitation is requested, THE Platform SHALL verify the user has Owner_Role for the Chatbot_Project
3. IF the user lacks Owner_Role, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN Owner_Role is verified, THE Platform SHALL validate the target email corresponds to an existing User_Account
5. IF the target email doesn't exist, THEN THE Platform SHALL return an error
6. THE Platform SHALL accept an Access_Role parameter (Editor_Role or Viewer_Role) for the invitation
7. WHEN validation passes, THE Database SHALL create a collaborator record linking the User_Account to the Chatbot_Project with the specified Access_Role
8. THE Platform SHALL prevent inviting the same user multiple times to the same project

### Requirement 14: Remove Collaborator

**User Story:** As a project owner, I want to remove collaborators from my chatbot, so that I can control who has access

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to remove a Collaborator requiring authentication, Chatbot_Identifier, and target user ID
2. WHEN collaborator removal is requested, THE Platform SHALL verify the user has Owner_Role
3. IF the user lacks Owner_Role, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN Owner_Role is verified, THE Database SHALL delete the collaborator record
5. THE Platform SHALL prevent the Project_Owner from removing themselves

### Requirement 15: Change Collaborator Role

**User Story:** As a project owner, I want to change a collaborator's role, so that I can adjust their permission level

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to change a Collaborator's Access_Role
2. WHEN role change is requested, THE Platform SHALL verify the user has Owner_Role
3. IF the user lacks Owner_Role, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN Owner_Role is verified, THE Platform SHALL accept the new Access_Role (Editor_Role or Viewer_Role)
5. THE Database SHALL update the collaborator record with the new Access_Role
6. THE Platform SHALL prevent changing the Project_Owner's role

### Requirement 16: List Collaborators

**User Story:** As a project owner, I want to see all collaborators on my chatbot, so that I know who has access

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to list all Collaborators for a Chatbot_Project
2. WHEN collaborators are requested, THE Platform SHALL verify the user has access to the Chatbot_Project
3. IF the user lacks access, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN access is verified, THE Database SHALL retrieve all collaborator records for the project
5. THE Platform SHALL return each collaborator's full name, email, Access_Role, and date added

### Requirement 17: Leave Project

**User Story:** As a collaborator, I want to leave a chatbot project, so that I can remove myself from projects I no longer work on

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to leave a Chatbot_Project
2. WHEN leave request is received, THE Platform SHALL verify the user is a Collaborator (not Owner_Role)
3. IF the user is the Project_Owner, THEN THE Platform SHALL return an error indicating owners cannot leave their own projects
4. WHEN Collaborator status is verified, THE Database SHALL delete the collaborator record
5. THE Platform SHALL confirm the user has been removed from the project

## Data Isolation Requirements

### Requirement 18: Enforce Project Access Control

**User Story:** As a user, I want my chatbot data to be private, so that other users cannot access or modify my projects without permission

#### Acceptance Criteria

1. WHEN any project-scoped API endpoint is accessed, THE Platform SHALL extract the Chatbot_Identifier from the request
2. THE Platform SHALL verify the authenticated user is the Project_Owner or a Collaborator for the specified Chatbot_Project
3. IF the user lacks access, THEN THE Platform SHALL return a 403 Forbidden error without revealing project existence
4. THE Platform SHALL apply access control checks before any database operations
5. THE Platform SHALL log unauthorized access attempts for security monitoring

### Requirement 19: Widget API with Chatbot Identifier

**User Story:** As a website visitor, I want to interact with the correct chatbot, so that I get answers from the appropriate knowledge base

#### Acceptance Criteria

1. THE Widget SHALL include the Chatbot_Identifier in all API requests to the Widget_API_Endpoint
2. WHEN a chat message is received at the Widget_API_Endpoint, THE Platform SHALL extract the Chatbot_Identifier
3. THE Platform SHALL route the message to the Chatbot_Engine instance for the specified Chatbot_Project
4. THE Chatbot_Engine SHALL search only the Intents and Knowledge_Base belonging to the specified Chatbot_Project
5. IF the Chatbot_Identifier is invalid or missing, THEN THE Platform SHALL return an error response
6. THE Widget_API_Endpoint SHALL NOT require authentication (public access for website visitors)

### Requirement 20: Generate Widget Embed Code

**User Story:** As a project owner or editor, I want to generate embed code for my chatbot, so that I can add it to my website

#### Acceptance Criteria

1. THE Platform SHALL provide an API endpoint to generate Embed_Code for a Chatbot_Project
2. WHEN embed code generation is requested, THE Platform SHALL verify the user has Owner_Role or Editor_Role
3. IF the user has Viewer_Role, THEN THE Platform SHALL return a 403 Forbidden error
4. WHEN access is verified, THE Platform SHALL generate JavaScript Embed_Code including the Chatbot_Identifier
5. THE Embed_Code SHALL include the Widget_API_Endpoint URL
6. THE Platform SHALL return the complete Embed_Code as a copyable text snippet

## NLP and Chatbot Engine Requirements (Project-Scoped)

### Requirement 21: Text Normalization

**User Story:** As a user, I want the chatbot to understand my messages regardless of capitalization or punctuation, so that I can type naturally without worrying about formatting

#### Acceptance Criteria

1. WHEN a user message is received, THE NLP_Processor SHALL convert all text to lowercase
2. THE NLP_Processor SHALL remove punctuation marks from the user message
3. THE NLP_Processor SHALL trim leading and trailing whitespace
4. THE NLP_Processor SHALL normalize multiple consecutive spaces to a single space
5. THE NLP_Processor SHALL process the normalized text before keyword matching

### Requirement 22: Tokenization

**User Story:** As a system, I need to split user messages into individual words, so that I can analyze each word independently for better matching

#### Acceptance Criteria

1. WHEN text normalization is complete, THE NLP_Processor SHALL split the text into Tokens
2. THE NLP_Processor SHALL use whitespace as the primary Token delimiter
3. THE NLP_Processor SHALL return an array of Tokens for further processing
4. THE NLP_Processor SHALL handle empty messages by returning an empty Token array

### Requirement 23: Stop Words Removal

**User Story:** As a system, I need to remove common filler words, so that I can focus on meaningful keywords for better intent matching

#### Acceptance Criteria

1. THE NLP_Processor SHALL maintain a list of Stop_Words for the configured language
2. WHEN Tokens are generated, THE NLP_Processor SHALL filter out all Stop_Words
3. THE NLP_Processor SHALL support Indonesian language Stop_Words by default
4. THE NLP_Processor SHALL support English language Stop_Words as a secondary language
5. THE filtered Token array SHALL contain only meaningful words for matching

### Requirement 24: Stemming

**User Story:** As a system, I need to reduce words to their base form, so that I can match variations of the same word (e.g., "studying", "studied", "study")

#### Acceptance Criteria

1. WHEN Stop_Words are removed, THE NLP_Processor SHALL apply stemming to each remaining Token
2. THE NLP_Processor SHALL use Indonesian stemming rules by default
3. THE NLP_Processor SHALL fall back to English stemming rules for non-Indonesian words
4. THE NLP_Processor SHALL preserve the original Token if stemming cannot be applied
5. THE stemmed Token array SHALL be used for intent keyword matching

### Requirement 25: Intelligent Intent Matching

**User Story:** As a user, I want the chatbot to understand my question even when I don't use exact keywords, so that I get relevant answers without precise phrasing

#### Acceptance Criteria

1. WHEN stemmed Tokens are ready, THE Chatbot_Engine SHALL compare them against all Intent keywords
2. THE Chatbot_Engine SHALL calculate a Similarity_Score for each Intent using token overlap
3. THE Chatbot_Engine SHALL use Levenshtein distance or Cosine similarity to match similar but non-identical words
4. WHEN the highest Similarity_Score exceeds 0.6 threshold, THE Chatbot_Engine SHALL return the associated response
5. WHEN multiple Intents exceed the threshold, THE Chatbot_Engine SHALL return the Intent with the highest Similarity_Score
6. WHEN no Intent exceeds the threshold, THE Chatbot_Engine SHALL return the default fallback message
7. THE Chatbot_Engine SHALL complete matching within 500ms

### Requirement 26: Rule-Based Message Processing

**User Story:** As a user, I want to ask questions to the chatbot, so that I can get quick answers relevant to the configured domain

#### Acceptance Criteria

1. WHEN a user message is received, THE NLP_Processor SHALL normalize, tokenize, remove Stop_Words, and stem the text
2. WHEN preprocessing is complete, THE Chatbot_Engine SHALL match the processed message against all Intent keywords
3. WHEN a keyword match is found above the similarity threshold, THE Chatbot_Engine SHALL return the associated response
4. THE Chatbot_Engine SHALL apply the same NLP processing to Intent keywords during comparison
5. THE complete processing pipeline SHALL execute within 500ms

### Requirement 27: Intent Management

**User Story:** As an administrator, I want to create and manage chatbot intents, so that I can control what the chatbot can answer

#### Acceptance Criteria

1. THE Platform SHALL provide an intent management form requiring authentication and Chatbot_Identifier
2. WHEN the form is accessed, THE Platform SHALL verify the user has Owner_Role or Editor_Role for the Chatbot_Project
3. IF the user has Viewer_Role, THEN THE Platform SHALL display intents in read-only mode
4. THE Platform SHALL provide a form to create new Intents with keywords, responses, and categories for the specified Chatbot_Project
5. WHEN an Intent is created, THE Database SHALL store the Intent with a unique identifier linked to the Chatbot_Identifier
6. THE Platform SHALL display a list of all Intents belonging to the specified Chatbot_Project only
7. WHEN a user with Editor_Role or Owner_Role selects an Intent, THE Platform SHALL allow editing of keywords, response, and category
8. WHEN a user with Editor_Role or Owner_Role deletes an Intent, THE Database SHALL remove the Intent permanently from the Chatbot_Project
9. THE Platform SHALL validate that keywords and response fields are not empty before saving

### Requirement 28: Data Persistence

**User Story:** As an administrator, I want chatbot data to persist across server restarts, so that I don't lose my configuration

#### Acceptance Criteria

1. THE Database SHALL store all User_Accounts, Chatbot_Projects, Intents, and Knowledge_Base data
2. WHEN the server starts, THE Database SHALL load existing data from persistent storage
3. WHEN any data is created, updated, or deleted, THE Database SHALL write changes to persistent storage immediately
4. THE Database SHALL maintain referential integrity between User_Accounts, Chatbot_Projects, Intents, and Document_Library
5. IF storage files do not exist on server start, THEN THE Database SHALL create new storage with empty collections

### Requirement 29: RESTful API

**User Story:** As a developer, I want a RESTful API for the chatbot, so that I can integrate it with various interfaces

#### Acceptance Criteria

1. THE Platform SHALL expose a POST endpoint at /api/auth/register for user registration
2. THE Platform SHALL expose a POST endpoint at /api/auth/login for user authentication
3. THE Platform SHALL expose a POST endpoint at /api/auth/logout for session termination
4. THE Platform SHALL expose a GET endpoint at /api/user/profile requiring authentication
5. THE Platform SHALL expose a GET endpoint at /api/projects requiring authentication to list user's projects
6. THE Platform SHALL expose a POST endpoint at /api/projects requiring authentication to create new projects
7. THE Platform SHALL expose a POST endpoint at /api/chat/:chatbotId accepting public chat requests with Chatbot_Identifier
8. WHEN a chat request is received, THE Chatbot_Engine SHALL return a JSON response containing the answer, match status, and source reference
9. THE Platform SHALL expose a GET endpoint at /api/projects/:chatbotId/intents requiring authentication to list project intents
10. THE Platform SHALL expose a POST endpoint at /api/projects/:chatbotId/intents requiring authentication to create intents
11. THE Platform SHALL expose a PUT endpoint at /api/projects/:chatbotId/intents/:id requiring authentication to update intents
12. THE Platform SHALL expose a DELETE endpoint at /api/projects/:chatbotId/intents/:id requiring authentication to delete intents
13. WHEN an API request has missing required parameters, THEN THE Platform SHALL return a 400 error with a descriptive message
14. WHEN an API request lacks valid authentication where required, THEN THE Platform SHALL return a 401 error

### Requirement 30: Dashboard Interface

**User Story:** As a user, I want a unified dashboard to manage all my chatbot projects, so that I can easily switch between projects and see their status

#### Acceptance Criteria

1. THE Dashboard SHALL display all Chatbot_Projects owned by or shared with the authenticated user
2. THE Dashboard SHALL show each project's name, description, domain, Access_Role, and quick stats in a card or table format
3. THE Dashboard SHALL display quick stats including number of Intents, number of PDFs, and total messages handled per project
4. WHEN a user clicks on a Chatbot_Project, THE Dashboard SHALL navigate to the project management interface
5. WHEN a user clicks "Create New Chatbot", THE Dashboard SHALL display a form with fields for project name, description, and domain
6. THE Dashboard SHALL allow searching and filtering projects by name, domain, or Access_Role
7. THE Dashboard SHALL display success or error messages after create, update, or delete operations
8. THE Dashboard SHALL refresh the project list automatically after any modification

### Requirement 31: Widget Embedding

**User Story:** As a website owner, I want to embed the chatbot on my website, so that my visitors can get information without leaving my site

#### Acceptance Criteria

1. THE Widget SHALL be embeddable using a JavaScript snippet containing the Chatbot_Identifier on external websites
2. WHEN the Embed_Code is added to a webpage, THE Widget SHALL display as a chat bubble in the bottom-right corner
3. WHEN a user clicks the chat bubble, THE Widget SHALL expand to show a chat interface
4. THE Widget SHALL send user messages to the Widget_API_Endpoint at /api/chat/:chatbotId with the Chatbot_Identifier
5. WHEN a response is received, THE Widget SHALL display it in the chat interface
6. THE Widget SHALL maintain conversation history during the current session
7. THE Widget SHALL style independently from the host website using isolated CSS
8. THE Widget SHALL route all requests to the correct Chatbot_Engine instance based on Chatbot_Identifier

### Requirement 32: Cross-Origin Resource Sharing

**User Story:** As a website owner, I want the chatbot to work on my domain, so that I can integrate it regardless of where it's hosted

#### Acceptance Criteria

1. THE Chatbot_Engine SHALL enable CORS headers for all API endpoints
2. THE Chatbot_Engine SHALL accept requests from any origin domain
3. WHEN a preflight OPTIONS request is received, THE Chatbot_Engine SHALL respond with appropriate CORS headers

### Requirement 33: Keyword Categorization

**User Story:** As an administrator, I want to categorize intents, so that I can organize responses by topic or domain area

#### Acceptance Criteria

1. THE Platform SHALL allow assigning a category to each Intent within a Chatbot_Project
2. THE Platform SHALL display the category alongside each Intent in the intent list
3. WHERE a category is not specified, THE Platform SHALL assign the default category "General"
4. THE Platform SHALL allow filtering Intents by category within a specific Chatbot_Project

### Requirement 34: Multi-Keyword Support

**User Story:** As an administrator, I want to define multiple keywords for one response, so that the chatbot can recognize different phrasings of the same question

#### Acceptance Criteria

1. THE Platform SHALL accept multiple keywords separated by commas for a single Intent
2. THE Chatbot_Engine SHALL match a user message if any of the Intent keywords are present when searching within a Chatbot_Project
3. THE Platform SHALL display all keywords associated with an Intent
4. WHEN editing an Intent, THE Platform SHALL allow adding or removing individual keywords

### Requirement 35: System Initialization

**User Story:** As a system administrator, I want the chatbot to work out-of-the-box, so that I can demonstrate it immediately after installation

#### Acceptance Criteria

1. WHEN the server starts for the first time, THE Database SHALL create empty User_Account and Chatbot_Project collections
2. THE Platform SHALL be accessible immediately after server start
3. THE registration and login interfaces SHALL be available without additional configuration

### Requirement 36: Project Customization

**User Story:** As a project owner or editor, I want to customize my chatbot project for different domains, so that I can adapt it for various use cases such as customer service, FAQ systems, academic support, or general information bots

#### Acceptance Criteria

1. THE Platform SHALL allow customizing the default fallback message per Chatbot_Project when no Intent matches
2. THE Platform SHALL allow customizing category names per Chatbot_Project to match the target domain
3. THE Widget SHALL display a customizable greeting message per Chatbot_Project when first opened
4. WHERE domain-specific branding is needed, THE Platform SHALL allow configuring the Widget title and welcome text per Chatbot_Project
5. THE Platform SHALL allow selecting the primary language for Stop_Words and stemming (Indonesian or English) per Chatbot_Project

### Requirement 37: NLP Configuration

**User Story:** As a project owner or editor, I want to configure NLP processing parameters for my chatbot project, so that I can tune the matching behavior for my specific domain

#### Acceptance Criteria

1. THE Platform SHALL allow configuring the similarity threshold value between 0.0 and 1.0 per Chatbot_Project
2. THE Platform SHALL allow enabling or disabling stemming per Chatbot_Project
3. THE Platform SHALL allow enabling or disabling Stop_Words removal per Chatbot_Project
4. THE Platform SHALL display the current NLP configuration settings for the selected Chatbot_Project
5. WHEN NLP settings are changed for a Chatbot_Project, THE Chatbot_Engine SHALL apply the new settings immediately for that project without affecting other projects

### Requirement 38: Multiple Storage Backend Support

**User Story:** As a system administrator, I want to choose from multiple database options, so that I can scale the chatbot according to my deployment needs

#### Acceptance Criteria

1. THE Database SHALL support JSON file-based storage as the default Storage_Backend for all platform data
2. THE Database SHALL support SQLite as an alternative Storage_Backend
3. THE Database SHALL support MongoDB as an alternative Storage_Backend
4. THE Database SHALL support PostgreSQL as an alternative Storage_Backend
5. THE Database SHALL support MySQL as an alternative Storage_Backend
6. THE Platform SHALL allow configuring which Storage_Backend to use at system level
7. WHEN the Storage_Backend is changed, THE Database SHALL maintain data integrity during migration
8. THE Database SHALL provide the same API interface regardless of the active Storage_Backend
9. THE Database SHALL store User_Accounts, Chatbot_Projects, Intents, Knowledge_Base, and collaboration data

### Requirement 39: Storage Backend Data Portability

**User Story:** As a project owner, I want to export and import my chatbot project data, so that I can migrate, backup, or share my chatbot configuration

#### Acceptance Criteria

1. THE Platform SHALL provide an export function per Chatbot_Project that outputs all Intents and Knowledge_Base content in a portable format
2. THE Platform SHALL provide an import function per Chatbot_Project that loads data from the portable format
3. WHEN data is exported, THE Platform SHALL include all Intents, responses, categories, and Knowledge_Base references for the specified project
4. WHEN data is imported, THE Platform SHALL validate the format before applying changes
5. THE export format SHALL be independent of the active Storage_Backend
6. WHEN importing data, THE Platform SHALL handle conflicts by prompting the user for resolution strategy
7. WHEN export is requested, THE Platform SHALL verify the user has Owner_Role or Editor_Role

### Requirement 40: PDF File Upload

**User Story:** As a project owner or editor, I want to upload PDF files to my chatbot project, so that I can provide the chatbot with reference material

#### Acceptance Criteria

1. THE Platform SHALL provide a file upload interface for PDF files requiring authentication and Chatbot_Identifier
2. WHEN file upload is accessed, THE Platform SHALL verify the user has Owner_Role or Editor_Role
3. IF the user has Viewer_Role, THEN THE Platform SHALL deny access with a 403 error
4. WHEN a PDF file is uploaded, THE Platform SHALL accept files with .pdf extension only
5. THE Platform SHALL validate that uploaded files do not exceed 10MB
6. WHEN a PDF file is uploaded, THE Platform SHALL store the file in the Document_Library associated with the Chatbot_Identifier
7. THE Platform SHALL assign a unique identifier to each uploaded PDF
8. WHEN PDF upload fails, THEN THE Platform SHALL display a descriptive error message

### Requirement 41: PDF Text Extraction

**User Story:** As a system, I need to extract text from PDF files, so that I can use the content to answer user questions

#### Acceptance Criteria

1. WHEN a PDF file is uploaded to a Chatbot_Project, THE PDF_Processor SHALL extract text content from all pages
2. THE PDF_Processor SHALL use pdf-parse or pdf.js library for text extraction
3. WHEN text extraction is complete, THE PDF_Processor SHALL store the extracted content in the Knowledge_Base associated with the Chatbot_Identifier
4. THE PDF_Processor SHALL associate the extracted content with the Source_Reference including filename and page numbers
5. IF text extraction fails, THEN THE PDF_Processor SHALL log the error and mark the document as unprocessed
6. THE PDF_Processor SHALL complete text extraction within 30 seconds for files up to 10MB

### Requirement 42: Document Library Management

**User Story:** As a project owner or editor, I want to manage uploaded PDF files in my chatbot project, so that I can keep the knowledge base current

#### Acceptance Criteria

1. THE Platform SHALL display a list of all PDFs in the Document_Library for the specified Chatbot_Project
2. THE Platform SHALL show the filename, upload date, size, and processing status for each PDF
3. WHEN a user with Owner_Role or Editor_Role selects a PDF, THE Platform SHALL allow viewing the extracted text content
4. WHEN a user with Owner_Role or Editor_Role clicks "Delete" on a PDF, THE Platform SHALL remove the file and its extracted content from the Knowledge_Base
5. THE Platform SHALL allow re-processing a PDF to update its extracted content
6. THE Platform SHALL display the total number of documents in the Document_Library for the project
7. WHEN a user with Viewer_Role accesses the Document_Library, THE Platform SHALL show the list in read-only mode

### Requirement 43: Knowledge Base Search

**User Story:** As a user, I want the chatbot to search PDF content, so that I can get answers from uploaded reference materials

#### Acceptance Criteria

1. WHEN a user message is received for a Chatbot_Project, THE Chatbot_Engine SHALL search both manual Intents and the Knowledge_Base for that project only
2. THE Chatbot_Engine SHALL use NLP Lite techniques to match user message against Knowledge_Base content within the specified project
3. THE Chatbot_Engine SHALL calculate a Similarity_Score for each Content_Excerpt in the project's Knowledge_Base
4. WHEN a Knowledge_Base match exceeds the similarity threshold, THE Chatbot_Engine SHALL return the Content_Excerpt with Source_Reference
5. WHEN both manual Intents and Knowledge_Base content match, THE Chatbot_Engine SHALL prioritize manual Intents
6. THE Chatbot_Engine SHALL complete Knowledge_Base search within 1000ms
7. THE Chatbot_Engine SHALL NOT search Knowledge_Base content from other Chatbot_Projects

### Requirement 44: Knowledge Base Response Formatting

**User Story:** As a user, I want to know where chatbot answers come from, so that I can verify the information source

#### Acceptance Criteria

1. WHEN a response is retrieved from the Knowledge_Base, THE Chatbot_Engine SHALL include the Source_Reference
2. THE Source_Reference SHALL include the document filename and page number
3. THE Widget SHALL display Knowledge_Base responses with a visual indicator distinguishing them from Intent-based responses
4. THE Widget SHALL format Source_Reference as a citation at the end of the response
5. WHEN multiple Content_Excerpts match, THE Chatbot_Engine SHALL return the excerpt with the highest Similarity_Score

### Requirement 45: Auto-Generate Intents from PDF Content

**User Story:** As a project owner or editor, I want to automatically generate intents from PDF content, so that I can quickly populate my chatbot with common questions

#### Acceptance Criteria

1. WHERE the user with Owner_Role or Editor_Role enables auto-generation, THE Platform SHALL analyze PDF content for the Chatbot_Project for potential question-answer pairs
2. THE Platform SHALL use section headings and structured content to identify potential Intents
3. WHEN potential Intents are identified, THE Platform SHALL present them to the user for review
4. THE Platform SHALL allow the user to accept, modify, or reject suggested Intents
5. WHEN an Intent is accepted, THE Database SHALL store it as a standard Intent associated with the Chatbot_Identifier and Knowledge_Base reference

