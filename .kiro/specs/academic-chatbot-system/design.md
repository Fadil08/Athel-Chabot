# Design Document: Academic Chatbot System

## Overview

The Academic Chatbot System is a configurable, domain-agnostic conversational interface built on lightweight Natural Language Processing (NLP Lite) techniques. The system provides intelligent intent recognition without relying on paid AI services or heavy machine learning models, making it suitable for various use cases including academic support, customer service, FAQ systems, and general information bots.

### Core Capabilities

- **NLP Lite Processing**: Text normalization, tokenization, stemming, stop words removal, and similarity-based matching
- **Multi-Backend Storage**: Flexible data persistence with JSON (default), SQLite, MongoDB, PostgreSQL, and MySQL support
- **PDF Knowledge Base**: Upload and search through PDF documents to provide reference-based answers
- **Intent Management**: Web-based admin panel for creating and organizing chatbot responses
- **Embeddable Widget**: JavaScript snippet for integrating the chatbot into external websites
- **Zero Dependencies on Paid APIs**: Fully self-hosted with no cloud service requirements

### Technology Stack

- **Backend**: Node.js v16+ with Express framework
- **NLP Libraries**: `natural` (primary), `compromise` (fallback), `string-similarity` for text processing
- **PDF Processing**: `pdf-parse` for text extraction
- **Storage**: JSON file system (default), with adapters for SQLite, MongoDB, PostgreSQL, MySQL
- **Frontend**: Vanilla JavaScript for admin panel and embeddable widget

### Design Principles

1. **Domain Agnostic**: Architecture supports any conversational use case through configuration
2. **Lightweight**: No heavy ML models or training requirements
3. **Self-Contained**: All processing happens locally without external API calls
4. **Extensible**: Modular design allows easy addition of new storage backends or NLP processors
5. **Fast**: Response time target of <500ms for intent matching, <1000ms for knowledge base search

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph External
        User[User/Website Visitor]
        Admin[Administrator]
        Website[External Website]
    

    end
    
    subgraph Frontend Layer
        Widget[Chat Widget]
        AdminUI[Admin Dashboard]
    end
    
    subgraph API Layer
        ChatAPI[Chat API<br/>/api/chat]
        IntentAPI[Intent API<br/>/api/intents]
        DocumentAPI[Document API<br/>/api/documents]
        ConfigAPI[Config API<br/>/api/config]
    end
    
    subgraph Business Logic Layer
        ChatbotEngine[Chatbot Engine]
        NLPProcessor[NLP Processor]
        IntentMatcher[Intent Matcher]
        KBSearcher[Knowledge Base Searcher]
        PDFProcessor[PDF Processor]
    end
    
    subgraph Data Access Layer
        StorageAdapter[Storage Adapter Interface]
        JSONAdapter[JSON Adapter]
        SQLiteAdapter[SQLite Adapter]
        MongoAdapter[MongoDB Adapter]
        Pos